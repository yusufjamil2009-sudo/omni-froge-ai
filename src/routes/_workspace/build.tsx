import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Eraser, Loader2 } from "lucide-react";

import { ActivityPanel } from "@/components/omnifrog/activity-panel";
import { StatusBadge } from "@/components/omnifrog/status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createBuildRequest, runBuildTestRepair, saveUiBlueprint } from "@/lib/projects.functions";
import { generateUiBlueprint } from "@/lib/omnifrog/ui-generation";
import { generateCodingPlan } from "@/lib/omnifrog/coding-engine";
import { addProjectMemory, getProjectMemory } from "@/lib/memory.functions";
import type { ActivityEvent, BuildState } from "@/lib/omnifrog/types";
import { PENDING_INTEGRATIONS } from "@/lib/omnifrog/types";

export const Route = createFileRoute("/_workspace/build")({
  head: () => ({
    meta: [
      { title: "New Build — OmniFrog AI" },
      {
        name: "description",
        content: "Describe your idea and OmniFrog AI turns it into a software project.",
      },
      { property: "og:title", content: "New Build — OmniFrog AI" },
      { property: "og:description", content: "Start a new OmniFrog AI build request." },
    ],
  }),
  component: BuildScreen,
});

/** Local, honest record of operations this screen actually performed. */
function step(
  id: string,
  level: ActivityEvent["level"],
  message: string,
  operation: string,
): ActivityEvent {
  return {
    id,
    projectId: "",
    level,
    message,
    agentId: null,
    agentName: null,
    filePath: null,
    operation,
    provider: null,
    model: null,
    details: {},
    createdAt: new Date().toISOString(),
  };
}

function BuildScreen() {
  const submit = useServerFn(createBuildRequest);
  const saveBlueprint = useServerFn(saveUiBlueprint);
  const saveMemory = useServerFn(addProjectMemory);
  const loadMemory = useServerFn(getProjectMemory);
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<BuildState>("IDLE");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = ["UNDERSTANDING","PLANNING","BUILDING","TESTING","FIXING"].includes(state);

  async function runBuildRequest() {
    const request = prompt.trim();
    if (request.length < 3 || busy) return;

    setError(null);
    setProjectId(null);
    setState("UNDERSTANDING");
    setEvents([step("received", "done", "Request received", "request.receive")]);

    try {
      const result = await submit({ data: { request } });
      if (!result.ok) {
        setState("FAILED");
        setError(`${result.error.message} (ref ${result.error.errorId})`);
        setEvents((current) => [
          ...current,
          step("failed", "error", "Could not store the build request", "project.create"),
        ]);
        return;
      }

      setProjectId(result.projectId);
      await saveMemory({ data: { id: result.projectId, kind: "requirement", title: "Original build request", content: request, source: "build-request", importance: 100 } });
      const memoryState = await loadMemory({ data: { id: result.projectId } });
      const memoryContext = (memoryState.summary ? "Project memory summary:\n" + memoryState.summary + "\n\n" : "") + memoryState.items.slice(0, 12).map((item) => "[" + item.kind + "] " + item.title + "\n" + item.content).join("\n\n");
      const requestWithMemory = memoryContext ? request + "\n\nPROJECT MEMORY — preserve these existing decisions and constraints:\n" + memoryContext : request;
      setEvents([
        step("received", "done", "Request received", "request.receive"),
        step("stored", "done", "Project request stored", "project.create"),
        step("prepare", "done", "Build environment prepared", "build.prepare"),
        step("planner", "active", "Generating UI architecture blueprint", "ui.blueprint.generate"),
      ]);
      setState("PLANNING");

      const generated = await generateUiBlueprint({
        request,
        onProgress: (progress) => {
          setEvents((current) => [
            ...current.filter((event) => event.id !== "planner-progress"),
            step(
              "planner-progress",
              "active",
              progress.text || `Planning UI… ${Math.round(progress.progress * 100)}%`,
              "ui.blueprint.progress",
            ),
          ]);
        },
      });

      if (!generated.ok || !generated.blueprint) {
        setState("FAILED");
        setError(generated.error ?? "Could not generate a valid UI blueprint.");
        setEvents((current) => [
          ...current.filter((event) => event.id !== "planner-progress"),
          step("planner-failed", "error", "UI blueprint generation failed validation", "ui.blueprint.generate"),
        ]);
        return;
      }

      await saveBlueprint({
        data: {
          id: result.projectId,
          blueprint: generated.blueprint,
          source: generated.source,
        },
      });

      setState("BUILDING");
      setEvents((current) => [...current.filter((event) => event.id !== "planner-progress"),
        step("planner-done","done",`UI blueprint ready via ${generated.source === "browser" ? "browser AI" : "API fallback"}`,"ui.blueprint.complete"),
        step("coding-start","active","Generating validated project source files","coding.plan.start")]);

      const coding = await generateCodingPlan({
        request: requestWithMemory, blueprint: generated.blueprint,
        onProgress: (progress) => setEvents((current) => [
          ...current.filter((event) => event.id !== "coding-progress"),
          step("coding-progress","active",progress.text || `Writing project files… ${Math.round(progress.progress * 100)}%`,"coding.plan.progress"),
        ]),
      });
      if (!coding.ok || !coding.plan) {
        setState("FAILED"); setError(coding.error ?? "Could not generate a valid coding plan."); return;
      }

      setState("TESTING");
      setEvents((current) => [...current.filter((event) => event.id !== "coding-progress"),
        step("coding-done","done",`Generated ${coding.plan.files.length} validated file operation(s)`,"coding.plan.complete"),
        step("pipeline-start","active","Running build preflight, testing, debugging and automatic repair","build.pipeline.start")]);

      const pipeline = await runBuildTestRepair({
        data: { id: result.projectId, request: requestWithMemory, changes: coding.plan.files, maxRepairAttempts: 3 },
      });
      if (!pipeline.ok || !pipeline.report.passed) {
        setState("FAILED");
        setError(pipeline.report.checks.filter((check) => check.severity === "error").map((check) => check.message).join(" ") || "Build validation failed.");
        return;
      }

      setState("COMPLETED");
      setEvents((current) => [...current.filter((event) => event.id !== "coding-progress"),
        step("coding-done","done",`Generated ${coding.plan.files.length} validated file operation(s)`,"coding.plan.complete"),
        step("pipeline-done","done",`Build preflight passed; ${pipeline.report.repairAttempts} repair attempt(s)`,"build.pipeline.complete")]);
      await queryClient.invalidateQueries({ queryKey: ["omnifrog"] });
    } catch {
      setState("FAILED");
      setError("Could not reach the OmniFrog service. Please try again.");
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void runBuildRequest();
    }
  }

  return (
    <div className="space-y-6">
      <header className="rise-in">
        <h1 className="text-2xl font-semibold sm:text-4xl">What do you want to build?</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Describe your idea. OmniFrog AI will turn it into a software project.
        </p>
      </header>

      <section className="glass-panel rounded-2xl p-3 sm:p-5">
        <Textarea
          ref={textareaRef}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={busy}
          rows={8}
          spellCheck={false}
          placeholder="Describe the website, web app, AI app, tool or software you want to build..."
          className="max-h-[60vh] min-h-40 w-full resize-y border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0 sm:text-base"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="font-mono">{prompt.length.toLocaleString()} characters</span>
            <span className="hidden sm:inline">
              Enter to build · Shift + Enter for a new line · long multi-section prompts supported
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || prompt.length === 0}
              onClick={() => {
                setPrompt("");
                textareaRef.current?.focus();
              }}
            >
              <Eraser className="size-3.5" /> Clear
            </Button>
          </div>

          <Button
            type="button"
            onClick={() => void runBuildRequest()}
            disabled={busy || prompt.trim().length < 3}
            className="h-11 w-full gradient-primary font-semibold text-primary-foreground glow-primary transition-smooth sm:w-auto"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Submitting…
              </>
            ) : (
              <>
                Build with OmniFrog <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </section>

      {state !== "IDLE" ? (
        <section className="space-y-4 rise-in">
          <div className="soft-panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                OmniFrog Build
              </h2>
              <p className="mt-1 text-sm font-medium">
                {state === "FAILED"
                  ? "Status: Request could not be stored"
                  : busy
                    ? "Status: Storing project request…"
                    : "Status: Preparing project — awaiting AI build engine"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={state} />
              {projectId ? (
                <Button asChild variant="secondary" size="sm">
                  <Link to="/projects/$projectId" params={{ projectId }}>
                    Open project <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          {error ? (
            <p className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <ActivityPanel events={events} title="Build Activity" />
        </section>
      ) : null}

      <section className="soft-panel rounded-xl p-4 sm:p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Capabilities arriving in later parts
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          These systems are not connected yet, so OmniFrog never presents generated code or AI
          output it did not actually produce.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {PENDING_INTEGRATIONS.map((capability) => (
            <li
              key={capability.id}
              className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-muted-foreground"
            >
              {capability.label} · {capability.note}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
