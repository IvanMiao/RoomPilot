"use client";

import { Film, LoaderCircle, Play, Scissors, Search } from "lucide-react";
import { useState } from "react";
import { runAgentTask } from "@/features/agent/agentApi";
import type { AgentMode, AgentTaskResult, RankedMoment } from "@/types/agent";

const initialAssetUrl = "https://example.com/roompilot-demo.mp4";
const initialGoal = "Find the strongest proof moments for a 60-second product demo.";

export function AgentWorkspace() {
  const [assetUrl, setAssetUrl] = useState(initialAssetUrl);
  const [goal, setGoal] = useState(initialGoal);
  const [mode, setMode] = useState<AgentMode>("find_strongest_proof");
  const [result, setResult] = useState<AgentTaskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function handleRunAgent() {
    setIsRunning(true);
    setError(null);

    try {
      const nextResult = await runAgentTask({
        input: {
          type: "video_url",
          value: assetUrl,
        },
        goal,
        mode,
      });
      setResult(nextResult);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Agent task failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-6 lg:px-8">
        <header className="grid gap-4 border-b border-line pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rust">
              RoomPilot Agent
            </p>
            <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-tight text-ink md:text-5xl">
              Watches product demos, ranks evidence, and builds proof-backed clips.
            </h1>
          </div>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-paper transition hover:bg-moss disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isRunning}
            onClick={handleRunAgent}
            type="button"
          >
            {isRunning ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
            Run Agent
          </button>
        </header>

        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <AgentControlPanel
            assetUrl={assetUrl}
            goal={goal}
            mode={mode}
            setAssetUrl={setAssetUrl}
            setGoal={setGoal}
            setMode={setMode}
          />

          <div className="grid gap-5">
            {error ? <ErrorPanel message={error} /> : null}
            <ResultPanel result={result} />
          </div>
        </section>
      </section>
    </main>
  );
}

interface AgentControlPanelProps {
  assetUrl: string;
  goal: string;
  mode: AgentMode;
  setAssetUrl: (value: string) => void;
  setGoal: (value: string) => void;
  setMode: (value: AgentMode) => void;
}

function AgentControlPanel(props: AgentControlPanelProps) {
  return (
    <aside className="h-fit rounded-md border border-line bg-white/60 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Film className="size-4 text-steel" />
        Agent Task
      </div>

      <label className="mt-5 block text-sm font-medium text-ink" htmlFor="asset-url">
        Video URL
      </label>
      <input
        className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-steel"
        id="asset-url"
        onChange={(event) => props.setAssetUrl(event.target.value)}
        value={props.assetUrl}
      />

      <label className="mt-5 block text-sm font-medium text-ink" htmlFor="agent-goal">
        Agent goal
      </label>
      <textarea
        className="mt-2 min-h-28 w-full resize-none rounded-md border border-line bg-white p-3 text-sm leading-6 outline-none focus:border-steel"
        id="agent-goal"
        onChange={(event) => props.setGoal(event.target.value)}
        value={props.goal}
      />

      <label className="mt-5 block text-sm font-medium text-ink" htmlFor="agent-mode">
        Output mode
      </label>
      <select
        className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-steel"
        id="agent-mode"
        onChange={(event) => props.setMode(event.target.value as AgentMode)}
        value={props.mode}
      >
        <option value="find_strongest_proof">Find strongest proof</option>
        <option value="rank_moments">Rank moments</option>
        <option value="generate_reel">Generate reel</option>
        <option value="answer">Answer</option>
      </select>
    </aside>
  );
}

function ResultPanel({ result }: { result: AgentTaskResult | null }) {
  if (!result) {
    return (
      <section className="grid min-h-[460px] place-items-center rounded-md border border-dashed border-line bg-white/40 p-8 text-center">
        <div className="max-w-md">
          <Play className="mx-auto size-9 text-steel" />
          <h2 className="mt-4 text-2xl font-semibold text-ink">No agent run yet</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">
            Add a demo video URL, define the goal, and run the agent to produce ranked evidence.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-5">
      <div className="rounded-md border border-line bg-white/70 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-steel">Agent summary</p>
        <p className="mt-3 text-lg leading-7 text-ink">{result.summary}</p>
      </div>

      <div className="grid gap-4">
        {result.moments.map((moment) => (
          <MomentCard key={moment.id} moment={moment} />
        ))}
      </div>

      <ReelPlan result={result} />
    </section>
  );
}

function MomentCard({ moment }: { moment: RankedMoment }) {
  return (
    <article className="rounded-md border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rust">
            {formatTimestamp(moment.startSeconds)} - {formatTimestamp(moment.endSeconds)}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-ink">{moment.title}</h3>
        </div>
        <span className="rounded-md border border-line px-3 py-1 text-xs font-semibold text-moss">
          {formatAction(moment.action)}
        </span>
      </div>

      <blockquote className="mt-4 border-l-4 border-rust pl-4 text-base leading-7 text-ink">
        {moment.quote}
      </blockquote>
      <p className="mt-4 text-sm leading-6 text-ink/70">{moment.screenSummary}</p>
      <p className="mt-3 text-sm leading-6 text-ink/70">{moment.rationale}</p>
    </article>
  );
}

function ReelPlan({ result }: { result: AgentTaskResult }) {
  if (result.reelPlan.length === 0) {
    return null;
  }

  return (
    <section className="rounded-md border border-line bg-ink p-5 text-paper">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Scissors className="size-4 text-rust" />
        Reel plan
      </div>
      <div className="mt-4 grid gap-3">
        {result.reelPlan.map((clip) => (
          <p className="text-sm leading-6 text-paper/80" key={clip.momentId}>
            {formatTimestamp(clip.startSeconds)} - {formatTimestamp(clip.endSeconds)}: {clip.reason}
          </p>
        ))}
      </div>
    </section>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <section className="rounded-md border border-rust bg-white p-4 text-sm font-medium text-rust">
      {message}
    </section>
  );
}

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatAction(action: RankedMoment["action"]): string {
  return action.replaceAll("_", " ");
}
