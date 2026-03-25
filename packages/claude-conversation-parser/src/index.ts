// Parser functions
export {
  parseConversationFile,
  parseConversationChain,
  extractHighlights,
  extractTasks,
  extractFileChanges,
  extractUsageFromFile,
  detectWaitingForInput,
  detectIdle,
  detectCurrentActivity,
  detectCurrentActivityFast,
  detectCompaction,
  getRecentActivity,
  getPendingApprovalTools,
  getSessionStatus,
  parsePermissionPrompt,
  mapPermissionLabel,
  setMessagesParsedCallback,
} from './parser';

// Types
export type {
  ConversationMessage,
  ConversationHighlight,
  ToolCall,
  SessionStatus,
  QuestionOption,
  Question,
  SessionUsage,
  CompactionEvent,
  TaskItem,
  FileChange,
  ActivityDetail,
} from './types';

// Tool config (useful for consumers)
export {
  APPROVAL_TOOLS,
  KNOWN_TOOL_NAMES,
  DEFAULT_TOOL_CONFIG,
  getToolDescription,
  isKnownTool,
} from './tool-config';

export type { ToolDefinition } from './tool-config';

// Utils
export { BoundedMap } from './utils';
