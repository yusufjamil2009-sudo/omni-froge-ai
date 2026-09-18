import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL = "https://api.github.com";

export type GitHubConnection = {
  connected: boolean;
  login?: string;
  name?: string | null;
  avatarUrl?: string | null;
  scope?: string | null;
};

type OAuthState = { nonce: string; createdAt: number };

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function requireClientId() {
  const value = env("GITHUB_CLIENT_ID");
  if (!value) throw new Error("GITHUB_CLIENT_ID is not configured.");
  return value;
}

function callbackUrl(request?: Request) {
  const configured = env("GITHUB_CALLBACK_URL");
  if (configured) return configured;
  if (!request) throw new Error("GITHUB_CALLBACK_URL is not configured.");
  return new URL("/api/github/callback", request.url).toString();
}

function secret() {
  const value = env("GITHUB_OAUTH_SECRET");
  if (!value) throw new Error("GITHUB_OAUTH_SECRET is not configured.");
  return value;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function encodeState(state: OAuthState) {
  const body = Buffer.from(JSON.stringify(state)).toString("base64url");
  return body + "." + sign(body);
}

function decodeState(value: string): OAuthState | null {
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
    return Date.now() - parsed.createdAt < 10 * 60 * 1000 ? parsed : null;
  } catch {
    return null;
  }
}

function parseCookies(request: Request) {
  return Object.fromEntries(
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index < 0 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function cookie(name: string, value: string, options: string) {
  return `${name}=${encodeURIComponent(value)}; ${options}`;
}

function getAccessToken(request: Request) {
  return parseCookies(request).omnifrog_github_token || null;
}

export function getGitHubConnection(request: Request): GitHubConnection {
  const token = getAccessToken(request);
  if (!token) return { connected: false };
  return { connected: true };
}

export function createGitHubAuthorizeUrl(request: Request) {
  const state = encodeState({ nonce: randomBytes(24).toString("hex"), createdAt: Date.now() });
  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set("client_id", requireClientId());
  url.searchParams.set("redirect_uri", callbackUrl(request));
  url.searchParams.set("scope", "repo");
  url.searchParams.set("state", state);
  return {
    url: url.toString(),
    stateCookie: cookie("omnifrog_github_state", state, "HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=600"),
  };
}

export async function exchangeGitHubCode(request: Request, code: string, stateValue: string) {
  const cookies = parseCookies(request);
  const expectedState = cookies.omnifrog_github_state;
  if (!expectedState || expectedState !== stateValue || !decodeState(stateValue)) {
    throw new Error("Invalid or expired GitHub OAuth state.");
  }

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireClientId(),
      client_secret: env("GITHUB_CLIENT_SECRET"),
      code,
      redirect_uri: callbackUrl(request),
    }),
  });

  if (!response.ok) throw new Error(`GitHub token exchange failed (${response.status}).`);
  const payload = (await response.json()) as { access_token?: string; error?: string };
  if (!payload.access_token) throw new Error(payload.error || "GitHub did not return an access token.");

  const userResponse = await fetch(`${GITHUB_API_URL}/user`, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${payload.access_token}`, "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!userResponse.ok) throw new Error("GitHub account verification failed.");
  const user = (await userResponse.json()) as { login: string; name?: string | null; avatar_url?: string | null };

  const connection = { connected: true, login: user.login, name: user.name ?? null, avatarUrl: user.avatar_url ?? null };
  return {
    connection,
    setCookie: cookie("omnifrog_github_token", payload.access_token, "HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=2592000"),
    clearStateCookie: cookie("omnifrog_github_state", "", "HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=0"),
  };
}

export function disconnectGitHub() {
  return cookie("omnifrog_github_token", "", "HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=0");
}

async function githubFetch<T>(request: Request, path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken(request);
  if (!token) throw new Error("GitHub is not connected.");
  const response = await fetch(`${GITHUB_API_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub API error (${response.status}).`);
  return (await response.json()) as T;
}

export async function listGitHubRepositories(request: Request) {
  return githubFetch<Array<{ id: number; name: string; full_name: string; private: boolean; default_branch: string }>>(
    request,
    "/user/repos?per_page=100&sort=updated",
  );
}

export async function getGitHubRepository(request: Request, owner: string, repo: string) {
  return githubFetch<{ id: number; name: string; full_name: string; private: boolean; default_branch: string }>(
    request,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
  );
}

export async function getGitHubFile(request: Request, owner: string, repo: string, path: string, ref?: string) {
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  return githubFetch<{ name: string; path: string; sha: string; content?: string; encoding?: string }>(
    request,
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}${query}`,
  );
}

export async function writeGitHubFile(
  request: Request,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch?: string,
  sha?: string,
) {
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
  };
  if (branch) body.branch = branch;
  if (sha) body.sha = sha;
  return githubFetch(request, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function createGitHubCommit(request: Request, owner: string, repo: string, branch: string, message: string) {
  const ref = await githubFetch<{ object: { sha: string } }>(request, `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  return { branch, parentSha: ref.object.sha, message };
}
