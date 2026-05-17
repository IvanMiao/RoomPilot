import type { AgentTaskRequest, AgentTaskResult } from "@/types/agent";

export async function runAgentTask(request: AgentTaskRequest): Promise<AgentTaskResult> {
  const response = await fetch("/api/agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const payload: unknown = await response.json();

  if (!response.ok) {
    const message = getErrorMessage(payload);

    throw new Error(message);
  }

  return payload as AgentTaskResult;
}

function getErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Agent request failed";
  }

  const candidate = payload as { error?: unknown };

  return typeof candidate.error === "string" ? candidate.error : "Agent request failed";
}
