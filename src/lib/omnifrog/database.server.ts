import { z } from "zod";

export const databaseProviderIds = ["supabase","turso","convex","appwrite"] as const;
export type DatabaseProviderId = typeof databaseProviderIds[number];

const credentialsSchema = z.object({
  url: z.string().url().optional(),
  token: z.string().min(1).optional(),
  key: z.string().min(1).optional(),
  project: z.string().min(1).optional(),
  deployment: z.string().min(1).optional(),
  endpoint: z.string().url().optional(),
});

function envFor(provider: DatabaseProviderId) {
  if (provider === "supabase") return { url: process.env.SUPABASE_URL, secret: process.env.SUPABASE_SERVICE_ROLE_KEY };
  if (provider === "turso") return { url: process.env.TURSO_DATABASE_URL, token: process.env.TURSO_AUTH_TOKEN };
  if (provider === "convex") return { url: process.env.CONVEX_URL, token: process.env.CONVEX_DEPLOY_KEY };
  return { url: process.env.APPWRITE_ENDPOINT, token: process.env.APPWRITE_API_KEY, project: process.env.APPWRITE_PROJECT_ID };
}

function classify(status: number): "AUTH_ERROR"|"UNAVAILABLE"|"WORKING"|"UNKNOWN_ERROR" {
  if (status === 401 || status === 403) return "AUTH_ERROR";
  if (status >= 200 && status < 300) return "WORKING";
  if (status === 429 || status >= 500) return "UNAVAILABLE";
  return "UNKNOWN_ERROR";
}

export async function testDatabaseConnection(provider: DatabaseProviderId) {
  const env = envFor(provider);
  if (provider === "supabase") {
    if (!env.url || !env.secret) return { ok:false, status:"NOT_CONFIGURED" as const, message:"Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." };
    const response = await fetch(`${env.url}/rest/v1/`, { headers:{ apikey:env.secret, Authorization:`Bearer ${env.secret}` } });
    return { ok:response.ok, status:classify(response.status), message:response.ok?"Supabase REST is reachable.":`Supabase returned HTTP ${response.status}.` };
  }
  if (provider === "turso") {
    if (!env.url || !env.token) return { ok:false, status:"NOT_CONFIGURED" as const, message:"Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN." };
    const response = await fetch(`${env.url.replace(/\\/$/,"")}/v2/pipeline`, { method:"POST", headers:{ Authorization:`Bearer ${env.token}`, "content-type":"application/json" }, body:JSON.stringify({ requests:[] }) });
    return { ok:response.ok, status:classify(response.status), message:response.ok?"Turso HTTP endpoint is reachable.":`Turso returned HTTP ${response.status}.` };
  }
  if (provider === "convex") {
    if (!env.url || !env.token) return { ok:false, status:"NOT_CONFIGURED" as const, message:"Set CONVEX_URL and CONVEX_DEPLOY_KEY." };
    const response = await fetch(env.url, { headers:{ Authorization:`Bearer ${env.token}` } });
    return { ok:response.ok, status:classify(response.status), message:response.ok?"Convex deployment URL is reachable.":`Convex returned HTTP ${response.status}.` };
  }
  if (!env.url || !env.token || !env.project) return { ok:false, status:"NOT_CONFIGURED" as const, message:"Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID and APPWRITE_API_KEY." };
  const endpoint = env.url.replace(/\\/$/,"");
  const response = await fetch(`${endpoint}/v1/health`, { headers:{ "X-Appwrite-Project":env.project, "X-Appwrite-Key":env.token } });
  return { ok:response.ok, status:classify(response.status), message:response.ok?"Appwrite endpoint is reachable.":`Appwrite returned HTTP ${response.status}.` };
}

export async function getDatabaseConnectionState() {
  const state: Record<string, {configured:boolean}> = {};
  for (const id of databaseProviderIds) {
    const env = envFor(id);
    state[id] = { configured: id==="supabase" ? Boolean(env.url && env.secret) : id==="turso" ? Boolean(env.url&&env.token) : id==="convex" ? Boolean(env.url&&env.token) : Boolean(env.url&&env.token&&env.project) };
  }
  return state;
}

export function validateDatabaseCredentials(input: unknown) {
  return credentialsSchema.parse(input);
}
