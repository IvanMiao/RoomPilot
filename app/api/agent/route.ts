import { NextResponse } from "next/server";
import { runRoomPilotAgent } from "@/lib/agent";
import type {
  AgentMode,
  AgentTaskInputType,
  AgentTaskOptions,
  AgentTaskRequest,
} from "@/types/agent";

const agentModes = new Set<AgentMode>([
  "answer",
  "rank_moments",
  "generate_reel",
  "find_strongest_proof",
]);

const inputTypes = new Set<AgentTaskInputType>(["video_url", "video_asset"]);

export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsedRequest = parseAgentTaskRequest(body);

  if (!parsedRequest) {
    return NextResponse.json({ error: "Invalid agent task request" }, { status: 400 });
  }

  try {
    const result = await runRoomPilotAgent(parsedRequest);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent task failed";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function parseAgentTaskRequest(value: unknown): AgentTaskRequest | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<AgentTaskRequest>;

  if (!candidate.input || typeof candidate.input !== "object") {
    return null;
  }

  if (!inputTypes.has(candidate.input.type)) {
    return null;
  }

  if (typeof candidate.input.value !== "string" || candidate.input.value.trim().length === 0) {
    return null;
  }

  if (typeof candidate.goal !== "string" || candidate.goal.trim().length === 0) {
    return null;
  }

  if (!candidate.mode || !agentModes.has(candidate.mode)) {
    return null;
  }

  const options = parseAgentTaskOptions(candidate.options);

  if (options === null) {
    return null;
  }

  return {
    input: {
      type: candidate.input.type,
      value: candidate.input.value.trim(),
    },
    goal: candidate.goal.trim(),
    mode: candidate.mode,
    ...(options ? { options } : {}),
  };
}

function parseAgentTaskOptions(value: unknown): AgentTaskOptions | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<AgentTaskOptions>;
  const options: AgentTaskOptions = {};

  if (candidate.maxMoments !== undefined) {
    if (!isPositiveInteger(candidate.maxMoments)) {
      return null;
    }

    options.maxMoments = candidate.maxMoments;
  }

  if (candidate.clipLengthSeconds !== undefined) {
    if (!isPositiveInteger(candidate.clipLengthSeconds)) {
      return null;
    }

    options.clipLengthSeconds = candidate.clipLengthSeconds;
  }

  if (candidate.includeAudioEvidence !== undefined) {
    if (typeof candidate.includeAudioEvidence !== "boolean") {
      return null;
    }

    options.includeAudioEvidence = candidate.includeAudioEvidence;
  }

  if (candidate.includeVisualEvidence !== undefined) {
    if (typeof candidate.includeVisualEvidence !== "boolean") {
      return null;
    }

    options.includeVisualEvidence = candidate.includeVisualEvidence;
  }

  return Object.keys(options).length > 0 ? options : undefined;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
