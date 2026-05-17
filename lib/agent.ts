import type {
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
    ? await rankMomentsWithGemini(request.goal, moments)
    : buildLocalAgentResponse(moments);
  const rankedMoments = moments.map((moment): RankedMoment => {
    const decision = agentResponse.decisions.find((candidate) => candidate.id === moment.id);

    return {
      ...moment,
      action: decision?.action ?? "ignore",
      rationale: decision?.rationale ?? "The agent did not select this moment.",
      kept: decision?.kept ?? false,
    };
  });

  return {
    summary: agentResponse.summary,
    moments: rankedMoments,
    reelPlan: buildReelPlan(rankedMoments),
  };
}

function buildReelPlan(moments: RankedMoment[]): ReelClip[] {
  return moments
    .filter((moment) => moment.kept && moment.action === "clip_for_pitch")
    .slice(0, 3)
    .map((moment) => ({
      momentId: moment.id,
      startSeconds: moment.startSeconds,
      endSeconds: moment.endSeconds,
      reason: moment.rationale,
    }));
}

function buildLocalAgentResponse(moments: EvidenceMoment[]) {
  const selectedMoments = moments.slice(0, 3);

  return {
    summary:
      "Local demo mode selected the highest-scoring retrieved moments. Configure GEMINI_API_KEY to use Gemini ranking.",
    decisions: selectedMoments.map((moment, index) => ({
      id: moment.id,
      action: index === 1 ? ("clip_for_pitch" as const) : ("use_in_demo" as const),
      rationale: "This retrieved moment has one of the strongest VideoDB relevance scores for the goal.",
      kept: true,
    })),
  };
}
