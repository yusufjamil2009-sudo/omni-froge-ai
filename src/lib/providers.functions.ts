import { createServerFn } from "@tanstack/react-start";
import type { ProviderConfig } from "@/lib/omnifrog/types";

/**
 * API Manager server functions. Every handler verifies the private session —
 * provider configuration and credentials are owner-only data.
 */

async function guard(): Promise<void> {
  const { requireSession } = await import("@/lib/omnifrog/session.server");
  await requireSession();
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function fail() {
  return {
    ok: false as const,
    message: "The API Manager could not complete that action. Try again.",
  };
}

export const getProviders = createServerFn({ method: "GET" }).handler(async (): Promise<
  ProviderConfig[]
> => {
  await guard();
  const { selectProviders } = await import("@/lib/omnifrog/providers.server");
  return await selectProviders();
});

export const saveProvider = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const data = asRecord(input);
    const credentials: Record<string, string> = {};
    const rawCredentials = asRecord(data["credentials"]);
    for (const [key, value] of Object.entries(rawCredentials)) {
      if (typeof value === "string") credentials[key] = value;
    }
    return {
      providerId: typeof data["providerId"] === "string" ? data["providerId"] : "",
      credentials,
      selectedModel:
        typeof data["selectedModel"] === "string" && data["selectedModel"].length > 0
          ? data["selectedModel"]
          : null,
      makeDefault: data["makeDefault"] === true,
      enabled: data["enabled"] !== false,
      fallbackEligible: data["fallbackEligible"] !== false,
    };
  })
  .handler(async ({ data }) => {
    await guard();
    try {
      const { saveProviderConfig } = await import("@/lib/omnifrog/providers.server");
      const result = await saveProviderConfig(data);
      return result.ok
        ? ({ ok: true as const })
        : ({ ok: false as const, message: result.message });
    } catch {
      return fail();
    }
  });

export const testProvider = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const providerId = asRecord(input)["providerId"];
    return { providerId: typeof providerId === "string" ? providerId : "" };
  })
  .handler(async ({ data }) => {
    await guard();
    try {
      const { testProviderConnection } = await import("@/lib/omnifrog/providers.server");
      return await testProviderConnection(data.providerId);
    } catch {
      return {
        ok: false,
        status: "UNAVAILABLE" as const,
        model: null,
        testedAt: new Date().toISOString(),
        errorClass: "UNKNOWN_ERROR",
        reason: "The connection test could not run.",
        retryAfterSeconds: null,
      };
    }
  });

export const refreshProviderModelsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const providerId = asRecord(input)["providerId"];
    return { providerId: typeof providerId === "string" ? providerId : "" };
  })
  .handler(async ({ data }) => {
    await guard();
    try {
      const { refreshProviderModels } = await import("@/lib/omnifrog/providers.server");
      return await refreshProviderModels(data.providerId);
    } catch {
      return { ok: false as const, message: "Model discovery could not run." };
    }
  });

export const setManualModelsFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const data = asRecord(input);
    const ids = Array.isArray(data["ids"])
      ? data["ids"].filter((value): value is string => typeof value === "string")
      : [];
    return {
      providerId: typeof data["providerId"] === "string" ? data["providerId"] : "",
      ids,
    };
  })
  .handler(async ({ data }) => {
    await guard();
    try {
      const { setManualModels } = await import("@/lib/omnifrog/providers.server");
      return await setManualModels(data.providerId, data.ids);
    } catch {
      return { ok: false as const, message: "Models could not be saved." };
    }
  });

export const toggleProviderFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const data = asRecord(input);
    return {
      providerId: typeof data["providerId"] === "string" ? data["providerId"] : "",
      enabled: data["enabled"] === true,
    };
  })
  .handler(async ({ data }) => {
    await guard();
    try {
      const { setProviderEnabled } = await import("@/lib/omnifrog/providers.server");
      await setProviderEnabled(data.providerId, data.enabled);
      return { ok: true as const };
    } catch {
      return fail();
    }
  });

export const toggleProviderFallbackFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const data = asRecord(input);
    return {
      providerId: typeof data["providerId"] === "string" ? data["providerId"] : "",
      eligible: data["eligible"] === true,
    };
  })
  .handler(async ({ data }) => {
    await guard();
    try {
      const { setProviderFallback } = await import("@/lib/omnifrog/providers.server");
      await setProviderFallback(data.providerId, data.eligible);
      return { ok: true as const };
    } catch {
      return fail();
    }
  });

export const setDefaultProviderFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const providerId = asRecord(input)["providerId"];
    return { providerId: typeof providerId === "string" ? providerId : "" };
  })
  .handler(async ({ data }) => {
    await guard();
    try {
      const { setDefaultProvider } = await import("@/lib/omnifrog/providers.server");
      await setDefaultProvider(data.providerId);
      return { ok: true as const };
    } catch {
      return fail();
    }
  });

export const reorderProvidersFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const order = asRecord(input)["order"];
    return {
      order: Array.isArray(order)
        ? order.filter((value): value is string => typeof value === "string")
        : [],
    };
  })
  .handler(async ({ data }) => {
    await guard();
    try {
      const { setProviderPriority } = await import("@/lib/omnifrog/providers.server");
      await setProviderPriority(data.order);
      return { ok: true as const };
    } catch {
      return fail();
    }
  });

export const disconnectProviderFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const providerId = asRecord(input)["providerId"];
    return { providerId: typeof providerId === "string" ? providerId : "" };
  })
  .handler(async ({ data }) => {
    await guard();
    try {
      const { disconnectProvider } = await import("@/lib/omnifrog/providers.server");
      await disconnectProvider(data.providerId);
      return { ok: true as const };
    } catch {
      return fail();
    }
  });
