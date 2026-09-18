import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PreviewSourceFile } from "./types";

const exec = promisify(execFile);
export type DeploymentProvider = "netlify" | "vercel";
export type DeploymentStatus = "IDLE" | "DEPLOYING" | "READY" | "ERROR";
export interface DeploymentResult {
  provider: DeploymentProvider;
  status: DeploymentStatus;
  url: string | null;
  deployUrl: string | null;
  message: string;
  logs: string;
}

const MAX_FILES = 500;
const MAX_FILE_BYTES = 2_000_000;
const MAX_TOTAL_BYTES = 40_000_000;
const COMMAND_TIMEOUT = 180_000;

function safe(v: string) { return v.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "omnifrog-project"; }
function safePath(rel: string) {
  const normalized = rel.replace(/\\/g, "/");
  if (!normalized || normalized.includes("..") || normalized.startsWith("/") || /(^|\/)(node_modules|\.git|\.env(?:$|\.))/i.test(normalized)) return false;
  return true;
}
function extractUrl(text: string) {
  return text.match(/https?:\\/\\/[^\\s"'<>]+/g)?.[0] ?? null;
}

export async function deployProject(input: {
  provider: DeploymentProvider;
  projectName: string;
  files: PreviewSourceFile[];
  production?: boolean;
}): Promise<DeploymentResult> {
  if (!input.files.length) return { provider: input.provider, status: "ERROR", url: null, deployUrl: null, message: "Project has no generated files.", logs: "" };
  if (input.files.length > MAX_FILES) return { provider: input.provider, status: "ERROR", url: null, deployUrl: null, message: "Deployment file limit exceeded.", logs: "" };
  const total = input.files.reduce((n, f) => n + Buffer.byteLength(f.content, "utf8"), 0);
  if (total > MAX_TOTAL_BYTES) return { provider: input.provider, status: "ERROR", url: null, deployUrl: null, message: "Deployment size limit exceeded.", logs: "" };

  const fs = await import("node:fs/promises");
  const os = await import("node:os");
  const path = await import("node:path");
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "omnifrog-deploy-"));
  try {
    for (const f of input.files) {
      if (!safePath(f.path) || Buffer.byteLength(f.content, "utf8") > MAX_FILE_BYTES) continue;
      const rel = f.path.replace(/\\/g, "/");
      const dest = path.join(dir, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, f.content, "utf8");
    }

    const packagePath = path.join(dir, "package.json");
    let publishDir = dir;
    try {
      const pkg = JSON.parse(await fs.readFile(packagePath, "utf8")) as { scripts?: Record<string, string> };
      if (pkg.scripts?.build) {
        await exec("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: dir, timeout: COMMAND_TIMEOUT, maxBuffer: 4 * 1024 * 1024 });
        await exec("npm", ["run", "build"], { cwd: dir, timeout: COMMAND_TIMEOUT, maxBuffer: 4 * 1024 * 1024 });
        const dist = path.join(dir, "dist");
        try { await fs.access(dist); publishDir = dist; } catch { /* framework may publish from project root */ }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { provider: input.provider, status: "ERROR", url: null, deployUrl: null, message: "Project build failed before deployment.", logs: msg.slice(-12000) };
    }

    let cmd: string;
    let args: string[];
    const env = { ...process.env };
    if (input.provider === "netlify") {
      if (!env.NETLIFY_AUTH_TOKEN) return { provider: input.provider, status: "ERROR", url: null, deployUrl: null, message: "NETLIFY_AUTH_TOKEN is not configured on the server.", logs: "" };
      cmd = "npx";
      args = ["--yes", "netlify-cli", "deploy", "--dir", publishDir];
      if (env.NETLIFY_SITE_ID) args.push("--site", env.NETLIFY_SITE_ID);
      else args.push("--site", safe(input.projectName));
      if (input.production) args.push("--prod");
      else args.push("--json");
    } else {
      if (!env.VERCEL_TOKEN) return { provider: input.provider, status: "ERROR", url: null, deployUrl: null, message: "VERCEL_TOKEN is not configured on the server.", logs: "" };
      cmd = "npx";
      args = ["--yes", "vercel", publishDir, "--yes"];
      if (input.production) args.push("--prod");
    }
    const r = await exec(cmd, args, { cwd: dir, timeout: COMMAND_TIMEOUT, maxBuffer: 4 * 1024 * 1024, env });
    const logs = (r.stdout + "\n" + r.stderr).trim();
    const url = extractUrl(logs);
    return { provider: input.provider, status: url ? "READY" : "DEPLOYING", url, deployUrl: url, message: url ? "Deployment completed and URL detected." : "Deployment command completed without a detected URL.", logs: logs.slice(-12000) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { provider: input.provider, status: "ERROR", url: null, deployUrl: null, message: msg.slice(0, 500), logs: msg.slice(-12000) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
