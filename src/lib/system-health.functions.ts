import { createServerFn } from "@tanstack/react-start";
export const getSystemHealthFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireSession } = await import("./omnifrog/session.server");
  await requireSession();
  const { getSystemHealth } = await import("./omnifrog/system-health.server");
  return getSystemHealth();
});
