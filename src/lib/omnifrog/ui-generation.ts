/**
 * OmniFrog AI — PART 05: AI UI / Website Generation Engine.
 *
 * Converts a natural-language software request into a validated, framework-
 * neutral UI blueprint. It does not write files; PART 06 owns file editing.
 */

import { z } from "zod";
import { runBrowserFirstAi, type BrowserFirstSource } from "./browser-first";

const uiBlueprintSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  appType: z.enum(["website", "web-app", "dashboard", "landing-page", "ai-app", "tool", "other"]),
  style: z.object({
    visualDirection: z.string().min(1).max(240),
    primaryColor: z.string().min(1).max(40),
    accentColor: z.string().min(1).max(40),
    responsive: z.boolean(),
  }),
  pages: z.array(z.object({
    path: z.string().min(1).max(160),
    name: z.string().min(1).max(100),
    purpose: z.string().min(1).max(300),
    sections: z.array(z.string().min(1).max(160)).max(30),
  })).min(1).max(30),
  components: z.array(z.object({
    name: z.string().min(1).max(100),
    purpose: z.string().min(1).max(240),
    reusable: z.boolean(),
  })).max(100),
  interactions: z.array(z.string().min(1).max(240)).max(100),
  accessibility: z.array(z.string().min(1).max(240)).max(30),
  implementationNotes: z.array(z.string().min(1).max(300)).max(50),
});

export type UiBlueprint = z.infer<typeof uiBlueprintSchema>;

export interface UiGenerationResult {
  ok: boolean;
  blueprint: UiBlueprint | null;
  source: BrowserFirstSource;
  error: string | null;
}

const SYSTEM_PROMPT = `You are OmniFrog AI's UI architecture planner.
Turn the user's software request into a precise implementation-ready UI blueprint.
Return ONLY valid JSON. Do not use markdown fences. Do not invent backend APIs,
database tables, credentials, or integrations. Keep the blueprint framework-neutral.
Prefer reusable components, responsive layouts, accessible interactions, and
realistic scope. Do not write source code in this phase.`;

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/i, "");
  try { return JSON.parse(trimmed); } catch {}
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error("AI returned an invalid UI blueprint.");
}

export async function generateUiBlueprint(input: {
  request: string;
  model?: string | null;
  onProgress?: (progress: { progress: number; text: string }) => void;
}): Promise<UiGenerationResult> {
  const request = input.request.trim();
  if (request.length < 3) {
    return { ok: false, blueprint: null, source: "none", error: "Build request is required." };
  }

  const result = await runBrowserFirstAi({
    prompt: request,
    system: SYSTEM_PROMPT,
    model: input.model,
    maxTokens: 5000,
    onProgress: input.onProgress,
  });

  if (!result.ok || !result.text) {
    return { ok: false, blueprint: null, source: result.source, error: result.browserError ?? "UI generation failed." };
  }

  try {
    const blueprint = uiBlueprintSchema.parse(extractJson(result.text));
    return { ok: true, blueprint, source: result.source, error: null };
  } catch (error) {
    return {
      ok: false,
      blueprint: null,
      source: result.source,
      error: error instanceof Error ? error.message : "Generated blueprint failed validation.",
    };
  }
}
