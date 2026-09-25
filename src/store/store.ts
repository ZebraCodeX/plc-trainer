import { create } from 'zustand';
import { produce } from 'immer';
import { PlcEngine } from '../engine/engine';
import { demoProject } from '../engine/factory';
import type { Project } from '../engine/model';
import { loadProject, saveProject } from './persistence';

export type AppTab =
  | 'home'
  | 'ladder'
  | 'st'
  | 'tags'
  | 'io'
  | 'plant'
  | 'hmi'
  | 'iiot'
  | 'training';

export interface UiState {
  activeTab: AppTab;
  selectedRungId: string | null;
  selectedRoutineId: string | null;
  monitor: boolean;
  message: string;
}

export type EditKind = 'content' | 'structure';

interface State {
  project: Project;
  engine: PlcEngine;
  past: Project[];
  future: Project[];
  ui: UiState;
  applyEdit: (mutator: (draft: Project) => void, kind?: EditKind) => void;
  loadProject: (project: Project) => void;
  undo: () => void;
  redo: () => void;
  setUi: (patch: Partial<UiState>) => void;
  setMessage: (message: string) => void;
}

const initialProject = loadProject() ?? demoProject();
const engine = new PlcEngine(initialProject);

export const useStore = create<State>((set, get) => ({
  project: initialProject,
  engine,
  past: [],
  future: [],
  ui: {
    activeTab: 'home',
    selectedRungId: null,
    selectedRoutineId: initialProject.programs[0]?.mainRoutineId ?? null,
    monitor: true,
    message: '',
  },

  applyEdit: (mutator, kind = 'content') => {
    set((state) => ({
      project: produce(state.project, mutator),
      past: [...state.past, state.project].slice(-60),
      future: [],
    }));
    const { project } = get();
    if (kind === 'structure') engine.setProject(project);
    else {
      engine.project = project;
      engine.invalidatePrograms();
    }
    saveProject(project);
  },

  loadProject: (project) => {
    engine.setProject(project);
    set({
      project,
      past: [],
      future: [],
      ui: {
        ...get().ui,
        selectedRoutineId: project.programs[0]?.mainRoutineId ?? null,
        selectedRungId: null,
      },
    });
    saveProject(project);
  },

  undo: () => {
    const { past, future, project } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    engine.setProject(previous);
    set({ project: previous, past: past.slice(0, -1), future: [project, ...future].slice(0, 60) });
    saveProject(previous);
  },

  redo: () => {
    const { past, future, project } = get();
    if (future.length === 0) return;
    const next = future[0];
    engine.setProject(next);
    set({ project: next, past: [...past, project].slice(-60), future: future.slice(1) });
    saveProject(next);
  },

  setUi: (patch) => set((state) => ({ ui: { ...state.ui, ...patch } })),
  setMessage: (message) => set((state) => ({ ui: { ...state.ui, message } })),
}));
