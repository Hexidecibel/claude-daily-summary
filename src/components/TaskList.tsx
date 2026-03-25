import type { Task } from '../types';

interface TaskListProps {
  tasks: Task[];
}

function shortProject(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] || path;
}

function statusClass(status: string): string {
  switch (status) {
    case 'completed': return 'status-completed';
    case 'in_progress': return 'status-in-progress';
    default: return 'status-pending';
  }
}

export function TaskList({ tasks }: TaskListProps) {
  if (tasks.length === 0) return null;

  return (
    <div className="section">
      <h2>Tasks</h2>
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Status</th>
            <th>Project</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t, i) => (
            <tr key={`${t.subject}-${i}`}>
              <td>{t.subject}</td>
              <td><span className={`badge ${statusClass(t.status)}`}>{t.status}</span></td>
              <td className="mono">{shortProject(t.project_path)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
