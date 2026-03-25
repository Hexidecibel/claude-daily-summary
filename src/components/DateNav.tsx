import type { Period } from '../types';

interface DateNavProps {
  period: Period;
  date: string;
  onPeriodChange: (period: Period) => void;
  onDateChange: (date: string) => void;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getMonday(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

function formatDateRange(period: Period, dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthsShort = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  if (period === 'daily') {
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  if (period === 'weekly') {
    const monday = getMonday(dateStr);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const mStr = `${monthsShort[monday.getMonth()]} ${monday.getDate()}`;
    const sStr = `${monthsShort[sunday.getMonth()]} ${sunday.getDate()}, ${sunday.getFullYear()}`;
    return `${mStr} - ${sStr}`;
  }

  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function navigate(period: Period, dateStr: string, direction: number): string {
  if (period === 'daily') {
    return addDays(dateStr, direction);
  }
  if (period === 'weekly') {
    return addDays(dateStr, direction * 7);
  }
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + direction);
  return d.toISOString().slice(0, 10);
}

const periods: Period[] = ['daily', 'weekly', 'monthly'];

export function DateNav({ period, date, onPeriodChange, onDateChange }: DateNavProps) {
  return (
    <div className="date-nav">
      <div className="period-toggle">
        {periods.map(p => (
          <button
            key={p}
            className={`period-btn ${p === period ? 'active' : ''}`}
            onClick={() => onPeriodChange(p)}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <div className="date-controls">
        <button className="nav-btn" onClick={() => onDateChange(navigate(period, date, -1))}>
          &larr;
        </button>
        <span className="date-display">{formatDateRange(period, date)}</span>
        <button className="nav-btn" onClick={() => onDateChange(navigate(period, date, 1))}>
          &rarr;
        </button>
      </div>
    </div>
  );
}
