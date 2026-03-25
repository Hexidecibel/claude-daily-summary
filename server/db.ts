import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface SessionRow {
  id: string;
  project_dir: string;
  project_path: string;
  file_path: string;
  file_mtime: number;
  file_size: number;
  started_at: string | null;
  ended_at: string | null;
  message_count: number;
  summary: string | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  indexed_at: string;
}

export interface FileChangeRow {
  id: number;
  session_id: string;
  file_path: string;
  action: string;
  timestamp: string | null;
}

export interface HighlightRow {
  id: number;
  session_id: string;
  type: string;  // 'user' | 'assistant' | 'system'
  content: string;
  timestamp: string | null;
}

export interface TaskRow {
  id: number;
  session_id: string;
  task_id: string | null;
  subject: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface DailySummaryRow {
  id: number;
  project_path: string;
  date: string;
  bullets: string;
  generated_at: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'data', 'summary.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_dir TEXT NOT NULL,
      project_path TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_mtime REAL NOT NULL,
      file_size INTEGER NOT NULL,
      started_at TEXT,
      ended_at TEXT,
      message_count INTEGER DEFAULT 0,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      indexed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      action TEXT NOT NULL,
      timestamp TEXT,
      UNIQUE(session_id, file_path)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      task_id TEXT,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS session_highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path);
    CREATE INDEX IF NOT EXISTS idx_file_changes_session ON file_changes(session_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id);
    CREATE INDEX IF NOT EXISTS idx_highlights_session ON session_highlights(session_id);
  `);

  // Migrations for existing databases
  try {
    db.exec(`ALTER TABLE sessions ADD COLUMN summary TEXT`);
  } catch {
    // Column already exists
  }

  try {
    db.exec(`CREATE TABLE IF NOT EXISTS session_highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT
    )`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_highlights_session ON session_highlights(session_id)`);
  } catch {
    // Table already exists
  }

  return db;
}
