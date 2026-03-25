// Constants used by the parser
// Extracted from daemon constants — only includes values the parser needs

// Buffer Sizes
export const FILE_ACTIVITY_READ_BUFFER_SIZE = 32 * 1024;      // 32KB

// Display & Truncation
export const COMMAND_LOG_PREVIEW_LENGTH = 40;
export const SHORT_COMMAND_DISPLAY_LENGTH = 30;
export const QUESTION_PREVIEW_LENGTH = 50;
export const TOOL_DESCRIPTION_PREVIEW_LENGTH = 100;
export const TOOL_APPROVAL_PREVIEW_LENGTH = 50;
export const TOOL_INPUT_SUMMARY_LENGTH = 100;
export const MAX_TOOL_OUTPUT_SIZE = 2000;
export const MAX_SUMMARY_TEXT_LENGTH = 200;

// Parser
export const PARSER_WARNING_RATE_LIMIT_MS = 60000;
export const PARSER_DEDUP_KEY_PREVIEW_LENGTH = 100;
