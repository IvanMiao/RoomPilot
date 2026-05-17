import { NextResponse } from "next/server";
import { runRoomPilotAgent } from "@/lib/agent";
import type { AgentMode, AgentTaskRequest } from "@/types/agent";

const agentModes = new Set<AgentMode>([
  "answer",
  "rank_moments",
  "generate_reel",
  "find_strongest_proof",
]);

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

  if (typeof candidate.assetUrl !== "string" || candidate.assetUrl.trim().length === 0) {
    return null;
  }

  if (typeof candidate.goal !== "string" || candidate.goal.trim().length === 0) {
    return null;
  }

  if (!candidate.mode || !agentModes.has(candidate.mode)) {
    return null;
  }

  return {
    assetUrl: candidate.assetUrl.trim(),
    goal: candidate.goal.trim(),
    mode: candidate.mode,
  };
}
