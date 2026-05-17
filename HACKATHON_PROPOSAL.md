# RoomPilot Hackathon Proposal

## Project

**RoomPilot** is an AI agent for product demos and high-value conversations.

For the VideoDB hackathon version, the input does **not** need a person on camera. The primary input can be:

- a product walkthrough video
- a screen recording of a web interface
- a narrated demo uploaded as MP4 or shared as a public URL

The core idea is simple:

1. ingest a product demo video
2. index both the narration and the interface shown on screen
3. let the agent observe and retrieve relevant moments
4. let the agent decide which moments matter
5. generate evidence-backed next moves and short highlight clips

This keeps the original idea of "quote-backed next move", but upgrades it to fit VideoDB's `see -> understand -> act` framing.

## Agent Definition

RoomPilot should be presented as an **AI agent**, not just a search interface.

The agent has a clear job:

- watch narrated product demos
- remember what was said and what was shown
- retrieve the best evidence for a user goal
- decide the next useful action
- produce an artifact such as a ranked answer set or highlight reel

### Agent Goal Examples

- "Find the three strongest moments for an investor demo."
- "Show me the clearest proof of our product value."
- "Build a 60-second highlight reel for this walkthrough."
- "Find where the speaker explains the action queue and show what is on screen."

### Agent Loop

The RoomPilot agent should follow a simple loop:

1. **Observe**
   - ingest the demo video
   - read audio and visual indexes from VideoDB
2. **Remember**
   - store retrieved moments as timestamped evidence
   - keep quote, screen context, and playback reference together
3. **Reason**
   - rank which moments best satisfy the user goal
   - reject weak or low-evidence moments
   - assign an action type
4. **Act**
   - answer the query
   - recommend a next move
   - generate clips or a short reel

This makes the project clearly agentic: the system is not only retrieving data, it is deciding what to keep, what to ignore, and what action to take.

## Why This Fits The Hackathon

The hackathon brief is centered on building something that "sees, hears & remembers" with the VideoDB SDK. A screen-recorded product demo fits that requirement well because it contains:

- visual evidence: the interface, page transitions, buttons, dashboards, cards
- audio evidence: the narrator explaining the feature or workflow
- memory value: the ability to find exact moments later instead of rewatching the full video

This is stronger than a plain transcript assistant because the system can answer questions like:

- "When the speaker mentions memory graph, what is shown on screen?"
- "Find the clip where action cards appear."
- "Show the segment where follow-up queue is explained."
- "Create a 20-second reel of the three most important product moments."

## Product Direction

### Positioning

RoomPilot should be framed as:

**An AI agent that watches product demos, remembers what was said and shown, and turns the best moments into proof-backed actions.**

Not:

- a generic meeting summarizer
- a sales bot
- a chatbot on top of transcripts

The differentiator is that every recommendation is linked to:

- an exact quote
- an exact time range
- a visible screen context
- a playable clip

And every result is filtered through an agent decision:

- keep
- ignore
- save as proof
- use in demo
- add to reel

## User Flow

### Primary Flow

1. User uploads a product demo video or provides a public video URL.
2. User gives the agent a goal.
3. VideoDB ingests the media.
4. RoomPilot creates:
- spoken-word index
- visual/scene index
5. The agent retrieves relevant moments.
6. The agent ranks and filters them.
7. RoomPilot shows:
- transcript quote
- timestamp
- screen-context summary
- recommended next move
- optional related moments
8. The agent generates a short highlight reel from selected evidence.

### Example Queries

- "Where do we explain the value proposition most clearly?"
- "Find the moment where the action queue is visible."
- "What is on screen when the narrator says quote-backed next move?"
- "Generate the best 3 clips for a 60-second demo."

These are not plain search queries. They are agent tasks with an implied decision about quality and use.

## MVP Scope

### Must Have

- upload or URL ingest
- VideoDB audio index
- VideoDB visual index
- agent goal input
- natural-language search over indexed content
- ranking and filtering logic for moments
- UI showing evidence-backed moments
- one-click generation of a simple highlight reel

### Should Have

- "related past moments" or "similar moments" panel
- auto-generated suggested next move per retrieved moment
- lightweight scoring for "best demo moments"
- lightweight explanation of why a moment was selected or rejected

### Not Necessary For MVP

- live webcam capture
- speaker diarization perfection
- CRM integrations
- autonomous outbound messaging
- full real-time stream orchestration

## Agent System Design

### Inputs

The agent takes:

- a video asset
- a user goal
- an optional output mode

Example output modes:

- `answer`
- `rank moments`
- `generate reel`
- `find strongest proof`

### Internal Modules

The implementation can stay simple and still be honestly agentic.

#### 1. Perception Module

Responsibilities:

- upload or reference video in VideoDB
- trigger audio index creation
- trigger visual index creation

#### 2. Retrieval Module

Responsibilities:

- search audio evidence
- search visual evidence
- merge results
- normalize them into a common moment schema

Suggested moment schema:

- `start`
- `end`
- `quote`
- `screen_summary`
- `source`
- `score`
- `stream_url`

#### 3. Decision Module

Responsibilities:

- decide whether the evidence is strong enough
- rank moments against the user goal
- classify action type

Suggested action classes:

- `use_in_demo`
- `save_as_proof`
- `clip_for_pitch`
- `compare_later`
- `ignore`

#### 4. Action Module

Responsibilities:

- produce a final ranked response
- produce rationale for selected moments
- create a highlight reel when requested

This is the module that makes the system feel like an agent instead of a search layer.

## Recommended Technical Stack

### Frontend

- **Next.js** for fast demoable full-stack delivery
- **React** for the search, playback, and evidence UI
- **Tailwind CSS** for quick iteration on the interface

Why:

- fast local development
- API routes available without a separate backend deployment
- easy to ship one cohesive repo for judging

### Backend

- **Next.js route handlers** or a small **Node.js/Express** service
- **VideoDB Node SDK** for ingest, indexing, search, and stream generation
- **Gemini API** for ranking, action selection, and evidence summarization

Why:

- the official VideoDB Node SDK is a strong fit for this project
- your earlier prototype already leans toward JS/Node
- staying in one language reduces hackathon risk

### Agent Runtime

- keep the agent runtime simple
- no need for a heavy multi-agent framework
- use plain server-side orchestration first

Why:

- the hackathon requirement is to build an AI agent, not to demonstrate framework complexity
- the strongest proof is a working observe/reason/act loop over media

### Storage

- start with **no database requirement**
- keep derived metadata in memory or JSON during MVP
- optionally add **SQLite** or **Supabase** only if you need persistent project records

Why:

- database work is not on the critical path
- VideoDB already acts as the core media memory layer

### Playback

- use VideoDB generated stream/player URLs
- embed playable evidence directly in the app

### Optional Add-ons

- **Vercel** for deployment
- **Sentry** only if debugging becomes painful
- **PostHog** only if you want lightweight product analytics, but not needed for judging

## VideoDB Architecture Fit

### Ingest

Use VideoDB to upload:

- MP4 product walkthroughs
- YouTube demo links
- public media URLs

### Understand

Build two indexes:

- **audio/spoken-word index**
  - for narration, claims, feature explanations, value props
- **visual/scene index**
  - for page states, UI transitions, cards, tables, dashboards, buttons

### Act

Use the retrieved moments to:

- answer natural-language questions
- present exact evidence
- create short highlight reels from selected segments
- generate a recommended next move

This is the key point: the "act" layer should not just be text output. It should produce a useful media artifact or a concrete recommended action.

## Retrieval And Reasoning Design

### Retrieval Layer

For each agent task:

1. search the audio index
2. search the visual index
3. merge and rerank by relevance
4. return the best moments with timestamps

### Reasoning Layer

After retrieval, use an LLM to produce:

- one-sentence explanation of why this moment matters
- exact supporting quote
- visible screen context summary
- suggested next move
- keep/reject decision

### Decision Policy

The agent should explicitly decide:

- whether a moment is strong enough to keep
- whether it is useful for the current goal
- which action type is most appropriate

A weak retrieval result should not automatically become a final card. 

### Suggested Next Move Types

- `Use in demo`
- `Save as proof`
- `Compare with another moment`
- `Clip for pitch`
- `Follow up later`

This preserves the product spirit while keeping the output lightweight and legible.

## UI Recommendation

The interface should not feel like a generic chat app.

### Suggested Layout

- top: agent goal input
- left: uploaded video list or current asset
- center: search box + results timeline
- right: evidence panel

Each result card should show:

- title or inferred moment label
- quote
- screen-context summary
- start/end timestamp
- selected action type
- why the agent kept this moment
- buttons: `Play`, `Save`, `Add to Reel`

### Visual Direction

Aim for a clean but editorial feel:

- large timeline moments
- visible quote blocks
- subdued background
- strong contrast for evidence cards

The UI should visually communicate "proof" rather than "assistant chat."

## Demo Narrative

### Best Demo Scenario

Use a narrated product walkthrough video of the RoomPilot concept itself.

That gives you a self-referential but very effective demo:

1. upload a demo video of the RoomPilot interface
2. search for key ideas in that demo
3. jump to exact visual evidence
4. auto-build a short highlight reel

### 90-Second Demo Script

1. "Teams record product walkthroughs and internal demos, but later nobody remembers the exact best moment."
2. "We upload a narrated interface demo into RoomPilot and give the agent a goal: find the strongest proof for our product value."
3. "VideoDB indexes both the speech and what appears on screen."
4. "The agent retrieves candidate moments, ranks them, and keeps only the strongest evidence."
5. "Now I can inspect the exact timestamp, quote, and the screen that was visible."
6. "The agent recommends which moments to save and which ones to turn into clips."
7. "In one click, it creates a short proof-backed demo cut."

This directly demonstrates perception, memory, and action.

## Build Plan For The Remaining Time

### Phase 1

- scaffold Next.js app
- add upload form or URL ingest form
- add agent goal form
- connect VideoDB SDK
- store video id and indexing state

### Phase 2

- create audio and visual indexes
- build search endpoint
- return normalized search results
- add ranking input contract for the agent

### Phase 3

- build result cards with timestamps and playback
- add LLM-powered ranking, evidence summary, and next move

### Phase 4

- add clip selection
- generate a basic highlight reel
- write polished README and record demo

## Risks And Tradeoffs

### Risk 1: Real-time capture complexity

Decision:

- avoid making live capture the core dependency
- prefer uploaded or recorded demo videos first

Reason:

- lower operational risk
- faster path to a stable demo

### Risk 2: Weak visual indexing if the UI is too static

Decision:

- use a video with clear page transitions and UI states
- include narration tightly aligned with visual changes

### Risk 3: Overbuilding agent behavior

Decision:

- keep the agent output constrained to evidence-backed actions
- do not build broad autonomous workflows in MVP

## Final Recommendation

Build:

**RoomPilot Agent for Product Demos**

One-line pitch:

**Give an AI agent a narrated product demo and a goal, and it will find what was said and shown, rank the best evidence, and turn it into proof-backed clips and next moves.**

This version is:

- aligned with the hackathon brief
- realistic in 48 hours
- stronger than a transcript-only assistant
- easy to explain in a short demo video
- directly powered by VideoDB's core primitives
- clearly agentic instead of just searchable

## Concrete Stack Choice

If choosing one stack now, I would use:

- **Next.js**
- **React**
- **Tailwind CSS**
- **VideoDB Node SDK**
- **Gemini API**
- **Vercel** for deployment

And I would avoid adding:

- a heavy database
- a Python service
- complex real-time infra
- unnecessary third-party integrations

That stack is the best balance of speed, clarity, and demo reliability for this hackathon.
