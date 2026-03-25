import { useState } from 'react';
import type { Period, SyncResult } from '../types';
import { useReport } from '../hooks/useReport';
import { useProjects } from '../hooks/useProjects';
import { DateNav } from './DateNav';
import { ProjectFilter } from './ProjectFilter';
import { UsageSummary } from './UsageSummary';
import { ProjectSummary } from './ProjectSummary';
import { SessionList } from './SessionList';
import { FileChangeList } from './FileChangeList';
import { TaskList } from './TaskList';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Dashboard() {
  const [period, setPeriod] = useState<Period>('daily');
  const [date, setDate] = useState(today);
  const [project, setProject] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const projects = useProjects();
  const { report, loading, error } = useReport(period, date, project, refreshKey);

  const downloadExport = (format: 'csv' | 'pdf') => {
    const url = `/api/export/${format}?period=${period}&date=${date}&project=${encodeURIComponent(project)}`;
    if (format === 'pdf') {
      // Open inline in browser's PDF viewer
      window.open(url, '_blank');
    } else {
      // CSV as direct download
      const a = document.createElement('a');
      a.href = url;
      a.download = `claude-report-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      const data = await res.json();
      setSyncResult(data.result);
      setRefreshKey(k => k + 1);
      setTimeout(() => setSyncResult(null), 5000);
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="dashboard">
      <header className="header">
        <h1>Claude Daily Summary</h1>
        <div className="header-actions">
          {syncResult && (
            <span className="sync-result">
              Synced {syncResult.indexed} sessions in {(syncResult.duration / 1000).toFixed(1)}s
            </span>
          )}
          <button className="export-btn" onClick={() => downloadExport('csv')}>
            Export CSV
          </button>
          <button className="export-btn" onClick={() => downloadExport('pdf')}>
            Export PDF
          </button>
          <button className="sync-btn" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>
      </header>

      <DateNav period={period} date={date} onPeriodChange={setPeriod} onDateChange={setDate} />
      <ProjectFilter projects={projects} selected={project} onChange={setProject} />

      {loading && <div className="loading">Loading...</div>}
      {error && <div className="error">Error: {error}</div>}
      {!loading && !error && report && (
        <>
          <UsageSummary summary={report.summary} />
          <ProjectSummary projects={report.projects} />
          <SessionList sessions={report.sessions} />
          <FileChangeList fileChanges={report.fileChanges} />
          <TaskList tasks={report.tasks} />
        </>
      )}
    </div>
  );
}
