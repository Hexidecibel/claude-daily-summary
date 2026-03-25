import fs from "fs";
import os from "os";
import path from "path";

export interface ConversationFile {
  sessionId: string;
  projectDir: string;
  projectPath: string;
  filePath: string;
  mtime: number;
  size: number;
}

const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");

const decodedPathCache = new Map<string, string>();

export function decodeProjectDir(dirName: string): string {
  if (decodedPathCache.has(dirName)) {
    return decodedPathCache.get(dirName)!;
  }

  const resolved = resolveProjectDir(dirName);
  decodedPathCache.set(dirName, resolved);
  return resolved;
}

function resolveProjectDir(dirName: string): string {
  // Remove leading dash (represents root /)
  const stripped = dirName.startsWith("-") ? dirName.slice(1) : dirName;
  const segments = stripped.split("-");

  if (segments.length === 0) {
    return "/";
  }

  let currentPath = "";

  let i = 0;
  while (i < segments.length) {
    let candidate = currentPath + "/" + segments[i];
    let j = i;

    try {
      const stat = fs.statSync(candidate);
      if (stat.isDirectory()) {
        currentPath = candidate;
        i = j + 1;
        continue;
      }
    } catch {
      // directory doesn't exist, try appending more segments
    }

    // Try appending subsequent segments with dashes
    let found = false;
    for (let k = j + 1; k < segments.length; k++) {
      candidate += "-" + segments[k];
      try {
        const stat = fs.statSync(candidate);
        if (stat.isDirectory()) {
          currentPath = candidate;
          i = k + 1;
          found = true;
          break;
        }
      } catch {
        // keep trying
      }
    }

    if (!found) {
      // Fallback: naive replacement for remaining segments
      return "/" + stripped.replace(/-/g, "/");
    }
  }

  return currentPath;
}

function walkJsonlFiles(dir: string, skipDirs: Set<string>): string[] {
  const results: string[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (skipDirs.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...walkJsonlFiles(fullPath, skipDirs));
    } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      results.push(fullPath);
    }
  }

  return results;
}

export function scanConversations(): ConversationFile[] {
  const skipDirs = new Set(["node_modules", "memory"]);
  const results: ConversationFile[] = [];

  let projectDirs: fs.Dirent[];
  try {
    projectDirs = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const projEntry of projectDirs) {
    if (!projEntry.isDirectory() || skipDirs.has(projEntry.name)) {
      continue;
    }

    const projFullPath = path.join(PROJECTS_DIR, projEntry.name);
    const jsonlFiles = walkJsonlFiles(projFullPath, skipDirs);

    for (const filePath of jsonlFiles) {
      const basename = path.basename(filePath, ".jsonl");

      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
      } catch {
        continue;
      }

      results.push({
        sessionId: basename,
        projectDir: projEntry.name,
        projectPath: decodeProjectDir(projEntry.name),
        filePath,
        mtime: stat.mtimeMs,
        size: stat.size,
      });
    }
  }

  return results;
}
