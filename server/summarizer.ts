import Anthropic from '@anthropic-ai/sdk';
import { getDb } from './db.js';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic();  // uses ANTHROPIC_API_KEY env var
  }
  return _client;
}

// Migrate: drop old table, create new daily_summaries table
export function ensureSummaryCache(): void {
  const db = getDb();
  db.exec(`DROP TABLE IF EXISTS report_summaries`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_path TEXT NOT NULL,
      date TEXT NOT NULL,
      bullets TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      UNIQUE(project_path, date)
    )
  `);
}

// Returns array of YYYY-MM-DD strings from `from` (inclusive) to `to` (inclusive)
export function getDatesInRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// Generate and cache a summary for a single project on a single day
export async function generateDailySummary(
  projectPath: string,
  date: string,
  sessions: Array<{ id: string; summary: string | null }>
): Promise<string[]> {
  const db = getDb();

  // Check cache first
  const cached = db.prepare(
    'SELECT bullets FROM daily_summaries WHERE project_path = ? AND date = ?'
  ).get(projectPath, date) as { bullets: string } | undefined;

  if (cached) {
    return JSON.parse(cached.bullets);
  }

  // Build context from session highlights
  const sessionHighlights = sessions.map(s => {
    const highlights = db.prepare(
      'SELECT content FROM session_highlights WHERE session_id = ? AND type = ? ORDER BY timestamp'
    ).all(s.id, 'user') as { content: string }[];

    return {
      summary: s.summary,
      highlights: highlights.map(h => h.content),
    };
  });

  const context = sessionHighlights
    .map((s, i) => {
      const parts = [s.summary || '(no summary)'];
      if (s.highlights.length > 0) {
        parts.push(...s.highlights.slice(0, 5));
      }
      return `Session ${i + 1}:\n${parts.join('\n')}`;
    })
    .join('\n\n');

  if (!context.trim() || context.trim() === '(no summary)') {
    const bullets = ['No notable activity'];
    db.prepare(
      'INSERT OR REPLACE INTO daily_summaries (project_path, date, bullets, generated_at) VALUES (?, ?, ?, ?)'
    ).run(projectPath, date, JSON.stringify(bullets), new Date().toISOString());
    return bullets;
  }

  // Call Haiku
  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Below are highlights from Claude Code sessions in a software project during a work period. Summarize what was accomplished into concise bullet points. Be specific about what was built/fixed/changed, but keep each bullet to one short sentence. Focus on outcomes, not process. Omit trivial items. If sessions are about the same thing, merge them into one bullet.

Project: ${projectPath.split('/').pop()}

${context}

Return ONLY the bullet points, one per line, starting with "- ". No preamble, no headers.`
    }]
  });

  // Parse bullets from response
  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const bullets = responseText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- '))
    .map(line => line.slice(2).trim())
    .filter(Boolean);

  const finalBullets = bullets.length > 0 ? bullets : ['No notable activity'];

  // Cache the result
  db.prepare(
    'INSERT OR REPLACE INTO daily_summaries (project_path, date, bullets, generated_at) VALUES (?, ?, ?, ?)'
  ).run(projectPath, date, JSON.stringify(finalBullets), new Date().toISOString());

  return finalBullets;
}

// Query cached daily summaries for a date range, returns flat array of all bullets
export function getSummariesForRange(
  projectPath: string,
  from: string,
  to: string
): string[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT bullets FROM daily_summaries WHERE project_path = ? AND date >= ? AND date <= ? ORDER BY date'
  ).all(projectPath, from, to) as { bullets: string }[];

  const allBullets: string[] = [];
  for (const row of rows) {
    allBullets.push(...JSON.parse(row.bullets));
  }
  return allBullets;
}

// Get cached summaries only (no LLM calls) for use in exports
export function getCachedSummaries(
  projects: Array<{ path: string }>,
  from: string,
  to: string
): Map<string, string[]> {
  const db = getDb();
  ensureSummaryCache();

  const results = new Map<string, string[]>();
  for (const project of projects) {
    const rows = db.prepare(
      'SELECT bullets FROM daily_summaries WHERE project_path = ? AND date >= ? AND date <= ? ORDER BY date'
    ).all(project.path, from, to) as { bullets: string }[];

    const allBullets: string[] = [];
    for (const row of rows) {
      allBullets.push(...JSON.parse(row.bullets));
    }
    if (allBullets.length > 0) {
      results.set(project.path, allBullets);
    }
  }
  return results;
}

// Generate summaries for all projects in a report
export async function generateReportSummaries(
  projects: Array<{
    path: string;
    sessions: Array<{ id: string; summary: string | null; started_at: string | null }>;
  }>,
  from: string,
  to: string
): Promise<Map<string, string[]>> {
  const db = getDb();
  ensureSummaryCache();

  const dates = getDatesInRange(from, to);

  // Collect all (project, date, sessions) pairs that need generation
  const tasks: Array<{ projectPath: string; date: string; sessions: Array<{ id: string; summary: string | null }> }> = [];

  for (const project of projects) {
    for (const date of dates) {
      // Filter sessions that started on this date
      const daySessions = project.sessions.filter(s => {
        if (!s.started_at) return false;
        return s.started_at.slice(0, 10) === date;
      });

      if (daySessions.length === 0) continue;

      // Check if already cached
      const cached = db.prepare(
        'SELECT 1 FROM daily_summaries WHERE project_path = ? AND date = ?'
      ).get(project.path, date);

      if (!cached) {
        tasks.push({
          projectPath: project.path,
          date,
          sessions: daySessions.map(s => ({ id: s.id, summary: s.summary })),
        });
      }
    }
  }

  // Process tasks with concurrency limit of 3
  const chunks: typeof tasks[] = [];
  for (let i = 0; i < tasks.length; i += 3) {
    chunks.push(tasks.slice(i, i + 3));
  }

  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(task => generateDailySummary(task.projectPath, task.date, task.sessions))
    );
  }

  // Now aggregate cached results for each project
  const results = new Map<string, string[]>();

  for (const project of projects) {
    const rows = db.prepare(
      'SELECT bullets FROM daily_summaries WHERE project_path = ? AND date >= ? AND date <= ? ORDER BY date'
    ).all(project.path, from, to) as { bullets: string }[];

    const allBullets: string[] = [];
    for (const row of rows) {
      allBullets.push(...JSON.parse(row.bullets));
    }
    if (allBullets.length > 0) {
      results.set(project.path, allBullets);
    }
  }

  return results;
}
