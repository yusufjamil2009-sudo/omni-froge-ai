import { createServerFn } from "@tanstack/react-start";
import { requireSession } from "./omnifrog/session.server";

export const startGithubOAuth = createServerFn({ method: "POST" }).handler(async () => {
  await requireSession();
  const { startGithubOAuth: start } = await import("./omnifrog/github.server");
  return start();
});

export const completeGithubOAuth = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; state: string }) => {
    if (!input || typeof input.code !== "string" || typeof input.state !== "string") throw new Error("Invalid GitHub callback.");
    return { code: input.code, state: input.state };
  })
  .handler(async ({ data }) => {
    await requireSession();
    const { completeGithubOAuth: complete } = await import("./omnifrog/github.server");
    return complete(data.code, data.state);
  });

export const getGithubStatus = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const { githubStatus } = await import("./omnifrog/github.server");
  return githubStatus();
});

export const disconnectGithub = createServerFn({ method: "POST" }).handler(async () => {
  await requireSession();
  const { disconnectGithub } = await import("./omnifrog/github.server");
  disconnectGithub();
  return { ok: true as const };
});

export const listGithubRepos = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const { listGithubRepos } = await import("./omnifrog/github.server");
  return listGithubRepos();
});

export const pushGithubProject = createServerFn({ method: "POST" })
  .inputValidator((input: { owner: string; repo: string; branch: string; message: string; files: Array<{ path: string; content: string }> }) => {
    if (!input || !input.owner || !input.repo || !input.branch || !input.message || !Array.isArray(input.files)) throw new Error("Invalid GitHub push request.");
    if (input.files.length > 300) throw new Error("Too many files.");
    return input;
  })
  .handler(async ({ data }) => {
    await requireSession();
    const { pushGithubFiles } = await import("./omnifrog/github.server");
    return pushGithubFiles(data);
  });
