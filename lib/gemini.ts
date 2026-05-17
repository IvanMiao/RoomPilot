import type { EvidenceMoment, RankedMoment } from "@/types/agent";
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

export async function rankMomentsWithGemini(
  goal: string,
  moments: EvidenceMoment[]
): Promise<GeminiAgentResponse> {
  const apiKey = getRequiredEnv("GEMINI_API_KEY");
  const model = getOptionalEnv("GEMINI_MODEL") ?? "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildRankingPrompt(goal, moments),
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Gemini request failed");
  }

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

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

  return typeof candidate.summary === "string" && Array.isArray(candidate.decisions);
}
