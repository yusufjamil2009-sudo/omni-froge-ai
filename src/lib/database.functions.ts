import { createServerFn } from "@tanstack/react-start";
import { databaseProviderIds, getDatabaseConnectionState, testDatabaseConnection, type DatabaseProviderId } from "./omnifrog/database.server";

async function guard(){ const { requireSession } = await import("./omnifrog/session.server"); await requireSession(); }

export const getDatabaseConnections = createServerFn({method:"GET"}).handler(async()=>{ await guard(); return getDatabaseConnectionState(); });

export const testDatabase = createServerFn({method:"POST"})
  .inputValidator((input:{provider:string})=>{
    if (!databaseProviderIds.includes(input?.provider as DatabaseProviderId)) throw new Error("Invalid database provider.");
    return {provider:input.provider as DatabaseProviderId};
  })
  .handler(async({data})=>{ await guard(); return testDatabaseConnection(data.provider); });
