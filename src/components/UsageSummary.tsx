import type { ReportSummary } from '../types';

interface UsageSummaryProps {
  summary: ReportSummary;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export function UsageSummary({ summary }: UsageSummaryProps) {
  const cards = [
    { label: 'Sessions', value: summary.sessionCount.toString() },
    { label: 'Messages', value: summary.messageCount.toString() },
    { label: 'Input Tokens', value: formatTokens(summary.inputTokens) },
    { label: 'Output Tokens', value: formatTokens(summary.outputTokens) },
    { label: 'Files Changed', value: summary.filesChanged.toString() },
    { label: 'Tasks Completed', value: summary.tasksCompleted.toString() },
  ];

  return (
    <div className="usage-summary">
      {cards.map(card => (
        <div key={card.label} className="stat-card">
          <div className="stat-value">{card.value}</div>
          <div className="stat-label">{card.label}</div>
        </div>
      ))}
    </div>
  );
}
