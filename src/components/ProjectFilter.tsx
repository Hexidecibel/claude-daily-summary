import type { Project } from '../types';

interface ProjectFilterProps {
  projects: Project[];
  selected: string;
  onChange: (project: string) => void;
}

function shortName(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] || path;
}

export function ProjectFilter({ projects, selected, onChange }: ProjectFilterProps) {
  return (
    <div className="project-filter">
      <select value={selected} onChange={e => onChange(e.target.value)}>
        <option value="all">All Projects</option>
        {projects.map(p => (
          <option key={p.path} value={p.path}>
            {shortName(p.path)} ({p.sessionCount} sessions)
          </option>
        ))}
      </select>
    </div>
  );
}
