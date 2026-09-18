import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { completeGithubOAuth } from "@/lib/github.functions";

export const Route = createFileRoute("/github-callback")({
  component: GithubCallbackPage,
});

function GithubCallbackPage() {
  const navigate = useNavigate();
  const complete = useServerFn(completeGithubOAuth);
  const [message, setMessage] = useState("Completing GitHub connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    if (error) {
      setMessage(`GitHub authorization was cancelled: ${error}`);
      return;
    }
    if (!code || !state) {
      setMessage("GitHub callback is missing required parameters.");
      return;
    }
    complete({ data: { code, state } })
      .then((result) => {
        setMessage(`GitHub connected as @${result.login}.`);
        setTimeout(() => navigate({ to: "/settings" }), 500);
      })
      .catch((err) => setMessage(err instanceof Error ? err.message : "GitHub connection failed."));
  }, [complete, navigate]);

  return <main className="flex min-h-screen items-center justify-center p-6"><div className="soft-panel max-w-md rounded-xl p-6 text-center"><h1 className="text-lg font-semibold">GitHub Connection</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p></div></main>;
}
