import type { Session } from '../types';

interface SessionListProps {
  sessions: Session[];
}

function shortProject(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] || path;
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start || !end) return '-';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return '-';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatTime(ts: string | null): string {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export function SessionList({ sessions }: SessionListProps) {
  if (sessions.length === 0) return null;

  const sorted = [...sessions].sort((a, b) => {
    if (!a.started_at) return 1;
    if (!b.started_at) return -1;
    return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
  });

  return (
    <div className="section">
      <h2>Sessions</h2>
      <table>
        <thead>
          <tr>
            <th>Project</th>
            <th>Start</th>
            <th>Duration</th>
            <th>Messages</th>
            <th>Tokens</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(s => (
            <tr key={s.id}>
              <td className="mono">{shortProject(s.project_path)}</td>
              <td>{formatTime(s.started_at)}</td>
              <td>{formatDuration(s.started_at, s.ended_at)}</td>
              <td>{s.message_count}</td>
              <td>{formatTokens(s.input_tokens + s.output_tokens)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
