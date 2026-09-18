import { createFileRoute } from "@tanstack/react-router";
import { exchangeGitHubCode } from "@/lib/omnifrog/github-oauth.server";

export const Route = createFileRoute("/api/github/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) return new Response("Missing GitHub OAuth code/state.", { status: 400 });
        try {
          const result = await exchangeGitHubCode(request, code, state);
          return new Response(null, {
            status: 302,
            headers: {
              Location: "/github?connected=1",
              "Set-Cookie": [result.setCookie, result.clearStateCookie].join(", "),
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "GitHub connection failed.";
          return Response.redirect(new URL(`/github?error=${encodeURIComponent(message)}`, request.url), 302);
        }
      },
    },
  },
});
