import { useState, useEffect } from 'react';
import type { Report, Period } from '../types';

export function useReport(period: Period, date: string, project: string, refreshKey = 0) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/report?period=${period}&date=${date}&project=${encodeURIComponent(project)}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => setReport(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [period, date, project, refreshKey]);

  return { report, loading, error };
}
