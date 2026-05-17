import { connect, InvalidRequestError, Video } from "videodb";
import { getOptionalEnv } from "@/lib/env";
import type { AgentTaskRequest, EvidenceMoment, MomentSource } from "@/types/agent";
import type { Collection } from "videodb";

const defaultMomentLimit = 6;
const roomPilotVisualIndexName = "roompilot-visual-evidence";

type VideoSearchShot = {
  videoId: string;
  videoTitle: string;
  start: number;
  end: number;
  text?: string;
  searchScore?: number;
  streamUrl?: string;
};

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
    await ensureSpokenWordIndex(video);
    const audioShots = await searchVideoShots(video, request.goal, "spoken_word", maxMoments);

    momentGroups.push(toEvidenceMoments(audioShots, video.streamUrl, "audio"));
  }

  if (includeVisualEvidence) {
    const visualIndexReady = await ensureVisualIndexReady(video);

    if (visualIndexReady) {
      const visualShots = await searchVideoShots(video, request.goal, "scene", maxMoments);

      momentGroups.push(toEvidenceMoments(visualShots, video.streamUrl, "visual"));
    }
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

  const sourceUrl = normalizeVideoSourceUrl(request.input.value);
  const asset = await uploadVideoUrl(collection, sourceUrl);

  if (!(asset instanceof Video)) {
    throw new Error("VideoDB did not return a video asset for this input");
  }

  return asset;
}

async function uploadVideoUrl(collection: Collection, sourceUrl: string) {
  try {
    return await collection.uploadURL({
      url: sourceUrl,
      name: "RoomPilot demo source",
      mediaType: "video",
    });
  } catch (error) {
    throw getVideoUploadError(error);
  }
}

function normalizeVideoSourceUrl(value: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error("Enter a valid video URL that starts with http:// or https://.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Enter a valid video URL that starts with http:// or https://.");
  }

  const youtubeVideoId = getYoutubeVideoId(parsedUrl);

  if (!youtubeVideoId) {
    return parsedUrl.toString();
  }

  return `https://www.youtube.com/watch?v=${youtubeVideoId}`;
}

function getYoutubeVideoId(parsedUrl: URL): string | null {
  const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");

  if (host === "youtu.be") {
    return getFirstPathSegment(parsedUrl);
  }

  if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "music.youtube.com") {
    return null;
  }

  if (parsedUrl.pathname === "/watch") {
    return parsedUrl.searchParams.get("v");
  }

  if (parsedUrl.pathname.startsWith("/shorts/")) {
    return getPathSegment(parsedUrl, 1);
  }

  if (parsedUrl.pathname.startsWith("/embed/")) {
    return getPathSegment(parsedUrl, 1);
  }

  if (parsedUrl.pathname.startsWith("/live/")) {
    return getPathSegment(parsedUrl, 1);
  }

  return null;
}

function getFirstPathSegment(parsedUrl: URL): string | null {
  return getPathSegment(parsedUrl, 0);
}

function getPathSegment(parsedUrl: URL, index: number): string | null {
  const segment = parsedUrl.pathname.split("/").filter(Boolean)[index];

  return segment || null;
}

function getVideoUploadError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Download failed")) {
    return new Error(
      "VideoDB could not download that video URL. Use a public YouTube video or a direct video file URL such as an MP4 or S3 object. Private, age-restricted, members-only, live, region-restricted, or blocked YouTube videos can fail during VideoDB ingest."
    );
  }

  return error instanceof Error ? error : new Error("VideoDB upload failed");
}

async function ensureSpokenWordIndex(video: Video): Promise<void> {
  try {
    await video.indexSpokenWords();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("Spoken word index for video already exists")) {
      return;
    }

    throw error;
  }
}

async function ensureVisualIndexReady(video: Video): Promise<boolean> {
  const existingIndexes = await video.listSceneIndex();
  const completedIndex = existingIndexes.find(
    (index) => index.name === roomPilotVisualIndexName && index.status === "done"
  );

  if (completedIndex) {
    return true;
  }

  const existingRoomPilotIndex = existingIndexes.find(
    (index) => index.name === roomPilotVisualIndexName
  );

  if (existingRoomPilotIndex) {
    return false;
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

  return false;
}

async function searchVideoShots(
  video: Video,
  query: string,
  indexType: "spoken_word" | "scene",
  maxMoments: number
): Promise<VideoSearchShot[]> {
  try {
    const results = await video.search(query, "semantic", indexType, maxMoments);

    return results.shots;
  } catch (error) {
    if (isNoSearchResultsError(error)) {
      return [];
    }

    throw error;
  }
}

function isNoSearchResultsError(error: unknown): boolean {
  if (!(error instanceof InvalidRequestError) && !(error instanceof Error)) {
    return false;
  }

  return error.message.includes("No results found");
}

function toEvidenceMoments(
  shots: VideoSearchShot[],
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
