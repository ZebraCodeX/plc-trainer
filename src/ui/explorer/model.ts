import type { AppTab } from '../../store/store';
import type { Project } from '../../engine/model';

export type ExplorerKind = 'folder' | 'ladder' | 'st' | 'tags' | 'io' | 'plant' | 'hmi' | 'iiot';

export interface ExplorerFile {
  id: string;
  name: string;
  kind: 'file';
  type: ExplorerKind;
  tab: AppTab;
  routineId?: string;
  badge?: string;
  status?: 'ok' | 'warn' | 'error';
}

export interface ExplorerFolder {
  id: string;
  name: string;
  kind: 'folder';
  children: ExplorerNode[];
  defaultOpen?: boolean;
  accent?: string;
}

export type ExplorerNode = ExplorerFile | ExplorerFolder;

function ladderFile(id: string, name: string, routineId: string): ExplorerFile {
  return { id, name, kind: 'file', type: 'ladder', tab: 'ladder', routineId, badge: 'LAD' };
}

function stFile(id: string, name: string, routineId: string): ExplorerFile {
  return { id, name, kind: 'file', type: 'st', tab: 'st', routineId, badge: 'ST' };
}

/** Derive a VS Code style tree from the current project. */
export function buildExplorerTree(project: Project, stErrorCounts: Record<string, number>): ExplorerNode[] {
  const programFolder: ExplorerFolder = {
    id: 'folder-program',
    name: 'Programs',
    kind: 'folder',
    defaultOpen: true,
    accent: '#4aa3ff',
    children: project.programs.map((program) => ({
      id: `folder-program-${program.id}`,
      name: program.name,
      kind: 'folder' as const,
      defaultOpen: true,
      accent: '#4aa3ff',
      children: program.routines.map((routine) => {
        const errors = stErrorCounts[routine.id] ?? 0;
        const node =
          routine.type === 'st'
            ? stFile(`routine-${routine.id}`, routine.name, routine.id)
            : ladderFile(`routine-${routine.id}`, routine.name, routine.id);
        node.status = errors > 0 ? 'error' : 'ok';
        return node;
      }),
    })),
  };

  const tagCount = project.tags.length;

  const hardwareFolder: ExplorerFolder = {
    id: 'folder-hardware',
    name: 'Hardware',
    kind: 'folder',
    defaultOpen: true,
    accent: '#22c2b8',
    children: [
      {
        id: 'io-config',
        name: project.io.chassisName || 'Chassis',
        kind: 'file',
        type: 'io',
        tab: 'io',
        badge: `${project.io.modules.length} mod`,
      },
      {
        id: 'plant',
        name: 'Plant',
        kind: 'file',
        type: 'plant',
        tab: 'plant',
        badge: `${project.process.length}`,
      },
    ],
  };

  const dataFolder: ExplorerFolder = {
    id: 'folder-data',
    name: 'Data',
    kind: 'folder',
    defaultOpen: false,
    accent: '#ffb020',
    children: [
      { id: 'tags', name: 'Tag Database', kind: 'file', type: 'tags', tab: 'tags', badge: `${tagCount}` },
    ],
  };

  const visualizeFolder: ExplorerFolder = {
    id: 'folder-visualize',
    name: 'Visualize & Connect',
    kind: 'folder',
    defaultOpen: false,
    accent: '#b07cff',
    children: [
      { id: 'hmi', name: 'HMI Screens', kind: 'file', type: 'hmi', tab: 'hmi', badge: `${project.hmi.length}` },
      {
        id: 'iiot',
        name: 'IIoT Gateway',
        kind: 'file',
        type: 'iiot',
        tab: 'iiot',
        badge: `${project.iiot.mqttPublish.length}`,
        status: project.iiot.mqttEnabled ? 'ok' : 'warn',
      },
    ],
  };

  const docsFolder: ExplorerFolder = {
    id: 'folder-docs',
    name: 'Docs',
    kind: 'folder',
    defaultOpen: false,
    accent: '#8b9db3',
    children: [{ id: 'training', name: 'Training & Reference', kind: 'file', type: 'st', tab: 'training', badge: 'DOC' }],
  };

  return [programFolder, hardwareFolder, dataFolder, visualizeFolder, docsFolder];
}

export function collectFolderIds(nodes: ExplorerNode[], acc: string[] = []): string[] {
  for (const node of nodes) {
    if (node.kind === 'folder') {
      acc.push(node.id);
      collectFolderIds(node.children, acc);
    }
  }
  return acc;
}
