# claude-daily-summary

Web app that parses Claude Code conversation logs and generates daily, weekly, and monthly work reports with LLM-powered summaries.

## Features

- **Daily/Weekly/Monthly reports** of work done via Claude Code
- **Project-grouped summaries** with AI-generated bullet points (via Claude Haiku)
- **SQLite cache** — indexes 5,000+ sessions in seconds, mtime-based invalidation
- **Filterable** by project and date range
- **CSV export** for raw data
- **PDF export** — premium Puppeteer-rendered reports with styled layout

## Prerequisites

- Node.js 18+
- An Anthropic API key (for AI-generated summaries)

## Setup

```bash
# Clone the repo
git clone <repo-url>
cd claude-daily-summary

# Build the bundled parser
cd packages/claude-conversation-parser
npm install
npm run build
cd ../..

# Install dependencies
npm install

# Create .env file with your API key
echo "ANTHROPIC_API_KEY=your-key-here" > .env

# Start the dev server
npm run dev
```

The app will be available at http://localhost:5173 (frontend) with the API on port 9498.

## How it works

1. **Indexer** scans `~/.claude/projects/` for JSONL conversation files
2. **Parser** extracts sessions, file changes, tasks, and token usage
3. **SQLite** caches parsed data — only re-parses changed files
4. **Haiku** generates concise bullet-point summaries per project per day
5. **React dashboard** displays reports with filters and export options

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | (required) | Your Anthropic API key for summary generation |
| `PORT` | `9498` | Express server port |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend in dev mode |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm test` | Run tests |
