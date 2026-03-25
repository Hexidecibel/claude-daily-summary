import { useState } from 'react';
import type { ProjectReport } from '../types';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function formatTime(iso: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

interface Props {
  projects: ProjectReport[];
}

function ProjectCard({ project }: { project: ProjectReport }) {
  const [showSessions, setShowSessions] = useState(false);

  return (
    <div className="project-card">
      <div className="project-header" title={project.path}>
        {project.shortName}
      </div>
      <div className="project-stats">
        {project.sessionCount} session{project.sessionCount !== 1 ? 's' : ''}
        {' \u00b7 '}
        {project.messageCount} message{project.messageCount !== 1 ? 's' : ''}
        {' \u00b7 '}
        {project.filesChanged} file{project.filesChanged !== 1 ? 's' : ''} changed
        {' \u00b7 '}
        {formatTokens(project.inputTokens)} in / {formatTokens(project.outputTokens)} out
      </div>
      {project.bullets && project.bullets.length > 0 && (
        <ul className="project-bullets">
          {project.bullets.map((bullet, i) => (
            <li key={i}>{bullet}</li>
          ))}
        </ul>
      )}
      <button
        className="sessions-toggle"
        onClick={() => setShowSessions(!showSessions)}
      >
        {showSessions ? 'Hide' : 'Show'} {project.sessions.length} session{project.sessions.length !== 1 ? 's' : ''}
      </button>
      {showSessions && (
        <div className="session-list-inner">
          {project.sessions.map((session) => (
            <div key={session.id} className="session-item">
              <span className="session-time">{formatTime(session.started_at)}</span>
              <span className={session.summary ? 'session-summary' : 'session-summary no-summary'}>
                {session.summary || 'No summary'}
              </span>
              <span className="session-meta">
                {session.message_count} msg{session.message_count !== 1 ? 's' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectSummary({ projects }: Props) {
  if (!projects || projects.length === 0) return null;

  return (
    <div className="section project-summary">
      <h2>Projects</h2>
      {projects.map((project) => (
        <ProjectCard key={project.path} project={project} />
      ))}
    </div>
  );
}
