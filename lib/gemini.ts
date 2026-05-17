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
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown JSON parse error";

    throw new Error(`Gemini response was not valid JSON: ${message}`);
  }

  return parseGeminiAgentResponseValue(parsed);
}

function parseGeminiAgentResponseValue(value: unknown): GeminiAgentResponse {
  if (!value || typeof value !== "object") {
    throw new Error("Gemini response must be a JSON object");
  }

  const candidate = value as Record<string, unknown>;
  const summary = parseRequiredString(candidate, "summary", "Gemini response");
  const decisions = parseDecisionArray(candidate.decisions);

  return { summary, decisions };
}

function parseDecisionArray(value: unknown): GeminiMomentDecision[] {
  if (!Array.isArray(value)) {
    throw new Error("Gemini response decisions must be an array");
  }

  return value.map(parseGeminiMomentDecision);
}

function parseGeminiMomentDecision(value: unknown, index: number): GeminiMomentDecision {
  const context = `Gemini response decisions[${index}]`;

  if (!value || typeof value !== "object") {
    throw new Error(`${context} must be an object`);
  }

  const candidate = value as Record<string, unknown>;
  const id = parseRequiredString(candidate, "id", context);
  const action = parseRequiredAction(candidate.action, context);
  const rationale = parseRequiredString(candidate, "rationale", context);
  const kept = parseRequiredBoolean(candidate, "kept", context);

  return { id, action, rationale, kept };
}

function parseRequiredString(
  value: Record<string, unknown>,
  fieldName: string,
  context: string
): string {
  const fieldValue = value[fieldName];

  if (typeof fieldValue !== "string") {
    throw new Error(`${context} field "${fieldName}" must be a string`);
  }

  return fieldValue;
}

function parseRequiredBoolean(
  value: Record<string, unknown>,
  fieldName: string,
  context: string
): boolean {
  const fieldValue = value[fieldName];

  if (typeof fieldValue !== "boolean") {
    throw new Error(`${context} field "${fieldName}" must be a boolean`);
  }

  return fieldValue;
}

function parseRequiredAction(value: unknown, context: string): RankedMoment["action"] {
  if (typeof value !== "string") {
    throw new Error(`${context} field "action" must be a string`);
  }

  if (!agentActions.has(value as AgentAction)) {
    throw new Error(`${context} field "action" has unknown value "${value}"`);
  }

  return value as RankedMoment["action"];
}
