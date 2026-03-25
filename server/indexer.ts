import fs from 'node:fs';
import { getDb } from './db.js';
import { scanConversations, type ConversationFile } from './scanner.js';
import {
  parseConversationFile,
  extractFileChanges,
  extractHighlights,
  extractTasks,
  extractUsageFromFile,
} from 'claude-conversation-parser';

export interface SyncResult {
  total: number;
  indexed: number;
  skipped: number;
  errors: number;
  duration: number;
}

export function syncIndex(force?: boolean): SyncResult {
  const start = Date.now();
  const db = getDb();
  const files = scanConversations();

  const result: SyncResult = {
    total: files.length,
    indexed: 0,
    skipped: 0,
    errors: 0,
    duration: 0,
  };

  const existingStmt = db.prepare(
    'SELECT file_mtime FROM sessions WHERE id = ?'
  );

  for (const file of files) {
    const existing = existingStmt.get(file.sessionId) as
      | { file_mtime: number }
      | undefined;

    if (!force && existing && existing.file_mtime === file.mtime) {
      result.skipped++;
      continue;
    }

    try {
      indexSession(file);
      result.indexed++;
    } catch (err) {
      console.error(`Error indexing ${file.sessionId}:`, err);
      result.errors++;
    }
  }

  result.duration = Date.now() - start;
  return result;
}

export function indexSession(file: ConversationFile): void {
  console.log(`Indexing ${file.sessionId} (${file.projectPath})...`);

  const db = getDb();
  const content = fs.readFileSync(file.filePath, 'utf-8');

  const messages = parseConversationFile(file.filePath, undefined, content);
  const fileChanges = extractFileChanges(content);
  const highlights = extractHighlights(messages);
  const tasks = extractTasks(content);
  const usage = extractUsageFromFile(file.filePath, file.sessionId);

  // Derive session summary from first user highlight
  const firstUserHighlight = highlights.find(h => h.type === 'user');
  const summary = firstUserHighlight
    ? firstUserHighlight.content.slice(0, 200)
    : null;

  const startedAt =
    messages.length > 0
      ? new Date(messages[0].timestamp).toISOString()
      : null;
  const endedAt =
    messages.length > 0
      ? new Date(messages[messages.length - 1].timestamp).toISOString()
      : null;

  const insertSession = db.prepare(`
    INSERT OR REPLACE INTO sessions
      (id, project_dir, project_path, file_path, file_mtime, file_size,
       started_at, ended_at, message_count, summary, input_tokens, output_tokens,
       cache_read_tokens, cache_creation_tokens, indexed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const deleteFileChanges = db.prepare(
    'DELETE FROM file_changes WHERE session_id = ?'
  );
  const deleteTasks = db.prepare('DELETE FROM tasks WHERE session_id = ?');
  const deleteHighlights = db.prepare(
    'DELETE FROM session_highlights WHERE session_id = ?'
  );

  const insertFileChange = db.prepare(`
    INSERT OR IGNORE INTO file_changes (session_id, file_path, action, timestamp)
    VALUES (?, ?, ?, ?)
  `);

  const insertTask = db.prepare(`
    INSERT INTO tasks (session_id, task_id, subject, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertHighlight = db.prepare(
    'INSERT INTO session_highlights (session_id, type, content, timestamp) VALUES (?, ?, ?, ?)'
  );

  const runTransaction = db.transaction(() => {
    deleteFileChanges.run(file.sessionId);
    deleteTasks.run(file.sessionId);
    deleteHighlights.run(file.sessionId);

    insertSession.run(
      file.sessionId,
      file.projectDir,
      file.projectPath,
      file.filePath,
      file.mtime,
      file.size,
      startedAt,
      endedAt,
      messages.length,
      summary,
      usage.totalInputTokens,
      usage.totalOutputTokens,
      usage.totalCacheReadTokens,
      usage.totalCacheCreationTokens,
      new Date().toISOString()
    );

    for (const fc of fileChanges) {
      insertFileChange.run(
        file.sessionId,
        fc.path,
        fc.action,
        new Date(fc.timestamp).toISOString()
      );
    }

    for (const task of tasks) {
      insertTask.run(
        file.sessionId,
        task.id,
        task.subject,
        task.status,
        new Date(task.createdAt).toISOString(),
        new Date(task.updatedAt).toISOString()
      );
    }

    // Insert highlights (user messages only — these describe what was done)
    const userHighlights = highlights.filter(h => h.type === 'user');
    for (const h of userHighlights) {
      const content = h.content.slice(0, 500); // truncate long messages
      insertHighlight.run(
        file.sessionId,
        h.type,
        content,
        h.timestamp ? new Date(h.timestamp).toISOString() : null
      );
    }
  });

  runTransaction();
}

export function getIndexStats(): {
  sessionCount: number;
  lastSync: string | null;
} {
  const db = getDb();
  const row = db
    .prepare(
      'SELECT COUNT(*) as count, MAX(indexed_at) as lastSync FROM sessions'
    )
    .get() as { count: number; lastSync: string | null };

  return {
    sessionCount: row.count,
    lastSync: row.lastSync,
  };
}
