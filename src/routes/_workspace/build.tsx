import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Bot, CheckCircle2, ChevronRight, Eraser, FileCode2, ListChecks, Loader2, MessageSquare, Plan, Send, Sparkles, XCircle } from "lucide-react";

import { BuildProcessConsole } from "@/components/omnifrog/build-process-console";
import { StatusBadge } from "@/components/omnifrog/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createBuildRequest, runBuildTestRepair, saveUiBlueprint } from "@/lib/projects.functions";
import { generateUiBlueprint } from "@/lib/omnifrog/ui-generation";
import { generateCodingPlan } from "@/lib/omnifrog/coding-engine";
import { addProjectMemory, getProjectMemory } from "@/lib/memory.functions";
import { runParallelAgentsFn } from "@/lib/omnifrog/parallel-agents.functions";
import { AGENTS } from "@/lib/omnifrog/agents";
import { runWorkspaceAi } from "@/lib/ai-workspace.functions";
import { projectQuery } from "@/lib/omnifrog/queries";
import type { ActivityEvent, BuildState, GeneratedFile } from "@/lib/omnifrog/types";

export const Route = createFileRoute("/_workspace/build")({
  head: () => ({ meta: [
    { title: "OmniFrog AI — Build Workspace" },
    { name: "description", content: "Chat, plan and build software with OmniFrog AI." },
  ] }),
  component: BuildScreen,
});

type Mode = "build" | "chat" | "plan";
type Message = { id: string; role: "user" | "assistant" | "system"; text: string; mode?: Mode; source?: string; files?: GeneratedFile[] };

function localEvent(id: string, level: ActivityEvent["level"], message: string, operation: string): ActivityEvent {
  return { id, projectId: "", level, message, agentId: null, agentName: null, filePath: null, operation, provider: null, model: null, details: {}, createdAt: new Date().toISOString() };
}

function BuildScreen() {
  const submit = useServerFn(createBuildRequest);
  const saveBlueprint = useServerFn(saveUiBlueprint);
  const saveMemory = useServerFn(addProjectMemory);
  const loadMemory = useServerFn(getProjectMemory);
  const runAgents = useServerFn(runParallelAgentsFn);
  const runPipeline = useServerFn(runBuildTestRepair);
  const workspaceAi = useServerFn(runWorkspaceAi);
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [mode, setMode] = useState<Mode>("build");
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<BuildState>("IDLE");
  const [messages, setMessages] = useState<Message[]>([]);
  const [localEvents, setLocalEvents] = useState<ActivityEvent[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [planText, setPlanText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [planReady, setPlanReady] = useState(false);

  const project = useQuery({
    ...projectQuery(projectId ?? ""),
    enabled: Boolean(projectId),
    refetchInterval: projectId && sending ? 1000 : 2500,
  });

  const remoteEvents = project.data?.activity ?? [];
  const events = useMemo(() => {
    const map = new Map<string, ActivityEvent>();
    for (const event of [...remoteEvents, ...localEvents]) map.set(event.id, event);
    return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [remoteEvents, localEvents]);

  const busy = sending || ["UNDERSTANDING", "PLANNING", "BUILDING", "TESTING", "FIXING"].includes(state);

  function addMessage(message: Message) {
    setMessages((current) => [...current, message]);
  }

  async function runBuildRequest(request: string, sourceMode: "build" | "plan") {
    const clean = request.trim();
    if (clean.length < 3 || busy) return;
    setSending(true);
    setError(null);
    setPlanReady(false);
    setProjectId(null);
    setGeneratedFiles([]);
    setState("UNDERSTANDING");
    setLocalEvents([localEvent("request-received", "done", "Request received", "request.receive")]);
    addMessage({ id: crypto.randomUUID(), role: "user", text: clean, mode: sourceMode });

    try {
      const created = await submit({ data: { request: clean } });
      if (!created.ok) throw new Error(created.error.message);

      setProjectId(created.projectId);
      await saveMemory({ data: { id: created.projectId, kind: "requirement", title: "Original build request", content: clean, source: "build-request", importance: 100 } });
      const memoryState = await loadMemory({ data: { id: created.projectId } });
      const memoryContext = (memoryState.summary ? "Project memory summary:\n" + memoryState.summary + "\n\n" : "") +
        memoryState.items.slice(0, 24).map((item) => "[" + item.kind + "] " + item.title + "\n" + item.content).join("\n\n");
      const requestWithMemory = memoryContext ? clean + "\n\nPROJECT MEMORY — preserve these existing decisions and constraints:\n" + memoryContext : clean;

      setState("PLANNING");
      setLocalEvents((current) => [...current, localEvent("project-stored", "done", "Project request stored", "project.create"), localEvent("ui-plan", "active", "Generating UI architecture blueprint", "ui.blueprint.generate")]);

      const blueprint = await generateUiBlueprint({
        request: requestWithMemory,
        onProgress: (progress) => setLocalEvents((current) => [
          ...current.filter((e) => e.id !== "ui-progress"),
          localEvent("ui-progress", "active", progress.text || "Planning UI…", "ui.blueprint.progress"),
        ]),
      });
      if (!blueprint.ok || !blueprint.blueprint) throw new Error(blueprint.error ?? "UI blueprint generation failed.");
      await saveBlueprint({ data: { id: created.projectId, blueprint: blueprint.blueprint, source: blueprint.source } });

      setState("BUILDING");
      setLocalEvents((current) => [...current.filter((e) => e.id !== "ui-progress"), localEvent("ui-complete", "done", "UI blueprint generated and validated", "ui.blueprint.complete"), localEvent("coding-start", "active", "Generating project source files", "coding.plan.start")]);

      const coding = await generateCodingPlan({
        request: requestWithMemory,
        blueprint: blueprint.blueprint,
        onProgress: (progress) => setLocalEvents((current) => [
          ...current.filter((e) => e.id !== "coding-progress"),
          localEvent("coding-progress", "active", progress.text || "Generating source files…", "coding.plan.progress"),
        ]),
      });
      if (!coding.ok || !coding.plan) throw new Error(coding.error ?? "Coding engine could not generate source code.");

      setGeneratedFiles(coding.plan.files);
      setLocalEvents((current) => [
        ...current.filter((e) => e.id !== "coding-progress"),
        localEvent("coding-complete", "done", "Coding engine produced validated file operations", "coding.plan.complete"),
      ]);

      const agentTasks = AGENTS.map((agent) => ({
        agentId: agent.id,
        instruction:
          "Review this software build request and the generated coding plan from your specialist role. Identify concrete requirements, risks, corrections, validation checks, or implementation actions. Do not claim you changed files. Build request:\n" +
          clean.slice(0, 40_000) +
          "\n\nCoding plan summary:\n" + coding.plan!.summary.slice(0, 8_000),
      }));

      setLocalEvents((current) => [...current, localEvent("agents-start", "active", "Launching all 36 specialist agents in parallel", "agents.parallel.start")]);
      const agentResult = await runAgents({ data: { projectId: created.projectId, tasks: agentTasks } });
      setLocalEvents((current) => [
        ...current,
        localEvent("agents-complete", agentResult.failed === 0 ? "done" : "warning", `36-agent parallel pass finished: ${agentResult.completed} succeeded, ${agentResult.failed} failed`, "agents.parallel.complete"),
      ]);

      setState("TESTING");
      setLocalEvents((current) => [...current, localEvent("pipeline", "active", "Testing generated files and repairing detected bugs", "build.pipeline.start")]);
      const pipeline = await runPipeline({
        data: { id: created.projectId, request: requestWithMemory, changes: coding.plan.files, maxRepairAttempts: 3 },
      });
      if (!pipeline.ok || !pipeline.report.passed) {
        setState("FAILED");
        throw new Error(pipeline.report.checks.filter((check) => check.severity === "error").map((check) => check.message).join(" ") || "Build validation failed.");
      }

      setState("COMPLETED");
      setPlanReady(false);
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        text: `Build completed successfully. Generated ${coding.plan.files.length} validated file operation(s). The 36-agent parallel review finished with ${agentResult.failed} failure(s), and the build/test/repair pipeline passed.`,
        mode: "build",
        source: coding.source,
        files: coding.plan.files,
      });
      setLocalEvents((current) => [...current, localEvent("build-complete", "done", "Build, test and repair pipeline completed", "build.pipeline.complete")]);
      await queryClient.invalidateQueries({ queryKey: ["omnifrog"] });
    } catch (cause) {
      setState("FAILED");
      const message = cause instanceof Error ? cause.message : "OmniFrog could not complete this request.";
      setError(message);
      addMessage({ id: crypto.randomUUID(), role: "system", text: message, mode: "build" });
      setLocalEvents((current) => [...current, localEvent("build-failed", "error", message, "build.failed")]);
    } finally {
      setSending(false);
    }
  }

  async function sendMessage() {
    const clean = prompt.trim();
    if (!clean || sending) return;
    if (mode === "build") {
      await runBuildRequest(clean, "build");
      return;
    }

    setSending(true);
    setError(null);
    addMessage({ id: crypto.randomUUID(), role: "user", text: clean, mode });
    setPrompt("");
    try {
      const context = planText ?? (project.data?.project.request ?? "");
      const result = await workspaceAi({ data: { mode, message: clean, context } });
      if (!result.ok || !result.text) throw new Error(result.error ?? "AI did not return a response.");
      addMessage({ id: crypto.randomUUID(), role: "assistant", text: result.text, mode, source: result.source });
      if (mode === "plan") {
        setPlanText(result.text);
        setPlanReady(true);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "AI response failed.";
      setError(message);
      addMessage({ id: crypto.randomUUID(), role: "system", text: message, mode });
    } finally {
      setSending(false);
    }
  }

  function buildPlan() {
    if (!planText || busy) return;
    void runBuildRequest(
      "Implement the following approved plan exactly, preserving the user's original requirements.\n\n" + planText,
      "plan",
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] w-full flex-col gap-3">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">OmniFrog AI Workspace</h1>
          <p className="text-xs text-muted-foreground">Chat, plan first, or build directly. All activity is shown below.</p>
        </div>
        {projectId ? <Button asChild variant="outline" size="sm"><Link to="/projects/$projectId" params={{ projectId }}>Open project <ArrowRight className="size-3.5" /></Link></Button> : null}
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-background/70 shadow-sm">
        <div className="flex shrink-0 border-b bg-background/90 p-2 backdrop-blur">
          {([
            ["build", "Build", Sparkles],
            ["chat", "Chat", MessageSquare],
            ["plan", "Plan", ListChecks],
          ] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => { setMode(value); setError(null); }}
              className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition ${mode === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          {messages.length === 0 ? (
            <div className="flex min-h-[42vh] flex-col items-center justify-center text-center">
              <div className="rounded-2xl border bg-muted/40 p-4"><Bot className="size-7 text-primary" /></div>
              <h2 className="mt-4 text-lg font-semibold">
                {mode === "build" ? "Describe what you want to build" : mode === "plan" ? "Plan before you build" : "Chat with OmniFrog AI"}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {mode === "build"
                  ? "OmniFrog will plan the UI, generate real source files, run the 36-agent parallel review, test and repair the project, then show the full process."
                  : mode === "plan"
                    ? "Ask for an implementation plan. Nothing is changed until you choose Build this plan."
                    : "Ask questions, discuss architecture, debug ideas, or decide what to build."}
              </p>
            </div>
          ) : null}

          <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
            {messages.map((message) => (
              <div key={message.id} className={`rounded-2xl border p-3 sm:p-4 ${message.role === "user" ? "ml-4 bg-primary/5" : message.role === "system" ? "border-destructive/30 bg-destructive/5" : "mr-4 bg-muted/30"}`}>
                <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {message.role === "user" ? "You" : message.role === "assistant" ? "OmniFrog AI" : "System"}
                  {message.mode ? <span>· {message.mode}</span> : null}
                  {message.source ? <span>· {message.source}</span> : null}
                </div>
                <div className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</div>
                {message.files?.length ? (
                  <div className="mt-3 grid gap-2">
                    {message.files.map((file) => (
                      <div key={file.path} className="rounded-lg border bg-background p-2 font-mono text-xs">
                        <div className="flex items-center gap-2"><FileCode2 className="size-3.5 text-primary" /><span className="truncate">{file.path}</span><span className="ml-auto rounded-full border px-2 py-0.5 text-[10px]">{file.operation}</span></div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {mode === "plan" && planReady ? (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><div className="font-semibold">Plan ready</div><div className="text-xs text-muted-foreground">Review it above, then start the real build.</div></div>
                  <Button onClick={buildPlan} disabled={busy}><Sparkles className="size-4" /> Build this plan <ArrowRight className="size-4" /></Button>
                </div>
              </div>
            ) : null}

            {projectId || generatedFiles.length || events.length ? (
              <BuildProcessConsole events={events} generatedFiles={generatedFiles} running={busy} />
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t bg-background/95 p-2 sm:p-3">
          {error ? <div className="mb-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"><XCircle className="mt-0.5 size-4 shrink-0" /><span>{error}</span></div> : null}
          <div className="mx-auto flex max-w-4xl items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              disabled={sending}
              rows={3}
              placeholder={mode === "build" ? "Describe the website, web app, AI app, tool or software you want to build…" : mode === "plan" ? "What should OmniFrog plan before building?" : "Message OmniFrog AI…"}
              className="min-h-20 flex-1 resize-none border-0 bg-muted/30 shadow-none focus-visible:ring-0"
            />
            <div className="flex flex-col gap-1.5">
              <Button type="button" variant="ghost" size="icon" disabled={sending || !prompt} onClick={() => setPrompt("")} aria-label="Clear"><Eraser className="size-4" /></Button>
              <Button type="button" size="icon" disabled={sending || !prompt.trim()} onClick={() => void sendMessage()} aria-label="Send">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
          </div>
          <div className="mx-auto mt-1 flex max-w-4xl items-center justify-between text-[10px] text-muted-foreground">
            <span>Enter send · Shift+Enter newline · {mode === "build" ? "Build mode" : mode === "plan" ? "Plan mode" : "Chat mode"}</span>
            {state !== "IDLE" ? <StatusBadge status={state} /> : <span>{prompt.length.toLocaleString()} characters</span>}
          </div>
        </div>
      </section>
    </div>
  );
}
