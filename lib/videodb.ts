import { connect, Video } from "videodb";
import { getOptionalEnv } from "@/lib/env";
import type { AgentTaskRequest, EvidenceMoment, MomentSource } from "@/types/agent";

const defaultMomentLimit = 6;
const roomPilotVisualIndexName = "roompilot-visual-evidence";

export async function retrieveEvidenceMoments(
  request: AgentTaskRequest
): Promise<EvidenceMoment[]> {
  if (!process.env.VIDEODB_API_KEY) {
    return getDemoMoments(request.input.value);
  }

  const video = await getVideo(request);
  const includeAudioEvidence = request.options?.includeAudioEvidence ?? true;
  const includeVisualEvidence = request.options?.includeVisualEvidence ?? true;
  const maxMoments = request.options?.maxMoments ?? defaultMomentLimit;
  const momentGroups: EvidenceMoment[][] = [];

  if (includeAudioEvidence) {
    await video.indexSpokenWords();
    const audioResults = await video.search(request.goal, "semantic", "spoken_word", maxMoments);

    momentGroups.push(toEvidenceMoments(audioResults.shots, video.streamUrl, "audio"));
  }

  if (includeVisualEvidence) {
    await ensureVisualIndex(video);

    const visualResults = await video.search(request.goal, "semantic", "scene", maxMoments);

    momentGroups.push(toEvidenceMoments(visualResults.shots, video.streamUrl, "visual"));
  }

  return mergeEvidenceMoments(momentGroups.flat(), maxMoments);
}

async function getVideo(request: AgentTaskRequest): Promise<Video> {
  const apiKey = getOptionalEnv("VIDEODB_API_KEY") ?? undefined;
  const collectionId = getOptionalEnv("VIDEODB_COLLECTION_ID") ?? undefined;
  const connection = connect({ apiKey });
  const collection = await connection.getCollection(collectionId);

  if (request.input.type === "video_asset") {
    return collection.getVideo(request.input.value);
  }

  const asset = await collection.uploadURL({
    url: request.input.value,
    name: "RoomPilot demo source",
  });

  if (!(asset instanceof Video)) {
    throw new Error("VideoDB did not return a video asset for this input");
  }

  return asset;
}

async function ensureVisualIndex(video: Video): Promise<void> {
  const existingIndexes = await video.listSceneIndex();
  const completedIndex = existingIndexes.find(
    (index) => index.name === roomPilotVisualIndexName && index.status === "done"
  );

  if (completedIndex) {
    return;
  }

  await video.indexVisuals({
    prompt:
      "Describe product screens, user interface states, visible actions, and evidence that supports product demo goals.",
    batchConfig: {
      type: "shot",
      value: 0.8,
      frameCount: 3,
      selectFrames: ["first", "middle", "last"],
    },
    name: roomPilotVisualIndexName,
  });
}

function toEvidenceMoments(
  shots: Array<{
    videoId: string;
    videoTitle: string;
    start: number;
    end: number;
    text?: string;
    searchScore?: number;
    streamUrl?: string;
  }>,
  fallbackStreamUrl: string,
  source: MomentSource
): EvidenceMoment[] {
  return shots.map((shot, index) => {
    const text = shot.text?.trim() || "VideoDB found this timestamp as relevant to the goal.";
    const startSeconds = Math.max(0, Math.floor(shot.start));
    const endSeconds = Math.max(startSeconds + 1, Math.ceil(shot.end));

    return {
      id: `${shot.videoId}-${source}-${startSeconds}-${endSeconds}-${index}`,
      title: buildMomentTitle(shot.videoTitle, source, index),
      startSeconds,
      endSeconds,
      quote: source === "audio" ? text : "",
      screenSummary: source === "visual" ? text : "Matched spoken evidence from the video transcript.",
      source,
      score: shot.searchScore ?? 0,
      streamUrl: shot.streamUrl ?? fallbackStreamUrl,
    };
  });
}

function mergeEvidenceMoments(moments: EvidenceMoment[], maxMoments: number): EvidenceMoment[] {
  const momentsByTimeRange = new Map<string, EvidenceMoment>();

  for (const moment of moments) {
    const key = `${moment.startSeconds}-${moment.endSeconds}`;
    const existingMoment = momentsByTimeRange.get(key);

    if (!existingMoment) {
      momentsByTimeRange.set(key, moment);
      continue;
    }

    momentsByTimeRange.set(key, mergeMomentPair(existingMoment, moment));
  }

  return [...momentsByTimeRange.values()]
    .sort((firstMoment, secondMoment) => secondMoment.score - firstMoment.score)
    .slice(0, maxMoments);
}

function mergeMomentPair(firstMoment: EvidenceMoment, secondMoment: EvidenceMoment): EvidenceMoment {
  const quote = firstMoment.quote || secondMoment.quote;
  const screenSummary =
    firstMoment.screenSummary === "Matched spoken evidence from the video transcript."
      ? secondMoment.screenSummary
      : firstMoment.screenSummary;

  return {
    ...firstMoment,
    title: firstMoment.title,
    quote,
    screenSummary,
    source: "multimodal",
    score: Math.max(firstMoment.score, secondMoment.score),
  };
}

function buildMomentTitle(videoTitle: string, source: MomentSource, index: number): string {
  const sourceLabel = source === "audio" ? "Transcript match" : "Visual match";

  return `${sourceLabel} ${index + 1}: ${videoTitle}`;
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
