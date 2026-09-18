/**
 * PART 06 — server-side project file editor.
 *
 * This is deliberately the only persistence boundary for generated source
 * files in this part. Authentication is checked before every mutation.
 */
import type { GeneratedFile, ProjectFile } from "./types";

function cleanPath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

export function applyGeneratedFiles(
  currentFiles: ProjectFile[],
  changes: GeneratedFile[],
): ProjectFile[] {
  const map = new Map(currentFiles.map((file) => [cleanPath(file.path), { ...file }]));

  for (const change of changes) {
    const path = cleanPath(change.path);
    if (change.operation === "delete") {
      map.delete(path);
      continue;
    }
    map.set(path, {
      path,
      size: new TextEncoder().encode(change.content).byteLength,
      updatedAt: new Date().toISOString(),
    });
  }

  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
}
