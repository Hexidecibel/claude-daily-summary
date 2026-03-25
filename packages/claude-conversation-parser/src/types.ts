export interface QuestionOption {
  label: string;
  description: string;
}

export interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

export interface ConversationMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  options?: QuestionOption[];
  questions?: Question[];
  isWaitingForChoice?: boolean;
  multiSelect?: boolean;
  isCompaction?: boolean;
  skillName?: string; // User message is an expanded skill invocation (e.g., "todo", "apk")
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startedAt?: number;
  completedAt?: number;
}

export interface ConversationHighlight {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  options?: QuestionOption[];
  questions?: Question[];
  isWaitingForChoice?: boolean;
  multiSelect?: boolean;
  toolCalls?: ToolCall[];
  isCompaction?: boolean;
  skillName?: string;
}

export interface ActivityDetail {
  summary: string;
  toolName?: string;
  input?: string;
  output?: string;
  timestamp: number;
}

export interface SessionStatus {
  isRunning: boolean;
  isWaitingForInput: boolean;
  lastActivity: number;
  conversationId?: string;
  projectPath?: string;
  currentActivity?: string;
  recentActivity?: ActivityDetail[];
}

export interface SessionUsage {
  sessionId: string;
  sessionName: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheCreationTokens: number;
  totalCacheReadTokens: number;
  messageCount: number;
  // Current context window size (from most recent message)
  currentContextTokens: number;
}

export interface CompactionEvent {
  sessionId: string;
  sessionName: string;
  projectPath: string;
  summary: string;
  timestamp: number;
}

// Task tracking types (from TaskCreate/TaskUpdate tools)
export interface TaskItem {
  id: string;
  subject: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
  owner?: string;
  blockedBy?: string[];
  blocks?: string[];
  createdAt: number;
  updatedAt: number;
}

// Code review types (file changes extracted from session)
export interface FileChange {
  path: string;
  action: 'write' | 'edit';
  timestamp: number;
}
