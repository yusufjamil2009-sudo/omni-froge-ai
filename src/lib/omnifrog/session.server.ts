/**
 * OmniFrog AI — private access + session (server only).
 *
 * - The owner password lives ONLY in the OMNIFROG_ACCESS_PASSWORD secret.
 * - Sessions are stateless HMAC-signed tokens in an httpOnly cookie.
 * - Nothing here is ever logged or returned to the client.
 */
import { deleteCookie, getCookie, getRequestIP, setCookie } from "@tanstack/react-start/server";

const COOKIE_NAME = "omnifrog_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

const encoder = new TextEncoder();

function readSecret(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function base64url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(readSecret("OMNIFROG_SESSION_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i]! ^ right[i]!;
  return diff === 0;
}

/**
 * Best-effort in-memory throttle. Serverless workers are stateless, so this
 * slows down bursts per instance; it is not a distributed rate limiter.
 */
type Attempts = { count: number; windowStart: number; blockedUntil: number };
const attempts = new Map<string, Attempts>();

function clientKey(): string {
  try {
    return getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    return "unknown";
  }
}

export function checkThrottle(): { blocked: boolean; retryAfterSeconds: number } {
  const key = clientKey();
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && entry.blockedUntil > now) {
    return { blocked: true, retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000) };
  }
  return { blocked: false, retryAfterSeconds: 0 };
}

function recordFailure(): void {
  const key = clientKey();
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.windowStart > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now, blockedUntil: 0 });
    return;
  }
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.blockedUntil = now + BLOCK_MS;
    entry.count = 0;
    entry.windowStart = now;
  }
}

function clearFailures(): void {
  attempts.delete(clientKey());
}

async function createToken(): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const payload = `v1.${expiresAt}.${nonce}`;
  return { token: `${payload}.${await sign(payload)}`, expiresAt };
}

async function verifyToken(token: string | undefined): Promise<{ expiresAt: number } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const [version, expiresRaw, nonce, signature] = parts as [string, string, string, string];
  const payload = `${version}.${expiresRaw}.${nonce}`;
  const expected = await sign(payload);
  if (!constantTimeEqual(signature, expected)) return null;
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return { expiresAt };
}

function writeSessionCookie(token: string): void {
  setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

/** Verifies the owner password and, on success, starts a session. */
export async function unlockWorkspace(
  password: string,
): Promise<{ ok: true; expiresAt: number } | { ok: false; reason: "invalid" | "throttled"; retryAfterSeconds: number }> {
  const throttle = checkThrottle();
  if (throttle.blocked) {
    return { ok: false, reason: "throttled", retryAfterSeconds: throttle.retryAfterSeconds };
  }

  const expected = readSecret("OMNIFROG_ACCESS_PASSWORD");
  if (!password || !constantTimeEqual(password, expected)) {
    recordFailure();
    return { ok: false, reason: "invalid", retryAfterSeconds: 0 };
  }

  clearFailures();
  const { token, expiresAt } = await createToken();
  writeSessionCookie(token);
  return { ok: true, expiresAt };
}

export async function readSession(): Promise<{ authenticated: boolean; expiresAt: number | null }> {
  const session = await verifyToken(getCookie(COOKIE_NAME));
  return { authenticated: session !== null, expiresAt: session?.expiresAt ?? null };
}

/** Throws for any server function that must stay private. */
export async function requireSession(): Promise<void> {
  const session = await readSession();
  if (!session.authenticated) {
    throw new Error("Not authorized");
  }
}

export function destroySession(): void {
  deleteCookie(COOKIE_NAME, { path: "/" });
}
