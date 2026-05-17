# RoomPilot Agent

RoomPilot is an AI agent for narrated product demo videos. It watches what was said and shown, ranks the strongest evidence moments, and prepares proof-backed actions such as demo clips and follow-up moments.

## Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Gemini API for agent ranking
- VideoDB service layer for media ingest, indexing, search, and future clip generation

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Create `.env.local` from `.env.example`.

```bash
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
VIDEODB_API_KEY=
VIDEODB_COLLECTION_ID=
```

Without `GEMINI_API_KEY`, the app runs in local demo mode with deterministic agent decisions.

## Current Skeleton

- `app/` contains the Next.js app and API route.
- `features/agent/` contains the agent workspace UI and client API.
- `lib/agent.ts` orchestrates retrieval, ranking, and reel planning.
- `lib/gemini.ts` contains the Gemini REST adapter.
- `lib/videodb.ts` is the VideoDB boundary to replace with real SDK calls.
- `types/agent.ts` defines the shared agent contract.
