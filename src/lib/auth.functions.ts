import { createServerFn } from "@tanstack/react-start";

import { omniError } from "./omnifrog/errors";

/**
 * Private-access server functions. Password verification happens entirely
 * server-side; the client only ever learns whether it succeeded.
 */

export const unlock = createServerFn({ method: "POST" })
  .inputValidator((input: { password: string }) => {
    if (typeof input?.password !== "string") throw new Error("Invalid request");
    return { password: input.password };
  })
  .handler(async ({ data }) => {
    const { unlockWorkspace } = await import("./omnifrog/session.server");
    const result = await unlockWorkspace(data.password);

    if (result.ok) return { ok: true as const, expiresAt: result.expiresAt };

    if (result.reason === "throttled") {
      return {
        ok: false as const,
        error: omniError(
          "access.unlock",
          `Too many attempts. Try again in ${Math.ceil(result.retryAfterSeconds / 60)} minute(s).`,
        ),
      };
    }

    // Deliberately generic: never hint at partial correctness.
    return {
      ok: false as const,
      error: omniError("access.unlock", "Authentication failed."),
    };
  });

export const getAccessState = createServerFn({ method: "GET" }).handler(async () => {
  const { readSession } = await import("./omnifrog/session.server");
  return await readSession();
});

export const lock = createServerFn({ method: "POST" }).handler(async () => {
  const { destroySession } = await import("./omnifrog/session.server");
  destroySession();
  return { ok: true as const };
});
