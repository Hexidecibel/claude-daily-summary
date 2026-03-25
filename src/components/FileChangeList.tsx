import type { FileChange } from '../types';

interface FileChangeListProps {
  fileChanges: FileChange[];
}

function shortProject(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] || path;
}

function shortenPath(filePath: string, projectPath: string): string {
  if (filePath.startsWith(projectPath)) {
    return filePath.slice(projectPath.length).replace(/^\//, '');
  }
  return filePath;
}

function formatTime(ts: string | null): string {
  if (!ts) return '-';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function FileChangeList({ fileChanges }: FileChangeListProps) {
  if (fileChanges.length === 0) return null;

  const projects = [...new Set(fileChanges.map(f => f.project_path))];
  const multiProject = projects.length > 1;

  return (
    <div className="section">
      <h2>File Changes</h2>
      <table>
        <thead>
          <tr>
            {multiProject && <th>Project</th>}
            <th>File</th>
            <th>Action</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {fileChanges.map((f, i) => (
            <tr key={`${f.file_path}-${i}`}>
              {multiProject && <td className="mono">{shortProject(f.project_path)}</td>}
              <td className="mono">{shortenPath(f.file_path, f.project_path)}</td>
              <td><span className={`badge badge-${f.action}`}>{f.action}</span></td>
              <td>{formatTime(f.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
