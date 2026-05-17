# RoomPilot Project Review

## Current State

RoomPilot is currently a clear hackathon skeleton, not yet a full production workflow.

The current path is:

```txt
UI -> /api/agent -> lib/agent.ts -> lib/videodb.ts demo moments -> lib/gemini.ts ranking -> UI
```

The project structure is small and readable:

- `app/` contains the Next.js app and API route.
- `features/agent/` contains the agent UI and client API wrapper.
- `lib/agent.ts` orchestrates retrieval, ranking, and reel planning.
- `lib/gemini.ts` contains the Gemini adapter.
- `lib/videodb.ts` is the VideoDB boundary, but currently returns demo data.
- `types/agent.ts` defines the shared agent contract.

`npm run typecheck` passes.

`npm run lint` currently fails because ESLint scans generated `.next/` files and `next-env.d.ts`. The failures are mostly generated-code noise, not business-code issues. This should be fixed first so lint becomes a useful quality gate.

## Main Judgment

The current implementation is good enough to demonstrate the idea, but the real product value depends on replacing the demo data path with a real media pipeline:

1. ingest a video
2. index audio and visual evidence
3. retrieve timestamped moments
4. rank evidence against a user goal
5. generate an answer, proof list, or reel plan

The main technical risks are:

- `lib/videodb.ts` is still a stub.
- Gemini output validation is too loose.
- `mode` exists in the API contract but does not yet create meaningfully different behavior.
- `/api/agent` is simple and demo-friendly, but too thin for upload, indexing, async runs, retries, and clip generation.
- Lint is not yet a reliable signal because generated files are included.

## Recommended Steps And Acceptance Criteria

### 1. Fix The Engineering Baseline

Update ESLint configuration so generated files are ignored.

Suggested ignores:

- `.next/**`
- `node_modules/**`
- `next-env.d.ts`
- `*.tsbuildinfo`

Acceptance criteria:

- `npm run typecheck` passes.
- `npm run lint` passes.
- Lint output only reflects source files owned by this project.

### 2. Stabilize The Agent API Contract

Status: implemented.

The current request is now task-shaped and can grow without replacing the core endpoint.

```ts
interface AgentTaskRequest {
  input: {
    type: "video_url" | "video_asset";
    value: string;
  };
  goal: string;
  mode: AgentMode;
  options?: {
    maxMoments?: number;
    clipLengthSeconds?: number;
    includeAudioEvidence?: boolean;
    includeVisualEvidence?: boolean;
  };
}
```

Acceptance criteria:

- Invalid input is rejected at the API boundary.
- `goal` and `mode` are validated before any provider call.
- Future options can be added without changing the whole flow.
- UI and server use the same named TypeScript types.

### 3. Replace The VideoDB Stub

Status: implemented.

`lib/videodb.ts` now uses the VideoDB Node SDK when `VIDEODB_API_KEY` is configured. Without a key, it still returns deterministic demo moments for local development.

The implementation keeps VideoDB-specific details inside `lib/videodb.ts` and returns the project-owned `EvidenceMoment[]` type.

Acceptance criteria:

- A real video URL can be ingested or referenced.
- Audio and visual evidence are indexed or searched.
- Returned moments include:
  - `id`
  - `title`
  - `startSeconds`
  - `endSeconds`
  - `quote`
  - `screenSummary`
  - `source`
  - `score`
  - `streamUrl`
- VideoDB SDK or API-specific response shapes do not leak into React components.

### 4. Strengthen Gemini Output Validation

Status: implemented.

`lib/gemini.ts` currently checks only that the response has a string `summary` and an array `decisions`.

It should validate every decision:

- `id` is a string.
- `action` is one of the allowed `AgentAction` values.
- `rationale` is a string.
- `kept` is a boolean.

Acceptance criteria:

- Invalid JSON fails with a clear error.
- Missing fields fail with a clear error.
- Unknown actions fail with a clear error.
- The app never sends malformed Gemini output directly to the UI.

### 5. Make `mode` Meaningful

Status: implemented.

The app currently supports these modes:

- `answer`
- `rank_moments`
- `generate_reel`
- `find_strongest_proof`

However, the ranking prompt and result shaping do not yet make these modes meaningfully different.

Acceptance criteria:

- `answer` produces a concise answer with supporting moments.
- `rank_moments` returns ranked evidence with clear selection rationale.
- `generate_reel` prioritizes clips and produces a non-empty `reelPlan` when evidence supports it.
- `find_strongest_proof` filters aggressively and keeps only high-confidence evidence.

### 6. Improve The Frontend Workflow

The current UI supports a single run and result display. It does not yet feel like a real video evidence workflow.

Suggested additions:

- video preview
- timestamp click-to-play behavior
- loading states for ingest, retrieval, ranking, and reel planning
- clearer empty state for no strong evidence
- visible distinction between kept and ignored moments

Acceptance criteria:

- A user can provide a video and goal, run the agent, and inspect timestamped evidence.
- Moment cards make quote, screen context, timestamp, and action easy to scan.
- Reel plan appears only when clips are actually selected.
- Error states are specific enough to tell whether the issue is input, VideoDB, Gemini, or network-related.

### 7. Add Focused Tests

Start with low-cost tests around pure logic and validation.

Priority test areas:

- API request parsing
- Gemini response parsing
- reel plan generation
- mode-specific behavior
- local demo fallback

Acceptance criteria:

- Bad requests are covered.
- Invalid Gemini responses are covered.
- Empty or weak evidence cases are covered.
- `buildReelPlan` behavior is covered for clip and non-clip moments.

## Gemini Package Assessment

Gemini can be used through an official Node package.

The current project uses a hand-written REST adapter in `lib/gemini.ts`. This is acceptable for a minimal demo, but the official SDK is better for the next phase.

Recommended package:

```bash
npm install @google/genai
```

Official documentation shows Node usage like:

```ts
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

Why the SDK is preferable:

- less manual response parsing boilerplate
- clearer support for streaming
- easier file upload and multimodal inputs
- better fit for structured output configuration
- easier future switch between Gemini API and Vertex AI style usage

REST is still valid for the current adapter, but the SDK is more maintainable once the project needs streaming, tool calls, uploaded files, or richer structured outputs.

References:

- Gemini API generate content docs: https://ai.google.dev/api/generate-content
- Vertex AI structured output docs: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output

## REST API Assessment

The current REST interface is not wrong, but it is too simple for the intended product.

The issue is not REST itself. The issue is that `/api/agent` currently combines too many future responsibilities into one synchronous call:

- video input
- ingest
- indexing
- retrieval
- ranking
- answering
- reel planning
- future clip generation

This is fine for a hackathon demo, but it will be hard to extend once real media processing is asynchronous.

Recommended evolution:

```txt
POST /api/videos
POST /api/agent-runs
GET  /api/agent-runs/:id
POST /api/reels
```

Suggested responsibility split:

- `POST /api/videos`: register or upload a video.
- `POST /api/agent-runs`: start an agent task for a video and goal.
- `GET /api/agent-runs/:id`: poll status and fetch result.
- `POST /api/reels`: generate a reel from selected moments.

Acceptance criteria for API evolution:

- Long-running media processing does not block a single request forever.
- UI can show task status.
- Failed ingest, failed retrieval, failed ranking, and failed reel generation can be reported separately.
- The contract can support retries and partial results.

## Suggested Priority Order

1. Fix lint configuration.
2. Strengthen request and Gemini response validation.
3. Make `mode` behavior explicit.
4. Replace `lib/videodb.ts` demo moments with real VideoDB integration.
5. Add video preview and timestamp playback behavior.
6. Introduce async task endpoints if real ingest or reel generation takes more than a few seconds.
7. Add focused tests around validation and pure logic.

## Definition Of A Strong MVP

RoomPilot should be considered MVP-ready when:

- A user can provide a real product demo video.
- The system retrieves timestamped audio and visual evidence.
- Gemini ranks evidence against the user's goal.
- The UI shows quote, screen context, timestamp, rationale, and action.
- Weak evidence can be rejected, not just displayed.
- A reel plan can be generated from selected clips.
- Typecheck and lint pass consistently.
- Demo fallback still works without API keys.
