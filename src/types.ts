export interface Project {
  path: string;
  sessionCount: number;
  lastActivity: string | null;
}

export type Period = 'daily' | 'weekly' | 'monthly';

export interface ReportSummary {
  sessionCount: number;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  filesChanged: number;
  tasksCompleted: number;
}

export interface Session {
  id: string;
  project_path: string;
  started_at: string | null;
  ended_at: string | null;
  message_count: number;
  input_tokens: number;
  output_tokens: number;
}

export interface FileChange {
  file_path: string;
  action: string;
  timestamp: string | null;
  project_path: string;
}

export interface Task {
  subject: string;
  status: string;
  created_at: string | null;
  project_path: string;
}

export interface ProjectSession {
  id: string;
  summary: string | null;
  started_at: string | null;
  ended_at: string | null;
  message_count: number;
}

export interface ProjectReport {
  path: string;
  shortName: string;
  sessionCount: number;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  filesChanged: number;
  tasksCompleted: number;
  sessions: ProjectSession[];
  bullets: string[];
}

export interface Report {
  period: Period;
  from: string;
  to: string;
  summary: ReportSummary;
  sessions: Session[];
  fileChanges: FileChange[];
  tasks: Task[];
  projects: ProjectReport[];
}

export interface SyncResult {
  total: number;
  indexed: number;
  skipped: number;
  errors: number;
  duration: number;
}
