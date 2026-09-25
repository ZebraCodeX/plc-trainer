import { useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import { useEngine } from '../../store/hooks';
import { buildExplorerTree, collectFolderIds, type ExplorerNode } from './model';
import { Icon, TabIcon } from '../icons';
import { makeRoutine } from '../../engine/factory';

interface ContextMenu {
  x: number;
  y: number;
  routineId: string;
  name: string;
  type: 'ladder' | 'st';
}

function FileIcon({ node }: { node: ExplorerNode }) {
  if (node.kind === 'folder') return null;
  if (node.type === 'ladder') return <TabIcon tab="ladder" size={15} />;
  if (node.type === 'st') return <TabIcon tab="st" size={15} />;
  if (node.type === 'tags') return <TabIcon tab="tags" size={15} />;
  if (node.type === 'io') return <TabIcon tab="io" size={15} />;
  if (node.type === 'plant') return <TabIcon tab="plant" size={15} />;
  if (node.type === 'hmi') return <TabIcon tab="hmi" size={15} />;
  if (node.type === 'iiot') return <TabIcon tab="iiot" size={15} />;
  return <Icon name="ledger" size={15} />;
}

export function Explorer() {
  const { project, ui, setUi, applyEdit } = useStore();
  const engine = useEngine();
  const [open, setOpen] = useState<Set<string>>(new Set(['folder-program']));
  const [filter, setFilter] = useState('');
  const [menu, setMenu] = useState<ContextMenu | null>(null);

  const stErrorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const program of project.programs) {
      for (const routine of program.routines) {
        if (routine.type === 'st') counts[routine.id] = engine.validateSt(routine.id, routine.stSource).length;
      }
    }
    return counts;
  }, [project, engine]);

  const tree = useMemo(() => buildExplorerTree(project, stErrorCounts), [project, stErrorCounts]);

  // open folders default
  useMemo(() => {
    setOpen((prev) => {
      const next = new Set(prev);
      for (const id of collectFolderIds(tree)) {
        const node = findNode(tree, id);
        if (node && node.kind === 'folder' && node.defaultOpen && !next.has(id) && prev.size <= 1) {
          next.add(id);
        }
      }
      return next;
    });
  }, [tree]);

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addRoutine(type: 'ladder' | 'st') {
    const routine = makeRoutine(
      type === 'st' ? `ST_${project.programs[0]?.routines.length ?? 1}` : `Routine_${project.programs[0]?.routines.length ?? 1}`,
      type,
    );
    if (type === 'st') {
      routine.stSource = `// Structured Text routine\n`;
    }
    applyEdit((p) => {
      if (!p.programs[0]) return;
      p.programs[0].routines.push(routine);
    }, 'content');
    setUi({ activeTab: type === 'st' ? 'st' : 'ladder', selectedRoutineId: routine.id });
    setOpen((prev) => new Set(prev).add('folder-program').add(`folder-program-${project.programs[0]?.id}`));
  }

  function renameRoutine(id: string, name: string) {
    applyEdit((p) => {
      for (const program of p.programs) {
        const r = program.routines.find((x) => x.id === id);
        if (r) r.name = name;
      }
    }, 'content');
  }

  function convertRoutine(id: string) {
    applyEdit((p) => {
      for (const program of p.programs) {
        const r = program.routines.find((x) => x.id === id);
        if (r && r.type === 'ladder') {
          r.type = 'st';
          if (!r.stSource) r.stSource = `// Converted from ladder. Rewrite the rungs in ST.\n`;
        }
      }
    }, 'content');
  }

  function deleteRoutine(id: string) {
    const program = project.programs[0];
    if (!program || program.routines.length <= 1) return;
    applyEdit((p) => {
      for (const prg of p.programs) {
        prg.routines = prg.routines.filter((x) => x.id !== id);
      }
    }, 'content');
    if (ui.selectedRoutineId === id) {
      setUi({ selectedRoutineId: program.routines.find((r) => r.id !== id)?.id ?? null });
    }
  }

  function openFile(node: ExplorerNode) {
    if (node.kind !== 'file') return;
    if (node.routineId) setUi({ activeTab: node.tab, selectedRoutineId: node.routineId });
    else setUi({ activeTab: node.tab });
  }

  function isActive(node: ExplorerNode): boolean {
    if (node.kind !== 'file') return false;
    if (node.tab !== ui.activeTab) return false;
    if (node.routineId) return node.routineId === ui.selectedRoutineId;
    return true;
  }

  function renderNodes(nodes: ExplorerNode[], depth: number): React.ReactNode {
    return nodes.map((node) => {
      const isFolder = node.kind === 'folder';
      const isOpen = isFolder && open.has(node.id);
      const query = filter.trim().toLowerCase();
      if (query) {
        const matches = nodeMatches(node, query);
        if (!matches) return null;
      }
      return (
        <div key={node.id}>
          <div
            className={`tree-row ${isFolder ? 'folder' : 'file'} ${isActive(node) ? 'active' : ''}`}
            style={{ paddingLeft: 6 + depth * 14 }}
            onClick={() => (isFolder ? toggle(node.id) : openFile(node))}
            onContextMenu={
              !isFolder && node.routineId
                ? (e) => {
                    e.preventDefault();
                    setMenu({
                      x: e.clientX,
                      y: e.clientY,
                      routineId: node.routineId!,
                      name: node.name,
                      type: node.type === 'st' ? 'st' : 'ladder',
                    });
                  }
                : undefined
            }
            title={node.name}
          >
            {isFolder ? (
              <span className={`tree-caret ${isOpen ? 'open' : ''}`}>
                <Icon name="chevron" size={12} />
              </span>
            ) : (
              <span className="tree-caret empty" />
            )}
            <span className={`tree-icon ${node.kind === 'folder' ? 'folder-icon' : ''}`} style={isFolder ? { color: node.accent } : undefined}>
              {isFolder ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
                </svg>
              ) : (
                <FileIcon node={node} />
              )}
            </span>
            <span className="tree-label">{node.name}</span>
            {!isFolder && node.badge && <span className="tree-badge">{node.badge}</span>}
            {!isFolder && node.status === 'error' && <span className="tree-status err">●</span>}
            {!isFolder && node.status === 'warn' && <span className="tree-status warn">●</span>}
          </div>
          {isFolder && isOpen && (
            <div className="tree-children">
              {renderNodes(node.children, depth + 1)}
              {node.children.length === 0 && (
                <div className="tree-empty muted small" style={{ paddingLeft: 6 + (depth + 1) * 14 }}>
                  empty
                </div>
              )}
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <div className="explorer">
      <div className="explorer-search">
        <Icon name="ledger" size={13} />
        <input
          placeholder="Filter files…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button className="icon-btn tiny" title="New ladder routine" onClick={() => addRoutine('ladder')}>
          <Icon name="plus" size={14} />
        </button>
        <button className="icon-btn tiny" title="New Structured Text routine" onClick={() => addRoutine('st')}>
          <span className="mono" style={{ fontSize: 11, fontWeight: 700 }}>
            ST
          </span>
        </button>
      </div>

      <div className="explorer-tree">{renderNodes(tree, 0)}</div>

      <div className="explorer-hint muted small">
        Right-click a routine to rename, convert or delete it.
      </div>

      {menu && (
        <>
          <div
            className="menu-scrim"
            onClick={() => setMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenu(null);
            }}
          />
          <div className="context-menu" style={{ top: menu.y, left: menu.x }}>
            <div className="context-head mono">{menu.name}</div>
            <button
              className="menu-item"
              onClick={() => {
                const name = prompt('Rename routine', menu.name);
                if (name && name.trim()) renameRoutine(menu.routineId, name.trim());
                setMenu(null);
              }}
            >
              <Icon name="book" size={15} /> Rename
            </button>
            {menu.type === 'ladder' && (
              <button
                className="menu-item"
                onClick={() => {
                  convertRoutine(menu.routineId);
                  setUi({ activeTab: 'st', selectedRoutineId: menu.routineId });
                  setMenu(null);
                }}
              >
                <Icon name="reset" size={15} /> Convert to Structured Text
              </button>
            )}
            <button
              className="menu-item danger"
              disabled={project.programs[0]?.routines.length <= 1}
              onClick={() => {
                deleteRoutine(menu.routineId);
                setMenu(null);
              }}
            >
              <Icon name="trash" size={15} /> Delete routine
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function findNode(nodes: ExplorerNode[], id: string): ExplorerNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.kind === 'folder') {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

function nodeMatches(node: ExplorerNode, query: string): boolean {
  if (node.name.toLowerCase().includes(query)) return true;
  if (node.kind === 'folder') return node.children.some((c) => nodeMatches(c, query));
  return false;
}
