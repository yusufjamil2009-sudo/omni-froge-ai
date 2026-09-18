/**
 * OmniFrog AI — credential encryption (server only).
 *
 * Provider credentials are encrypted with AES-256-GCM using a key derived from
 * the OMNIFROG_CREDENTIAL_KEY deployment secret. Plaintext never leaves this
 * module's callers on the server, and never reaches the browser at all.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function aesKey(): Promise<CryptoKey> {
  const secret = process.env["OMNIFROG_CREDENTIAL_KEY"];
  if (!secret) throw new Error("Missing server configuration: OMNIFROG_CREDENTIAL_KEY");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Encrypts a credential map. Output format: "v1.<iv>.<ciphertext>" (base64). */
export async function encryptCredentials(values: Record<string, string>): Promise<string> {
  const key = await aesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(values)),
  );
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`;
}

export async function decryptCredentials(payload: string | null): Promise<Record<string, string>> {
  if (!payload) return {};
  const parts = payload.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return {};
  const iv = fromBase64(parts[1]!);
  const data = fromBase64(parts[2]!);
  try {
    const key = await aesKey();
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    const parsed = JSON.parse(decoder.decode(plain)) as Record<string, unknown>;
    const values: Record<string, string> = {};
    for (const [field, value] of Object.entries(parsed)) {
      if (typeof value === "string") values[field] = value;
    }
    return values;
  } catch {
    // Wrong key or tampered payload — treat as unusable, never surface detail.
    return {};
  }
}
