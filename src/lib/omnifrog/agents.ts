/**
 * OmniFrog AI — PART 07: Individual Agent System.
 *
 * Exactly 36 focused agents. This registry contains responsibilities and
 * capability boundaries; execution/orchestration belongs to later parts.
 */
import type { CodingPlan, UiBlueprint } from "./types";

export type AgentRole =
  | "requirements" | "architecture" | "ui" | "ux" | "frontend" | "backend"
  | "database" | "api" | "auth" | "security" | "accessibility" | "responsive"
  | "typescript" | "javascript" | "react" | "css" | "html" | "testing"
  | "debugging" | "performance" | "seo" | "content" | "documentation"
  | "file-management" | "dependency" | "build" | "code-review" | "refactor"
  | "state-management" | "error-handling" | "integration" | "quality" | "release";

export interface AgentDefinition {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  responsibilities: string[];
  canModifyFiles: boolean;
}

export interface AgentTask {
  id: string;
  agentId: string;
  projectId: string;
  instruction: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PAUSED";
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export const AGENTS: readonly AgentDefinition[] = [
  ["requirements","Requirements Agent","requirements","Clarifies and structures the user's requested software behavior.",["extract requirements","identify constraints","define acceptance criteria"],false],
  ["architecture","Architecture Agent","architecture","Designs the high-level application structure.",["map modules","define boundaries","identify dependencies"],false],
  ["ui","UI Agent","ui","Translates the UI blueprint into implementation tasks.",["map screens","map components","preserve visual intent"],true],
  ["ux","UX Agent","ux","Plans interaction flows and usability details.",["interaction flow","empty states","feedback states"],true],
  ["frontend","Frontend Agent","frontend","Builds client-side application behavior.",["components","routing","client logic"],true],
  ["backend","Backend Agent","backend","Plans and implements server-side application logic.",["server logic","endpoints","validation"],true],
  ["database","Database Agent","database","Handles application data models and persistence design.",["schema planning","queries","data access"],true],
  ["api","API Agent","api","Integrates external and internal APIs.",["request mapping","response mapping","error handling"],true],
  ["auth","Auth Agent","auth","Handles authentication and authorization implementation boundaries.",["sessions","authorization","protected flows"],true],
  ["security","Security Agent","security","Reviews code and architecture for security risks.",["secret safety","input validation","access boundaries"],true],
  ["accessibility","Accessibility Agent","accessibility","Improves accessibility and semantic UI behavior.",["semantics","keyboard access","assistive labels"],true],
  ["responsive","Responsive Agent","responsive","Ensures mobile and desktop layout behavior.",["breakpoints","overflow control","touch layouts"],true],
  ["typescript","TypeScript Agent","typescript","Handles TypeScript typing and implementation quality.",["types","interfaces","strictness"],true],
  ["javascript","JavaScript Agent","javascript","Handles JavaScript implementation where needed.",["logic","async flows","browser APIs"],true],
  ["react","React Agent","react","Handles React-specific component implementation.",["components","hooks","rendering"],true],
  ["css","CSS Agent","css","Handles styling and layout implementation.",["styles","layout","responsive CSS"],true],
  ["html","HTML Agent","html","Handles semantic HTML structure.",["markup","metadata","semantics"],true],
  ["testing","Testing Agent","testing","Creates and evaluates test plans.",["test cases","regression checks","acceptance checks"],false],
  ["debugging","Debugging Agent","debugging","Analyzes reported implementation errors.",["error analysis","root-cause hypotheses","targeted fixes"],true],
  ["performance","Performance Agent","performance","Optimizes runtime and bundle behavior.",["bundle review","render performance","resource usage"],true],
  ["seo","SEO Agent","seo","Handles search metadata and crawl-friendly structure.",["metadata","structured content","indexability"],true],
  ["content","Content Agent","content","Creates application copy from supplied requirements.",["labels","empty states","help text"],true],
  ["documentation","Documentation Agent","documentation","Documents generated project structure and usage.",["README","implementation notes","handoff notes"],true],
  ["file-management","File Management Agent","file-management","Plans safe project file operations.",["create/update/delete plan","path checks","file inventory"],true],
  ["dependency","Dependency Agent","dependency","Reviews package needs and dependency changes.",["dependency selection","version constraints","unused dependency review"],true],
  ["build","Build Agent","build","Prepares build configuration and build tasks.",["build scripts","configuration","build diagnostics"],true],
  ["code-review","Code Review Agent","code-review","Reviews proposed code changes before acceptance.",["diff review","risk detection","maintainability"],false],
  ["refactor","Refactor Agent","refactor","Improves structure without changing intended behavior.",["duplication removal","module boundaries","safe refactors"],true],
  ["state-management","State Management Agent","state-management","Handles client/server state flow.",["state model","loading states","cache boundaries"],true],
  ["error-handling","Error Handling Agent","error-handling","Standardizes user-safe and developer-useful error flows.",["error taxonomy","fallback UI","safe messages"],true],
  ["integration","Integration Agent","integration","Connects completed modules while respecting existing contracts.",["integration wiring","contract checks","compatibility"],true],
  ["quality","Quality Agent","quality","Checks implementation against project requirements.",["acceptance criteria","consistency","regression risks"],false],
  ["release","Release Agent","release","Prepares a release handoff without deploying.",["release checklist","version notes","handoff state"],false],
].map(([id,name,role,description,responsibilities,canModifyFiles]) => ({id,name,role:role as AgentRole,description,responsibilities:responsibilities as string[],canModifyFiles}));

export function getAgent(agentId: string): AgentDefinition | null {
  return AGENTS.find((agent) => agent.id === agentId) ?? null;
}

export function listAgents(): readonly AgentDefinition[] {
  return AGENTS;
}

export function createAgentTask(input: {
  agentId: string;
  projectId: string;
  instruction: string;
  context?: { blueprint?: UiBlueprint; codingPlan?: CodingPlan };
}): AgentTask {
  const agent = getAgent(input.agentId);
  if (!agent) throw new Error("Unknown agent.");
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    agentId: agent.id,
    projectId: input.projectId,
    instruction: input.instruction.trim(),
    status: "PENDING",
    input: {
      instruction: input.instruction.trim(),
      blueprint: input.context?.blueprint ?? null,
      codingPlan: input.context?.codingPlan ?? null,
    },
    output: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  };
}
