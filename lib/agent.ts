import type {
  AgentAction,
  AgentMode,
  AgentTaskRequest,
  AgentTaskResult,
  EvidenceMoment,
  RankedMoment,
  ReelClip,
} from "@/types/agent";
import { rankMomentsWithGemini } from "@/lib/gemini";
import { retrieveEvidenceMoments } from "@/lib/videodb";

export async function runRoomPilotAgent(request: AgentTaskRequest): Promise<AgentTaskResult> {
  const moments = await retrieveEvidenceMoments(request);
  const agentResponse = process.env.GEMINI_API_KEY
    ? await rankMomentsWithGemini(request.mode, request.goal, moments)
    : buildLocalAgentResponse(request.mode, moments);
  const rankedMoments = applyAgentDecisions(request.mode, moments, agentResponse.decisions);
  const shapedMoments = shapeMomentsForMode(request.mode, rankedMoments);

  return {
    summary: agentResponse.summary,
    moments: shapedMoments,
    reelPlan: buildReelPlan(request, shapedMoments),
  };
}

interface AgentDecision {
  id: string;
  action: AgentAction;
  rationale: string;
  kept: boolean;
}

type RankedAgentDecision = AgentDecision & { index: number };

function applyAgentDecisions(
  mode: AgentMode,
  moments: EvidenceMoment[],
  decisions: AgentDecision[]
): RankedMoment[] {
  const decisionsById = new Map<string, RankedAgentDecision>(
    decisions.map((decision, index) => [decision.id, { ...decision, index }])
  );
  const rankedMoments = moments.map((moment): RankedMoment => {
    const decision = decisionsById.get(moment.id);

    return {
      ...moment,
      action: decision?.action ?? "ignore",
      rationale: decision?.rationale ?? "The agent did not select this moment.",
      kept: decision?.kept ?? false,
    };
  });

  if (mode === "rank_moments") {
    return sortByDecisionOrder(rankedMoments, decisionsById);
  }

  if (mode === "generate_reel") {
    return sortForReel(rankedMoments, decisionsById);
  }

  return sortByKeptThenScore(rankedMoments);
}

function sortByDecisionOrder(
  moments: RankedMoment[],
  decisionsById: Map<string, RankedAgentDecision>
): RankedMoment[] {
  return [...moments].sort((firstMoment, secondMoment) => {
    const firstIndex = decisionsById.get(firstMoment.id)?.index ?? Number.MAX_SAFE_INTEGER;
    const secondIndex = decisionsById.get(secondMoment.id)?.index ?? Number.MAX_SAFE_INTEGER;

    if (firstIndex !== secondIndex) {
      return firstIndex - secondIndex;
    }

    return secondMoment.score - firstMoment.score;
  });
}

function sortForReel(
  moments: RankedMoment[],
  decisionsById: Map<string, RankedAgentDecision>
): RankedMoment[] {
  return [...moments].sort((firstMoment, secondMoment) => {
    const firstClipScore = firstMoment.kept && firstMoment.action === "clip_for_pitch" ? 1 : 0;
    const secondClipScore = secondMoment.kept && secondMoment.action === "clip_for_pitch" ? 1 : 0;

    if (firstClipScore !== secondClipScore) {
      return secondClipScore - firstClipScore;
    }

    const firstIndex = decisionsById.get(firstMoment.id)?.index ?? Number.MAX_SAFE_INTEGER;
    const secondIndex = decisionsById.get(secondMoment.id)?.index ?? Number.MAX_SAFE_INTEGER;

    if (firstIndex !== secondIndex) {
      return firstIndex - secondIndex;
    }

    return secondMoment.score - firstMoment.score;
  });
}

function sortByKeptThenScore(moments: RankedMoment[]): RankedMoment[] {
  return [...moments].sort((firstMoment, secondMoment) => {
    if (firstMoment.kept !== secondMoment.kept) {
      return firstMoment.kept ? -1 : 1;
    }

    return secondMoment.score - firstMoment.score;
  });
}

function shapeMomentsForMode(mode: AgentMode, moments: RankedMoment[]): RankedMoment[] {
  if (mode === "answer") {
    return moments.filter((moment) => moment.kept).slice(0, 3);
  }

  if (mode === "generate_reel") {
    return moments.filter((moment) => moment.kept && moment.action === "clip_for_pitch");
  }

  if (mode === "find_strongest_proof") {
    return moments.filter((moment) => moment.kept);
  }

  return moments;
}

function buildReelPlan(request: AgentTaskRequest, moments: RankedMoment[]): ReelClip[] {
  const clipLengthSeconds = request.options?.clipLengthSeconds;

  return moments
    .filter((moment) => moment.kept && moment.action === "clip_for_pitch")
    .slice(0, 3)
    .map((moment) => {
      const endSeconds = clipLengthSeconds
        ? Math.min(moment.endSeconds, moment.startSeconds + clipLengthSeconds)
        : moment.endSeconds;

      return {
        momentId: moment.id,
        startSeconds: moment.startSeconds,
        endSeconds,
        reason: moment.rationale,
      };
    });
}

function buildLocalAgentResponse(mode: AgentMode, moments: EvidenceMoment[]) {
  if (mode === "answer") {
    return buildLocalAnswerResponse(moments);
  }

  if (mode === "rank_moments") {
    return buildLocalRankResponse(moments);
  }

  if (mode === "generate_reel") {
    return buildLocalReelResponse(moments);
  }

  return buildLocalProofResponse(moments);
}

function buildLocalAnswerResponse(moments: EvidenceMoment[]) {
  const selectedMoments = moments.slice(0, 2);

  return {
    summary:
      "RoomPilot has proof that the demo supports live quote-backed guidance and after-session follow-up. The strongest support comes from the selected transcript and screen moments.",
    decisions: selectedMoments.map((moment) => ({
      id: moment.id,
      action: "save_as_proof" as const,
      rationale: "This moment directly supports the answer with product evidence.",
      kept: true,
    })),
  };
}

function buildLocalRankResponse(moments: EvidenceMoment[]) {
  return {
    summary:
      "Local demo mode ranked the retrieved evidence by VideoDB relevance score. Configure GEMINI_API_KEY to use goal-aware Gemini ranking.",
    decisions: moments.map((moment, index) => ({
      id: moment.id,
      action: getLocalRankAction(index),
      rationale: `Ranked ${index + 1} by retrieved relevance score for the goal.`,
      kept: index < 3,
    })),
  };
}

function buildLocalReelResponse(moments: EvidenceMoment[]) {
  const selectedMoments = moments.slice(0, 3);

  return {
    summary:
      "Local demo mode built a short reel plan from the strongest retrieved moments. Configure GEMINI_API_KEY to use narrative clip selection.",
    decisions: selectedMoments.map((moment) => ({
      id: moment.id,
      action: "clip_for_pitch" as const,
      rationale: "This moment is short, specific, and useful as a product demo clip.",
      kept: true,
    })),
  };
}

function buildLocalProofResponse(moments: EvidenceMoment[]) {
  const selectedMoments = moments.filter((moment) => moment.score >= 0.85).slice(0, 2);

  return {
    summary:
      selectedMoments.length > 0
        ? "Local demo mode kept only the highest-confidence proof moments."
        : "Local demo mode did not find high-confidence proof moments.",
    decisions: selectedMoments.map((moment) => ({
      id: moment.id,
      action: "save_as_proof" as const,
      rationale: "This moment passed the high-confidence proof threshold.",
      kept: true,
    })),
  };
}

function getLocalRankAction(index: number): AgentAction {
  if (index === 0) {
    return "use_in_demo";
  }

  if (index < 3) {
    return "save_as_proof";
  }

  return "compare_later";
}
