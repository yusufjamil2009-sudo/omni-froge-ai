import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

const STATE_COOKIE = "omnifrog_github_oauth_state";
const TOKEN_COOKIE = "omnifrog_github_token";
const API = "https://api.github.com";
const OAUTH = "https://github.com/login/oauth";

function secret(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function base64url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function keyMaterial() {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret("OMNIFROG_SESSION_SECRET")));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function seal(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyMaterial(), new TextEncoder().encode(value));
  const out = new Uint8Array(iv.length + encrypted.byteLength);
  out.set(iv);
  out.set(new Uint8Array(encrypted), iv.length);
  return base64url(out.buffer);
}

async function unseal(value?: string): Promise<string | null> {
  if (!value) return null;
  try {
    const raw = Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=="), c => c.charCodeAt(0));
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, await keyMaterial(), raw.slice(12));
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

function cookie(name: string, value: string, maxAge: number) {
  setCookie(name, value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge });
}

async function githubFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await unseal(getCookie(TOKEN_COOKIE));
  if (!token) throw new Error("GitHub is not connected.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 300)}`);
  }
  return response.json() as Promise<T>;
}

export async function startGithubOAuth(): Promise<{ url: string }> {
  const clientId = secret("GITHUB_CLIENT_ID");
  const state = base64url(crypto.getRandomValues(new Uint8Array(24)).buffer);
  cookie(STATE_COOKIE, await seal(state), 10 * 60);
  const callback = process.env.GITHUB_CALLBACK_URL || "";
  if (!callback) throw new Error("Missing server configuration: GITHUB_CALLBACK_URL");
  const url = new URL(`${OAUTH}/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("scope", "repo");
  url.searchParams.set("state", state);
  return { url: url.toString() };
}

export async function completeGithubOAuth(code: string, state: string): Promise<{ login: string }> {
  const expected = await unseal(getCookie(STATE_COOKIE));
  deleteCookie(STATE_COOKIE, { path: "/" });
  if (!expected || expected !== state) throw new Error("Invalid GitHub OAuth state.");
  const response = await fetch(`${OAUTH}/access_token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: secret("GITHUB_CLIENT_ID"), client_secret: secret("GITHUB_CLIENT_SECRET"), code, redirect_uri: process.env.GITHUB_CALLBACK_URL }),
  });
  const data = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error || "GitHub authorization failed.");
  cookie(TOKEN_COOKIE, await seal(data.access_token), 30 * 24 * 60 * 60);
  const me = await githubFetch<{ login: string }>("/user");
  return { login: me.login };
}

export function disconnectGithub() {
  deleteCookie(TOKEN_COOKIE, { path: "/" });
}

export async function githubStatus() {
  try {
    const me = await githubFetch<{ login: string; avatar_url?: string; html_url?: string }>("/user");
    return { connected: true, login: me.login, avatarUrl: me.avatar_url ?? null, profileUrl: me.html_url ?? null };
  } catch {
    return { connected: false, login: null, avatarUrl: null, profileUrl: null };
  }
}

export async function listGithubRepos() {
  return githubFetch<Array<{ id: number; full_name: string; private: boolean; default_branch: string; html_url: string }>>("/user/repos?per_page=100&sort=updated");
}

export async function getGithubRepoContents(owner: string, repo: string, path = "", ref = "main") {
  return githubFetch<unknown>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`);
}

export async function writeGithubFile(input: { owner: string; repo: string; path: string; content: string; message: string; branch: string; sha?: string }) {
  const body: Record<string, string> = { message: input.message, content: btoa(unescape(encodeURIComponent(input.content))), branch: input.branch };
  if (input.sha) body.sha = input.sha;
  return githubFetch<unknown>(`/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents/${input.path.split("/").map(encodeURIComponent).join("/")}`, { method: "PUT", body: JSON.stringify(body) });
}

export async function createGithubBranch(owner: string, repo: string, branch: string, fromBranch: string) {
  const ref = await githubFetch<{ object: { sha: string } }>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/ref/heads/${encodeURIComponent(fromBranch)}`);
  return githubFetch<unknown>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: ref.object.sha }) });
}

export async function pushGithubFiles(input: { owner: string; repo: string; branch: string; message: string; files: Array<{ path: string; content: string }> }) {
  if (!input.files.length) throw new Error("No files to push.");
  const repoPath = `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`;
  const head = await githubFetch<{ object: { sha: string } }>(`${repoPath}/git/ref/heads/${encodeURIComponent(input.branch)}`);
  const base = await githubFetch<{ tree: { sha: string } }>(`${repoPath}/git/commits/${head.object.sha}`);
  const blobs = await Promise.all(input.files.map(file => githubFetch<{ sha: string }>(`${repoPath}/git/blobs`, { method: "POST", body: JSON.stringify({ content: file.content, encoding: "utf-8" }) }).then(blob => ({ path: file.path, mode: "100644", type: "blob", sha: blob.sha }))));
  const tree = await githubFetch<{ sha: string }>(`${repoPath}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: base.tree.sha, tree: blobs }) });
  const commit = await githubFetch<{ sha: string }>(`${repoPath}/git/commits`, { method: "POST", body: JSON.stringify({ message: input.message, tree: tree.sha, parents: [head.object.sha] }) });
  await githubFetch( `${repoPath}/git/refs/heads/${encodeURIComponent(input.branch)}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
  return { commitSha: commit.sha, branch: input.branch, files: input.files.length };
}
