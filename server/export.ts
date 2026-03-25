import puppeteer from 'puppeteer';

interface ReportData {
  period: string;
  from: string;
  to: string;
  summary: {
    sessionCount: number;
    messageCount: number;
    inputTokens: number;
    outputTokens: number;
    filesChanged: number;
    tasksCompleted: number;
  };
  sessions: Array<{
    id: string;
    project_path: string;
    summary: string | null;
    started_at: string | null;
    ended_at: string | null;
    message_count: number;
  }>;
  fileChanges: Array<{
    file_path: string;
    action: string;
    timestamp: string | null;
    project_path: string;
  }>;
  tasks: Array<{
    subject: string;
    status: string;
    project_path: string;
  }>;
  projects: Array<{
    shortName: string;
    sessionCount: number;
    messageCount: number;
    inputTokens: number;
    outputTokens: number;
    filesChanged: number;
    tasksCompleted: number;
    bullets: string[];
    sessions: Array<{
      id: string;
      summary: string | null;
      started_at: string | null;
      ended_at: string | null;
      message_count: number;
    }>;
  }>;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(fields: (string | number)[]): string {
  return fields.map(f => escapeCSV(String(f))).join(',');
}

export function generateCSV(report: ReportData): string {
  const lines: string[] = [];

  // Summary section
  lines.push('Summary');
  lines.push('Period,From,To,Sessions,Messages,Input Tokens,Output Tokens,Files Changed,Tasks Completed');
  lines.push(csvRow([
    report.period,
    report.from,
    report.to,
    report.summary.sessionCount,
    report.summary.messageCount,
    report.summary.inputTokens,
    report.summary.outputTokens,
    report.summary.filesChanged,
    report.summary.tasksCompleted,
  ]));
  lines.push('');

  // Projects section
  lines.push('Projects');
  lines.push('Project,Sessions,Messages,Input Tokens,Output Tokens,Files Changed,Tasks,Summary');
  for (const p of report.projects) {
    const summary = p.bullets.join('; ');
    lines.push(csvRow([
      p.shortName,
      p.sessionCount,
      p.messageCount,
      p.inputTokens,
      p.outputTokens,
      p.filesChanged,
      p.tasksCompleted,
      summary,
    ]));
  }
  lines.push('');

  // Sessions section
  lines.push('Sessions');
  lines.push('Project,Session ID,Started,Ended,Messages,Summary');
  for (const s of report.sessions) {
    const projectName = s.project_path?.split('/').pop() || s.project_path || '';
    lines.push(csvRow([
      projectName,
      s.id,
      s.started_at || '',
      s.ended_at || '',
      s.message_count,
      s.summary || '',
    ]));
  }
  lines.push('');

  // File Changes section
  lines.push('File Changes');
  lines.push('Project,File Path,Action,Timestamp');
  for (const fc of report.fileChanges) {
    const projectName = fc.project_path?.split('/').pop() || fc.project_path || '';
    lines.push(csvRow([
      projectName,
      fc.file_path,
      fc.action,
      fc.timestamp || '',
    ]));
  }
  lines.push('');

  // Tasks section
  lines.push('Tasks');
  lines.push('Project,Subject,Status');
  for (const t of report.tasks) {
    const projectName = t.project_path?.split('/').pop() || t.project_path || '';
    lines.push(csvRow([
      projectName,
      t.subject,
      t.status,
    ]));
  }

  return lines.join('\n');
}

function escapeHTML(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function formatDateRange(from: string, to: string, period: string): string {
  const fromDate = new Date(from + 'T00:00:00');
  if (period === 'daily') {
    return fromDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  const toDate = new Date(to + 'T00:00:00');
  toDate.setDate(toDate.getDate() - 1);
  const fromStr = fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const toStr = toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fromStr} \u2013 ${toStr}`;
}

function buildReportHTML(report: ReportData): string {
  const dateRange = formatDateRange(report.from, report.to, report.period);
  const { sessionCount, messageCount, inputTokens, outputTokens, filesChanged, tasksCompleted } = report.summary;
  const projectCount = report.projects.length;

  const projectCards = report.projects.map(p => `
    <div class="project-card">
      <div class="project-name">${escapeHTML(p.shortName)}</div>
      ${p.bullets && p.bullets.length > 0
        ? `<ul>${p.bullets.map(b => `<li>${escapeHTML(b)}</li>`).join('')}</ul>`
        : '<div class="no-summary">No summary available</div>'
      }
      <div class="project-stats">
        ${p.sessionCount} sessions &middot; ${p.messageCount.toLocaleString()} messages &middot;
        ${formatTokens(p.inputTokens)} in / ${formatTokens(p.outputTokens)} out &middot;
        ${p.filesChanged} files changed
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 0; size: A4; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --primary: #4f46e5;
      --primary-dark: #4338ca;
      --primary-light: #818cf8;
      --primary-bg: #eef2ff;
      --text: #1e293b;
      --text-muted: #64748b;
      --text-light: #94a3b8;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --border: #e2e8f0;
      --gradient-start: #4f46e5;
      --gradient-end: #7c3aed;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      color: var(--text);
      line-height: 1.6;
      background: var(--bg);
      -webkit-font-smoothing: antialiased;
    }

    .header {
      background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
      padding: 48px 56px 40px;
      color: white;
    }
    .header h1 { font-size: 36px; font-weight: 700; letter-spacing: -0.5px; }
    .header .date { font-size: 18px; opacity: 0.85; margin-top: 4px; }
    .header .pills { display: flex; gap: 12px; margin-top: 20px; }
    .header .pill {
      background: rgba(255,255,255,0.15);
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
      backdrop-filter: blur(4px);
    }

    .content { padding: 40px 56px; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 40px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px 24px;
    }
    .stat-card .value {
      font-size: 28px;
      font-weight: 700;
      color: var(--primary);
    }
    .stat-card .label {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .section-title {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 20px;
      color: var(--text);
    }

    .project-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px 32px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .project-card .project-name {
      font-size: 18px;
      font-weight: 700;
      padding-left: 16px;
      border-left: 4px solid var(--primary);
      margin-bottom: 16px;
    }
    .project-card ul {
      list-style: none;
      padding: 0;
    }
    .project-card li {
      padding: 4px 0 4px 24px;
      position: relative;
      font-size: 14px;
      line-height: 1.6;
      color: var(--text);
    }
    .project-card li::before {
      content: '';
      position: absolute;
      left: 8px;
      top: 12px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--primary-light);
    }
    .project-card .project-stats {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-light);
    }
    .project-card .no-summary {
      color: var(--text-light);
      font-style: italic;
      font-size: 14px;
    }

    .footer {
      padding: 24px 56px;
      font-size: 11px;
      color: var(--text-light);
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Work Report</h1>
    <div class="date">${escapeHTML(dateRange)}</div>
    <div class="pills">
      <span class="pill">${projectCount} projects</span>
      <span class="pill">${sessionCount} sessions</span>
      <span class="pill">${filesChanged} files changed</span>
    </div>
  </div>

  <div class="content">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">${sessionCount}</div>
        <div class="label">Sessions</div>
      </div>
      <div class="stat-card">
        <div class="value">${messageCount.toLocaleString()}</div>
        <div class="label">Messages</div>
      </div>
      <div class="stat-card">
        <div class="value">${filesChanged}</div>
        <div class="label">Files Changed</div>
      </div>
      <div class="stat-card">
        <div class="value">${formatTokens(inputTokens)}</div>
        <div class="label">Input Tokens</div>
      </div>
      <div class="stat-card">
        <div class="value">${formatTokens(outputTokens)}</div>
        <div class="label">Output Tokens</div>
      </div>
      <div class="stat-card">
        <div class="value">${tasksCompleted}</div>
        <div class="label">Tasks Completed</div>
      </div>
    </div>

    <h2 class="section-title">Project Summaries</h2>

    ${projectCards}
  </div>

  <div class="footer">
    <span>Generated by Claude Daily Summary</span>
    <span>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
  </div>
</body>
</html>`;
}

export async function generatePDF(report: ReportData): Promise<Buffer> {
  const html = buildReportHTML(report);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await browser.close();
  return Buffer.from(pdfBuffer);
}

