/**
 * OmniFrog AI — PART 06 coding & file editing engine.
 *
 * The model proposes file changes; deterministic guards validate paths and
 * operations before anything is persisted. This keeps PART 06 safe and
 * framework-neutral while leaving runtime/build/test/repair to later parts.
 */
import { z } from "zod";
import { runBrowserFirstAi } from "./browser-first";
import type { CodingPlan, FileLanguage, FileOperation, GeneratedFile, UiBlueprint } from "./types";

const fileSchema = z.object({
  path: z.string().min(1).max(240),
  operation: z.enum(["create", "update", "delete"]),
  language: z.enum(["typescript", "javascript", "tsx", "jsx", "css", "html", "json", "markdown", "text", "other"]),
  content: z.string().max(500_000),
  reason: z.string().min(1).max(500),
});

const planSchema = z.object({
  summary: z.string().min(1).max(1000),
  files: z.array(fileSchema).max(200),
  checks: z.array(z.string().min(1).max(300)).max(100),
});

const FORBIDDEN_PATHS = /(^|\/)(node_modules|\.git|\.env(?:\.|$)|dist|build|coverage)(\/|$)/i;
const ABSOLUTE_PATH = /^(?:[A-Za-z]:[\\/]|[\\/]{2}|\/)/;

function normalizePath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

function validateFile(file: GeneratedFile): GeneratedFile {
  const path = normalizePath(file.path);
  if (!path || ABSOLUTE_PATH.test(path) || path.split("/").includes("..")) {
    throw new Error(`Unsafe file path: ${file.path}`);
  }
  if (FORBIDDEN_PATHS.test(path)) {
    throw new Error(`Protected path cannot be edited: ${path}`);
  }
  if (file.operation === "delete" && file.content.length > 0) {
    throw new Error(`Delete operation must not include content: ${path}`);
  }
  return { ...file, path };
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/i, "");
  try { return JSON.parse(trimmed); } catch {}
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error("AI returned an invalid coding plan.");
}

const SYSTEM_PROMPT = `You are OmniFrog AI's Universal Coding & File Editing planner.
Given a validated UI blueprint and original request, produce a precise file-change plan.
Return ONLY JSON. Use relative project paths. Never use absolute paths, parent traversal,
secrets, environment files, node_modules, .git, build artifacts, or generated binaries.
Do not claim that a file was written: only propose its complete content. Prefer minimal,
focused changes and reusable components. Do not run shell commands.`;

export async function generateCodingPlan(input: {
  request: string;
  blueprint: UiBlueprint;
  model?: string | null;
  onProgress?: (progress: { progress: number; text: string }) => void;
}): Promise<{ ok: boolean; plan: CodingPlan | null; source: "browser" | "api-fallback" | "none"; error: string | null }> {
  const prompt = JSON.stringify({ request: input.request, blueprint: input.blueprint });
  const result = await runBrowserFirstAi({
    prompt,
    system: SYSTEM_PROMPT,
    model: input.model,
    maxTokens: 12000,
    onProgress: input.onProgress,
  });

  if (!result.ok || !result.text) {
    return { ok: false, plan: null, source: result.source, error: result.browserError ?? "Coding plan generation failed." };
  }

  try {
    const parsed = planSchema.parse(extractJson(result.text));
    const files = parsed.files.map((file) => validateFile(file));
    const uniquePaths = new Set<string>();
    for (const file of files) {
      if (uniquePaths.has(file.path)) throw new Error(`Duplicate file operation: ${file.path}`);
      uniquePaths.add(file.path);
    }
    return { ok: true, plan: { ...parsed, files }, source: result.source, error: null };
  } catch (error) {
    return { ok: false, plan: null, source: result.source, error: error instanceof Error ? error.message : "Coding plan validation failed." };
  }
}
