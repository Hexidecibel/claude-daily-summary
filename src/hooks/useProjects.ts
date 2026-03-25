import { useState, useEffect } from 'react';
import type { Project } from '../types';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch('/api/projects')
      .then(res => res.json())
      .then(data => setProjects(data.projects))
      .catch(console.error);
  }, []);

  return projects;
}
