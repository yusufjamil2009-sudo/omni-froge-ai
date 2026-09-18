import { createFileRoute } from "@tanstack/react-router";
import { disconnectGitHub } from "@/lib/omnifrog/github-oauth.server";

export const Route = createFileRoute("/api/github/disconnect")({
  server: {
    handlers: {
      GET: ({ request }) =>
        new Response(null, {
          status: 302,
          headers: {
            Location: "/github?disconnected=1",
            "Set-Cookie": disconnectGitHub(),
          },
        }),
    },
  },
});
