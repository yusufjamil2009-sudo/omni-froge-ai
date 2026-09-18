import type { PreviewSourceFile } from "./types";

export type RuntimeKind = "static-html" | "unsupported-framework" | "empty";
export type RuntimeStatus = "IDLE" | "STARTING" | "RUNNING" | "STOPPED" | "ERROR";
export interface RuntimeDiagnostic { level: "info" | "warn" | "error"; message: string; source?: string; }
export interface RuntimeManifest { kind: RuntimeKind; entryFile: string | null; htmlFiles: string[]; cssFiles: string[]; jsFiles: string[]; framework: string | null; diagnostics: RuntimeDiagnostic[]; }
const protectedPath = /(^|\/)(node_modules|\.git|\.env(?:\.|$)|dist|build|coverage)(\/|$)/i;
export function createRuntimeManifest(files: PreviewSourceFile[]): RuntimeManifest {
 const safe=files.filter(f=>{const p=f.path.replace(/\\/g,"/").replace(/^\.\/+/, "").trim(); return p&&!protectedPath.test(p)&&!p.split("/").includes("..")&&!/^(?:[A-Za-z]:[\\/]|\/)/.test(p);});
 const htmlFiles=safe.filter(f=>/\.html?$/i.test(f.path)).map(f=>f.path);
 const cssFiles=safe.filter(f=>/\.css$/i.test(f.path)).map(f=>f.path);
 const jsFiles=safe.filter(f=>/\.(?:js|mjs)$/i.test(f.path)).map(f=>f.path);
 const entry=safe.find(f=>(/^|\/)index\.html$/i.test(f.path))?.path ?? null;
 const packageFile=safe.find(f=>(/^|\/)package\.json$/i.test(f.path));
 let framework:string|null=null; const diagnostics:RuntimeDiagnostic[]=[];
 if(packageFile){try{const pkg=JSON.parse(packageFile.content) as {dependencies?:Record<string,string>;devDependencies?:Record<string,string>}; const deps={...(pkg.dependencies??{}),...(pkg.devDependencies??{})}; if(deps.next)framework="Next.js"; else if(deps.vite)framework="Vite"; else if(deps.react)framework="React"; else if(deps.vue)framework="Vue"; else if(deps["@angular/core"])framework="Angular";}catch{diagnostics.push({level:"error",message:"package.json is invalid JSON."});}}
 if(!entry){if(framework)diagnostics.push({level:"warn",message:framework+" project detected, but the built-in runtime needs browser-ready HTML. Full dependency/runtime execution is handled by the sandbox boundary in this part without executing arbitrary npm packages in the host process."}); else diagnostics.push({level:"info",message:"No index.html entry found. Add index.html for the built-in browser runtime."});}
 return {kind:entry?"static-html":framework?"unsupported-framework":"empty",entryFile:entry,htmlFiles,cssFiles,jsFiles,framework,diagnostics};
}
export function buildRuntimeDocument(files: PreviewSourceFile[]): string|null {
 const manifest=createRuntimeManifest(files); if(!manifest.entryFile)return null; const entry=files.find(f=>f.path===manifest.entryFile); if(!entry)return null;
 let html=entry.content; const css=manifest.cssFiles.map(p=>files.find(f=>f.path===p)?.content??"").join("\n"); const js=manifest.jsFiles.map(p=>files.find(f=>f.path===p)?.content??"").join("\n");
 const bridge="<script>(()=>{const send=(type,payload)=>{try{parent.postMessage({source:\"omnifrog-runtime\",type,payload},\"*\")}catch{}};window.addEventListener(\"error\",e=>send(\"error\",{message:e.message||\"Runtime error\",source:e.filename||\"\"}));window.addEventListener(\"unhandledrejection\",e=>send(\"error\",{message:String(e.reason||\"Unhandled promise rejection\")}));const wrap=(level)=>{const original=console[level];console[level]=(...args)=>{send(\"console\",{level,message:args.map(String).join(\" \")});original.apply(console,args)}};wrap(\"log\");wrap(\"warn\");wrap(\"error\");send(\"ready\",{title:document.title||\"OmniFrog Runtime\"})})();</script>";
 if(css)html=html.includes("</head>")?html.replace("</head>","<style data-omnifrog-runtime>"+css+"</style></head>"):"<style data-omnifrog-runtime>"+css+"</style>"+html;
 html=html.includes("</head>")?html.replace("</head>",bridge+"</head>"):bridge+html;
 if(js)html=html.includes("</body>")?html.replace("</body>","<script data-omnifrog-bundle>"+js+"</script></body>"):html+"<script data-omnifrog-bundle>"+js+"</script>";
 return html;
}