import type { AgentTaskRequest, AgentTaskResult, RankedMoment, ReelClip } from "@/types/agent";
import { rankMomentsWithGemini } from "@/lib/gemini";
import { retrieveEvidenceMoments } from "@/lib/videodb";

export async function runRoomPilotAgent(request: AgentTaskRequest): Promise<AgentTaskResult> {
  const moments = await retrieveEvidenceMoments(request);
  const agentResponse = process.env.GEMINI_API_KEY
    ? await rankMomentsWithGemini(request.goal, moments)
    : buildLocalAgentResponse();
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

function buildLocalAgentResponse() {
  return {
    summary:
      "Local demo mode selected the clearest moments with strong quote and screen evidence. Configure GEMINI_API_KEY to use Gemini ranking.",
    decisions: [
      {
        id: "moment-quote-backed-next-move",
        action: "use_in_demo" as const,
        rationale: "This moment states the core product promise and shows the proof panel in context.",
        kept: true,
      },
      {
        id: "moment-action-queue",
        action: "clip_for_pitch" as const,
        rationale: "This moment turns the idea into a concrete post-demo artifact.",
        kept: true,
      },
      {
        id: "moment-memory-graph",
        action: "compare_later" as const,
        rationale: "This is useful context, but it is less direct than the main product proof.",
        kept: true,
      },
    ],
  };
}
