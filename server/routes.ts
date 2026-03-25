import express from 'express';
import { getDb, type SessionRow, type FileChangeRow, type TaskRow } from './db.js';
import { syncIndex, getIndexStats, type SyncResult } from './indexer.js';
import { generateReportSummaries, getCachedSummaries } from './summarizer.js';
import { generateCSV, generatePDF } from './export.js';

function getDateRange(period: string, dateStr: string): { from: string; to: string } {
  const date = new Date(dateStr);

  if (period === 'weekly') {
    const day = date.getDay(); // 0 = Sunday, 1 = Monday
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      from: monday.toISOString().slice(0, 10),
      to: sunday.toISOString().slice(0, 10),
    };
  }

  if (period === 'monthly') {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    return {
      from: firstDay.toISOString().slice(0, 10),
      to: lastDay.toISOString().slice(0, 10),
    };
  }

  // daily (default)
  const dayStr = date.toISOString().slice(0, 10);
  return { from: dayStr, to: dayStr };
}

export function createRouter(): express.Router {
  const router = express.Router();

  // GET /api/projects
  router.get('/api/projects', (_req, res) => {
    const db = getDb();
    const rows = db.prepare(`
      SELECT project_path, COUNT(*) as session_count, MAX(ended_at) as last_activity
      FROM sessions
      GROUP BY project_path
      ORDER BY last_activity DESC
    `).all() as Array<{ project_path: string; session_count: number; last_activity: string | null }>;

    res.json({
      projects: rows.map((r) => ({
        path: r.project_path,
        sessionCount: r.session_count,
        lastActivity: r.last_activity,
      })),
    });
  });

  // Shared report-building logic
  async function buildReport(period: string, dateStr: string, project: string, skipLLM?: boolean) {
    const { from, to } = getDateRange(period, dateStr);
    const fromTs = `${from}T00:00:00`;
    const toTs = `${to}T23:59:59`;

    const db = getDb();

    // Build project filter
    const projectFilter = project !== 'all' ? ' AND s.project_path = ?' : '';
    const projectParams = project !== 'all' ? [project] : [];

    // Summary
    const summaryRow = db.prepare(`
      SELECT
        COUNT(*) as session_count,
        COALESCE(SUM(s.message_count), 0) as message_count,
        COALESCE(SUM(s.input_tokens), 0) as input_tokens,
        COALESCE(SUM(s.output_tokens), 0) as output_tokens
      FROM sessions s
      WHERE s.started_at >= ? AND s.started_at <= ?${projectFilter}
    `).get(fromTs, toTs, ...projectParams) as {
      session_count: number;
      message_count: number;
      input_tokens: number;
      output_tokens: number;
    };

    const filesChangedRow = db.prepare(`
      SELECT COUNT(DISTINCT fc.id) as files_changed
      FROM file_changes fc
      JOIN sessions s ON fc.session_id = s.id
      WHERE s.started_at >= ? AND s.started_at <= ?${projectFilter}
    `).get(fromTs, toTs, ...projectParams) as { files_changed: number };

    const tasksCompletedRow = db.prepare(`
      SELECT COUNT(*) as tasks_completed
      FROM tasks t
      JOIN sessions s ON t.session_id = s.id
      WHERE s.started_at >= ? AND s.started_at <= ?${projectFilter}
        AND t.status = 'completed'
    `).get(fromTs, toTs, ...projectParams) as { tasks_completed: number };

    // Sessions
    const sessions = db.prepare(`
      SELECT * FROM sessions s
      WHERE s.started_at >= ? AND s.started_at <= ?${projectFilter}
      ORDER BY s.started_at DESC
    `).all(fromTs, toTs, ...projectParams) as SessionRow[];

    // File changes with project_path
    const fileChanges = db.prepare(`
      SELECT fc.*, s.project_path
      FROM file_changes fc
      JOIN sessions s ON fc.session_id = s.id
      WHERE s.started_at >= ? AND s.started_at <= ?${projectFilter}
      ORDER BY fc.timestamp ASC
    `).all(fromTs, toTs, ...projectParams) as Array<FileChangeRow & { project_path: string }>;

    // Tasks with project_path
    const tasks = db.prepare(`
      SELECT t.*, s.project_path
      FROM tasks t
      JOIN sessions s ON t.session_id = s.id
      WHERE s.started_at >= ? AND s.started_at <= ?${projectFilter}
      ORDER BY t.created_at ASC
    `).all(fromTs, toTs, ...projectParams) as Array<TaskRow & { project_path: string }>;

    // Group by project
    const projectSessions = db.prepare(`
      SELECT id, project_path, summary, started_at, ended_at, message_count,
             input_tokens, output_tokens
      FROM sessions s
      WHERE s.started_at >= ? AND s.started_at <= ?
      ${projectFilter}
      ORDER BY s.project_path, s.started_at
    `).all(fromTs, toTs, ...projectParams) as any[];

    interface ProjectReport {
      path: string;
      shortName: string;
      sessionCount: number;
      messageCount: number;
      inputTokens: number;
      outputTokens: number;
      filesChanged: number;
      tasksCompleted: number;
      sessions: Array<{
        id: string;
        summary: string | null;
        started_at: string | null;
        ended_at: string | null;
        message_count: number;
      }>;
    }

    const projectMap = new Map<string, ProjectReport>();
    for (const s of projectSessions) {
      if (!projectMap.has(s.project_path)) {
        projectMap.set(s.project_path, {
          path: s.project_path,
          shortName: s.project_path.split('/').pop() || s.project_path,
          sessionCount: 0,
          messageCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          filesChanged: 0,
          tasksCompleted: 0,
          sessions: [],
        });
      }
      const proj = projectMap.get(s.project_path)!;
      proj.sessionCount++;
      proj.messageCount += s.message_count;
      proj.inputTokens += s.input_tokens;
      proj.outputTokens += s.output_tokens;
      proj.sessions.push({
        id: s.id,
        summary: s.summary,
        started_at: s.started_at,
        ended_at: s.ended_at,
        message_count: s.message_count,
      });
    }

    // Count files changed per project
    const fileCountsByProject = db.prepare(`
      SELECT s.project_path, COUNT(DISTINCT fc.file_path) as count
      FROM file_changes fc JOIN sessions s ON fc.session_id = s.id
      WHERE s.started_at >= ? AND s.started_at <= ?
      ${projectFilter}
      GROUP BY s.project_path
    `).all(fromTs, toTs, ...projectParams) as any[];
    for (const fc of fileCountsByProject) {
      const proj = projectMap.get(fc.project_path);
      if (proj) proj.filesChanged = fc.count;
    }

    // Count completed tasks per project
    const taskCountsByProject = db.prepare(`
      SELECT s.project_path, COUNT(*) as count
      FROM tasks t JOIN sessions s ON t.session_id = s.id
      WHERE s.started_at >= ? AND s.started_at <= ? AND t.status = 'completed'
      ${projectFilter}
      GROUP BY s.project_path
    `).all(fromTs, toTs, ...projectParams) as any[];
    for (const tc of taskCountsByProject) {
      const proj = projectMap.get(tc.project_path);
      if (proj) proj.tasksCompleted = tc.count;
    }

    // Sort projects by session count descending
    const projects = [...projectMap.values()].sort((a, b) => b.sessionCount - a.sessionCount);

    // Generate LLM summaries for each project (or use cached only for exports)
    let projectsWithBullets: Array<ProjectReport & { bullets: string[] }>;
    if (skipLLM) {
      // Export path: only use already-cached summaries, no API calls
      const summaryMap = getCachedSummaries(
        projects.map(p => ({ path: p.path })),
        from, to
      );
      projectsWithBullets = projects.map(p => ({
        ...p,
        bullets: summaryMap.get(p.path) || [],
      }));
    } else {
      try {
        const summaryMap = await generateReportSummaries(
          projects.map(p => ({
            path: p.path,
            sessions: p.sessions.map(s => ({
              id: s.id,
              summary: s.summary,
              started_at: s.started_at,
            })),
          })),
          from, to
        );
        projectsWithBullets = projects.map(p => ({
          ...p,
          bullets: summaryMap.get(p.path) || [],
        }));
      } catch (err) {
        console.error('LLM summary generation failed:', err);
        projectsWithBullets = projects.map(p => ({ ...p, bullets: [] }));
      }
    }

    return {
      period,
      from,
      to,
      summary: {
        sessionCount: summaryRow.session_count,
        messageCount: summaryRow.message_count,
        inputTokens: summaryRow.input_tokens,
        outputTokens: summaryRow.output_tokens,
        filesChanged: filesChangedRow.files_changed,
        tasksCompleted: tasksCompletedRow.tasks_completed,
      },
      sessions,
      fileChanges,
      tasks,
      projects: projectsWithBullets,
    };
  }

  // GET /api/report
  router.get('/api/report', async (req, res) => {
   try {
    const period = (req.query.period as string) || 'daily';
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const project = (req.query.project as string) || 'all';

    const report = await buildReport(period, date, project);
    res.json(report);
   } catch (err) {
    console.error('Report generation failed:', err);
    res.status(500).json({ error: 'Failed to generate report' });
   }
  });

  // GET /api/export/csv
  router.get('/api/export/csv', async (req, res) => {
    try {
      const period = (req.query.period as string) || 'daily';
      const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
      const project = (req.query.project as string) || 'all';

      const report = await buildReport(period, date, project, true);
      const csv = generateCSV(report);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="claude-report-${date}.csv"`);
      res.send(csv);
    } catch (err) {
      console.error('CSV export failed:', err);
      res.status(500).json({ error: 'Failed to generate CSV export' });
    }
  });

  // GET /api/export/pdf
  router.get('/api/export/pdf', async (req, res) => {
    try {
      const period = (req.query.period as string) || 'daily';
      const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
      const project = (req.query.project as string) || 'all';

      const report = await buildReport(period, date, project, true);
      const pdfBuffer = await generatePDF(report);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Content-Disposition', `inline; filename="claude-report-${date}.pdf"`);
      res.end(pdfBuffer);
    } catch (err) {
      console.error('PDF export failed:', err);
      res.status(500).json({ error: 'Failed to generate PDF export' });
    }
  });

  // GET /api/report/:sessionId/highlights
  router.get('/api/report/:sessionId/highlights', (req, res) => {
    const db = getDb();
    const highlights = db.prepare(
      'SELECT type, content, timestamp FROM session_highlights WHERE session_id = ? ORDER BY timestamp'
    ).all(req.params.sessionId);
    res.json({ highlights });
  });

  // POST /api/sync
  router.post('/api/sync', (req, res) => {
    try {
      const force = req.body?.force === true;
      const result: SyncResult = syncIndex(force);
      res.json({ result });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/stats
  router.get('/api/stats', (_req, res) => {
    const stats = getIndexStats();
    res.json(stats);
  });

  return router;
}
