import type { Project } from '../engine/model';

const KEY = 'plc-trainer.project.v1';

export function saveProject(project: Project): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(project));
  } catch {
    /* storage full or unavailable */
  }
}

export function loadProject(): Project | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Project;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tags)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearProject(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
}

export function exportProjectFile(project: Project): void {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/\s+/g, '_') || 'project'}.plc.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importProjectFile(): Promise<Project | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.plc.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result)) as Project;
          resolve(Array.isArray(parsed.tags) ? parsed : null);
        } catch {
          resolve(null);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}
