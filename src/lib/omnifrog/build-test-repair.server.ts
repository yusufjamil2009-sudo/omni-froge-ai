import { z } from "zod";
import { runBrowserFirstAi } from "./browser-first";
import { logLiveActivity, updateProjectBuildState } from "./projects.server";
import type { BuildCheck, BuildTestReport, GeneratedFile } from "./types";

const repairSchema = z.object({
  files: z.array(z.object({
    path: z.string().min(1).max(240),
    operation: z.enum(["create", "update"]),
    language: z.enum(["typescript","javascript","tsx","jsx","css","html","json","markdown","text","other"]),
    content: z.string().max(500_000),
    reason: z.string().min(1).max(500),
  })).max(50),
});

const protectedPath = /(^|\\/)(node_modules|\\.git|\\.env(?:\\.|$)|dist|build|coverage)(\\/|$)/i;
const absolutePath = /^(?:[A-Za-z]:[\\\\/]|[\\\\/]{2}|\\/)/;

function checkFiles(files: Array<{path:string;content?:string;operation?:string}>): BuildCheck[] {
  const checks: BuildCheck[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const path = file.path.trim().replace(/\\\\/g, "/").replace(/^\\.\\//, "");
    if (!path || absolutePath.test(path) || path.split("/").includes("..")) checks.push({id:"unsafe-path",severity:"error",message:"Unsafe project path.",filePath:file.path});
    if (protectedPath.test(path)) checks.push({id:"protected-path",severity:"error",message:"Protected/generated path cannot be modified.",filePath:path});
    if (seen.has(path)) checks.push({id:"duplicate-path",severity:"error",message:"Duplicate file path in build input.",filePath:path});
    seen.add(path);
    const content=file.content ?? "";
    if (file.operation !== "delete" && !content.trim()) checks.push({id:"empty-file",severity:"error",message:"Source file is empty.",filePath:path});
    if (/\\b(TODO|FIXME)\\b/.test(content)) checks.push({id:"unfinished-marker",severity:"warning",message:"Unfinished TODO/FIXME marker detected.",filePath:path});
    if (/^<<<<<<< |^=======$|^>>>>>>> /m.test(content)) checks.push({id:"merge-conflict",severity:"error",message:"Merge-conflict markers detected.",filePath:path});
    const ext=path.split(".").pop()?.toLowerCase();
    if (["ts","tsx","js","jsx"].includes(ext ?? "")) {
      const opens=(content.match(/[({[<]/g) ?? []).length;
      const closes=(content.match(/[)}\]>]/g) ?? []).length;
      if (Math.abs(opens-closes)>1) checks.push({id:"delimiter-balance",severity:"error",message:"Likely unbalanced delimiters in source.",filePath:path});
    }
    if (ext==="json") { try { JSON.parse(content); } catch { checks.push({id:"invalid-json",severity:"error",message:"Invalid JSON syntax.",filePath:path}); } }
  }
  const pkg=files.find(f=>f.path.replace(/^\\.\\//,"")==="package.json");
  if (pkg?.content) { try { const parsed=JSON.parse(pkg.content) as Record<string,unknown>; if (!parsed.scripts) checks.push({id:"missing-scripts",severity:"warning",message:"package.json has no scripts object.",filePath:"package.json"}); } catch {} }
  return checks;
}

export function runBuildPreflight(files: Array<{path:string;content:string;operation?:string}>): BuildTestReport {
  const checks=checkFiles(files);
  const errorCount=checks.filter(c=>c.severity==="error").length;
  const warningCount=checks.filter(c=>c.severity==="warning").length;
  return {passed:errorCount===0,checks,testedAt:new Date().toISOString(),fileCount:files.length,errorCount,warningCount,repairAttempts:0};
}

function extractJson(text:string):unknown {
  const clean=text.trim().replace(/^\`\`\`(?:json)?\\s*/i,"").replace(/\\s*\`\`\`$/i,"");
  try{return JSON.parse(clean);}catch{}
  const start=clean.indexOf("{"),end=clean.lastIndexOf("}");
  if(start>=0&&end>start)return JSON.parse(clean.slice(start,end+1));
  throw new Error("Repair AI returned invalid JSON.");
}

export async function testAndRepairProject(input:{
  projectId:string;
  files:Array<{path:string;content:string;operation?:string}>;
  originalRequest:string;
  maxRepairAttempts?:number;
  onProgress?:(p:{progress:number;text:string})=>void;
}):Promise<{report:BuildTestReport;files:Array<{path:string;content:string}>;source:"browser"|"api-fallback"|"none"}> {
  let files=input.files.map(f=>({path:f.path,content:f.content}));
  const maxAttempts=Math.max(0,Math.min(input.maxRepairAttempts ?? 3,5));
  let report=runBuildPreflight(files);
  let source:"browser"|"api-fallback"|"none"="none";

  await logLiveActivity({projectId:input.projectId,level:report.passed?"done":"active",message:report.passed?"Build preflight passed":"Build preflight found issues",operation:"build.preflight",details:{errors:report.errorCount,warnings:report.warningCount}}).catch(()=>undefined);

  for(let attempt=1;attempt<=maxAttempts&&!report.passed;attempt++){
    input.onProgress?.({progress:Math.round(((attempt-1)/maxAttempts)*100),text:\`Repair attempt \${attempt}/\${maxAttempts}\`});
    await logLiveActivity({projectId:input.projectId,level:"active",message:\`Automatic repair attempt \${attempt}/\${maxAttempts}\`,operation:"repair.start",details:{attempt,errors:report.errorCount}}).catch(()=>undefined);
    const result=await runBrowserFirstAi({
      prompt:JSON.stringify({request:input.originalRequest,errors:report.checks.filter(c=>c.severity==="error"),warnings:report.checks.filter(c=>c.severity==="warning"),files}),
      system:"You are OmniFrog AI's automatic repair engineer. Return ONLY JSON: {files:[{path,operation,language,content,reason}]}. Fix only reported issues. Preserve intended behavior. Never edit protected paths, secrets, dependencies, or unrelated files. Return complete replacement contents for files you change.",
      maxTokens:12000,onProgress:input.onProgress
    });
    source=result.source;
    if(!result.ok||!result.text){await logLiveActivity({projectId:input.projectId,level:"error",message:\`Repair attempt \${attempt} could not obtain an AI fix\`,operation:"repair.failed",details:{attempt}}).catch(()=>undefined);break;}
    try{
      const parsed=repairSchema.parse(extractJson(result.text));
      const map=new Map(files.map(f=>[f.path,f.content]));
      for(const change of parsed.files as GeneratedFile[]){
        const path=change.path.trim().replace(/\\\\/g,"/").replace(/^\\.\\//,"");
        if(absolutePath.test(path)||path.split("/").includes("..")||protectedPath.test(path))throw new Error(\`Unsafe repair path: \${path}\`);
        const before = map.get(path) ?? "";
        await logLiveActivity({
          projectId: input.projectId,
          level: "active",
          message: \`Repairing \${path}\`,
          filePath: path,
          operation: \`file.\${change.operation}\`,
          details: {
            before: before.slice(0, 20000),
            after: change.content.slice(0, 20000),
            beforeLines: before ? before.split("\\n").length : 0,
            afterLines: change.content.split("\\n").length,
            repairAttempt: attempt,
          },
        }).catch(()=>undefined);
        map.set(path,change.content);
      }
      files=[...map.entries()].map(([path,content])=>({path,content}));
      report=runBuildPreflight(files); report.repairAttempts=attempt;
      await logLiveActivity({projectId:input.projectId,level:report.passed?"done":"warning",message:report.passed?\`Repair attempt \${attempt} passed preflight\`:\`Repair attempt \${attempt} still has \${report.errorCount} error(s)\`,operation:"repair.result",details:{attempt,errors:report.errorCount,warnings:report.warningCount}}).catch(()=>undefined);
    }catch(error){
      report.checks.push({id:"repair-output",severity:"error",message:error instanceof Error?error.message:"Repair output validation failed.",filePath:null});
      report.errorCount++; report.passed=false; report.repairAttempts=attempt;
    }
  }

  await updateProjectBuildState(input.projectId,{buildTestReport:report as never,generatedSourceFiles:files.map(f=>({path:f.path,content:f.content})) as never,lastBuildTestedAt:report.testedAt,repairAttempts:report.repairAttempts},report.passed?"COMPLETED":"FAILED");
  return {report,files,source};
}
