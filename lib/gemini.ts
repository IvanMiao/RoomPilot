import { GoogleGenAI } from "@google/genai";
import type { AgentAction, EvidenceMoment, RankedMoment } from "@/types/agent";
import { getOptionalEnv, getRequiredEnv } from "@/lib/env";

interface GeminiMomentDecision {
  id: string;
  action: RankedMoment["action"];
  rationale: string;
  kept: boolean;
}

interface GeminiAgentResponse {
  summary: string;
  decisions: GeminiMomentDecision[];
}

const agentActions = new Set<AgentAction>([
  "use_in_demo",
  "save_as_proof",
  "clip_for_pitch",
  "compare_later",
  "ignore",
]);

const geminiAgentResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "decisions"],
  properties: {
    summary: {
      type: "string",
    },
    decisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "action", "rationale", "kept"],
        properties: {
          id: {
            type: "string",
          },
          action: {
            type: "string",
            enum: ["use_in_demo", "save_as_proof", "clip_for_pitch", "compare_later", "ignore"],
          },
          rationale: {
            type: "string",
          },
          kept: {
            type: "boolean",
          },
        },
      },
    },
  },
} as const;

export async function rankMomentsWithGemini(
  goal: string,
  moments: EvidenceMoment[]
): Promise<GeminiAgentResponse> {
  const apiKey = getRequiredEnv("GEMINI_API_KEY");
  const model = getOptionalEnv("GEMINI_MODEL") ?? "gemini-2.5-flash";
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: buildRankingPrompt(goal, moments),
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: geminiAgentResponseSchema,
    },
  });

  const text = response.text;

  if (typeof text !== "string") {
    throw new Error("Gemini response did not include text output");
  }

  return parseGeminiAgentResponse(text);
}

function buildRankingPrompt(goal: string, moments: EvidenceMoment[]): string {
  return [
    "You are RoomPilot, an AI agent for narrated product demos.",
    "Rank evidence moments against the user goal.",
    "Keep only moments with strong evidence. Mark weak moments as kept=false.",
    "Return strict JSON with this shape:",
    '{"summary":"string","decisions":[{"id":"string","action":"use_in_demo|save_as_proof|clip_for_pitch|compare_later|ignore","rationale":"string","kept":true}]}',
    "",
    `User goal: ${goal}`,
    "",
    `Candidate moments: ${JSON.stringify(moments)}`,
  ].join("\n");
}

function parseGeminiAgentResponse(text: string): GeminiAgentResponse {
  const parsed: unknown = JSON.parse(text);

  if (!isGeminiAgentResponse(parsed)) {
    throw new Error("Gemini response did not match the expected agent shape");
  }

  return parsed;
}

function isGeminiAgentResponse(value: unknown): value is GeminiAgentResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<GeminiAgentResponse>;

  return (
    typeof candidate.summary === "string" &&
    Array.isArray(candidate.decisions) &&
    candidate.decisions.every(isGeminiMomentDecision)
  );
}

function isGeminiMomentDecision(value: unknown): value is GeminiMomentDecision {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<GeminiMomentDecision>;

  return (
    typeof candidate.id === "string" &&
    isAgentAction(candidate.action) &&
    typeof candidate.rationale === "string" &&
    typeof candidate.kept === "boolean"
  );
}

function isAgentAction(value: unknown): value is RankedMoment["action"] {
  return typeof value === "string" && agentActions.has(value as AgentAction);
}
