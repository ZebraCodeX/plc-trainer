import { useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import { useEngine } from '../../store/hooks';
import { buildExplorerTree, collectFolderIds, type ExplorerNode } from './model';
import { Icon, TabIcon } from '../icons';

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
      <div className="explorer-head">
        <span className="explorer-title">Explorer</span>
        <span className="explorer-project mono" title={project.name}>
          {project.name}
        </span>
      </div>

      <div className="explorer-search">
        <Icon name="ledger" size={13} />
        <input
          placeholder="Filter files…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button
          className="icon-btn tiny"
          title="New ladder routine"
          onClick={() => {
            applyEdit((p) => {
              const program = p.programs[0];
              if (!program) return;
              const id = `rtn_${Date.now().toString(36)}`;
              program.routines.push({
                id,
                name: `Routine_${program.routines.length + 1}`,
                type: 'ladder',
                rungs: [],
                stSource: '',
              });
            }, 'content');
          }}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>

      <div className="explorer-tree">{renderNodes(tree, 0)}</div>
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
