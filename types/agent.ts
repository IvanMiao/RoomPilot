export type AgentAction =
  | "use_in_demo"
  | "save_as_proof"
  | "clip_for_pitch"
  | "compare_later"
  | "ignore";

export type MomentSource = "audio" | "visual" | "multimodal";

export type AgentMode = "answer" | "rank_moments" | "generate_reel" | "find_strongest_proof";

export interface AgentTaskRequest {
  assetUrl: string;
  goal: string;
  mode: AgentMode;
}

export interface EvidenceMoment {
  id: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  quote: string;
  screenSummary: string;
  source: MomentSource;
  score: number;
  streamUrl: string;
}

export interface RankedMoment extends EvidenceMoment {
  action: AgentAction;
  rationale: string;
  kept: boolean;
}

export interface AgentTaskResult {
  summary: string;
  moments: RankedMoment[];
  reelPlan: ReelClip[];
}

export interface ReelClip {
  momentId: string;
  startSeconds: number;
  endSeconds: number;
  reason: string;
}
