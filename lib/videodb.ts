import type { AgentTaskRequest, EvidenceMoment } from "@/types/agent";

export async function retrieveEvidenceMoments(
  request: AgentTaskRequest
): Promise<EvidenceMoment[]> {
  if (!process.env.VIDEODB_API_KEY) {
    return getDemoMoments(request.input.value);
  }

  return getDemoMoments(request.input.value);
}

function getDemoMoments(assetUrl: string): EvidenceMoment[] {
  return [
    {
      id: "moment-quote-backed-next-move",
      title: "Quote-backed next move",
      startSeconds: 18,
      endSeconds: 34,
      quote: "RoomPilot helps while the person is still here, but only when the exact quote supports the next move.",
      screenSummary: "The interface shows a live transcript next to a selected action card and proof panel.",
      source: "multimodal",
      score: 0.93,
      streamUrl: assetUrl,
    },
    {
      id: "moment-action-queue",
      title: "After-session action queue",
      startSeconds: 52,
      endSeconds: 69,
      quote: "The live cue stays quiet, and the after-session queue prepares the actual follow-up.",
      screenSummary: "A right-side queue lists draft later, save proof, and compare with memory actions.",
      source: "multimodal",
      score: 0.88,
      streamUrl: assetUrl,
    },
    {
      id: "moment-memory-graph",
      title: "Memory graph comparison",
      startSeconds: 76,
      endSeconds: 91,
      quote: "The memory graph matters only when it can connect this quote to something someone said earlier.",
      screenSummary: "A timeline highlights two previous conversations connected by matching evidence.",
      source: "audio",
      score: 0.79,
      streamUrl: assetUrl,
    },
  ];
}
