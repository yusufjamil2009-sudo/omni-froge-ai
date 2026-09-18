import { createFileRoute } from "@tanstack/react-router";
import { createGitHubAuthorizeUrl } from "@/lib/omnifrog/github-oauth.server";

export const Route = createFileRoute("/api/github/connect")({
  server: {
    handlers: {
      GET: ({ request }) => {
        try {
          const result = createGitHubAuthorizeUrl(request);
          return new Response(null, {
            status: 302,
            headers: {
              Location: result.url,
              "Set-Cookie": result.stateCookie,
            },
          });
        } catch {
          return Response.redirect(new URL("/github?error=GitHub%20OAuth%20is%20not%20configured.", request.url), 302);
        }
      },
    },
  },
});
