import { useEffect, useState } from 'react';
import { useStore, type AppTab } from './store/store';
import { useRunning, useScanCount } from './store/hooks';
import { exportProjectFile, importProjectFile } from './store/persistence';
import { bridge } from './store/bridge';
import { demoProject } from './engine/factory';
import { useAuth } from './auth/store';
import { LoginScreen } from './auth/LoginScreen';
import { HomeView } from './ui/HomeView';
import { LadderEditor } from './ui/LadderEditor';
import { StEditor } from './ui/StEditor';
import { TagEditor } from './ui/TagEditor';
import { IoView } from './ui/IoView';
import { PlantView } from './ui/PlantView';
import { HmiView } from './ui/HmiView';
import { IiotView } from './ui/IiotView';
import { TrainingView } from './ui/TrainingView';
import { NewProjectDialog } from './ui/NewProjectDialog';
import { Explorer } from './ui/explorer/Explorer';
import { LadderToolbar } from './ui/LadderToolbar';
import { Icon, TabIcon } from './ui/icons';
import { GameBoard } from './game/GameBoard';
import { GameArena } from './game/GameArena';
import { useGame } from './game/store';
import { rankForXp } from './game/types';

interface NavGroup {
  label: string;
  items: { id: AppTab; label: string; hint: string }[];
}

const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { id: 'home', label: 'Home', hint: 'Getting started and how the simulator works' },
      { id: 'game', label: 'PLCommando', hint: 'The interactive PLC programming game' },
    ],
  },
  {
    label: 'Program',
    items: [
      { id: 'ladder', label: 'Ladder Logic', hint: 'Relay-style rungs with live power flow' },
      { id: 'st', label: 'Structured Text', hint: 'Text-based IEC / Logix programming' },
      { id: 'tags', label: 'Tag Database', hint: 'PLC memory: bits, numbers, timers, counters' },
    ],
  },
  {
    label: 'Hardware',
    items: [
      { id: 'io', label: 'I/O Configuration', hint: 'Chassis modules and simulated I/O' },
      { id: 'plant', label: 'Plant Simulation', hint: 'Motors, tanks and machines you wire up' },
    ],
  },
  {
    label: 'Visualize & Connect',
    items: [
      { id: 'hmi', label: 'HMI / SCADA', hint: 'Operator screen with gauges, buttons, trends' },
      { id: 'iiot', label: 'IIoT / MQTT', hint: 'Publish tags and map Modbus registers' },
    ],
  },
  {
    label: 'Learn',
    items: [{ id: 'training', label: 'Training', hint: 'Guided scenarios and the instruction reference' }],
  },
];

const TAB_LABEL: Record<AppTab, string> = Object.fromEntries(
  NAV.flatMap((g) => g.items.map((i) => [i.id, i.label])),
) as Record<AppTab, string>;

const TAB_HINT: Record<AppTab, string> = Object.fromEntries(
  NAV.flatMap((g) => g.items.map((i) => [i.id, i.hint])),
) as Record<AppTab, string>;

export function App() {
  const { project, ui, setUi, engine, loadProject, undo, redo, setMessage } = useStore();
  const running = useRunning();
  const scanCount = useScanCount();
  const [newOpen, setNewOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, ready, init, logout, accounts } = useAuth();
  const game = useGame();
  const gameRun = game.run;

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    engine.hooks.afterScan = () => {
      const e = useStore.getState().engine;
      if (e.project.iiot.mqttEnabled) {
        bridge.publishFromRules(e.project.iiot.mqttPublish, (tag) => e.db.readScalar(tag));
      }
    };
  }, [engine]);

  useEffect(() => {
    if (!ui.message) return;
    const t = setTimeout(() => setMessage(''), 4000);
    return () => clearTimeout(t);
  }, [ui.message, setMessage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (!typing) {
          e.preventDefault();
          undo();
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        if (!typing) {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  function go(tab: AppTab) {
    setUi({ activeTab: tab });
    setNavOpen(false);
  }

  const inArena = ui.activeTab === 'game' && !!gameRun;

  if (!ready) {
    return <div className="boot-screen">Loading PLC Trainer…</div>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div
      className={`app ${navOpen ? 'nav-open' : ''} ${explorerOpen ? 'explorer-open' : ''} ${
        inArena ? 'arena-mode' : ''
      }`}
    >
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo">PLC</span>
          <div>
            <div className="sidebar-title">PLC Trainer</div>
            <div className="sidebar-sub">Automation Simulator</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-item ${ui.activeTab === item.id ? 'active' : ''}`}
                  onClick={() => go(item.id)}
                  title={item.hint}
                >
                  <span className="nav-icon">
                    <TabIcon tab={item.id} />
                  </span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="game-mini">
            <span className="game-mini-rank">{rankForXp(game.progress.xp)}</span>
            <span className="game-mini-xp mono">{game.progress.xp} XP</span>
          </div>
          <div className={`run-status ${running ? 'running' : ''}`}>
            <span className={`dot ${running ? 'on' : ''}`} />
            <div>
              <div className="run-state">{running ? 'RUNNING' : 'PROGRAM'}</div>
              <div className="run-meta mono">Scan #{scanCount}</div>
            </div>
          </div>
        </div>
      </aside>

      {explorerOpen && !inArena && (
        <aside className="explorer-pane">
          <Explorer />
        </aside>
      )}

      <div className="main">
        {!inArena && (
          <header className="topbar">
          <button className="hamburger" onClick={() => setNavOpen((v) => !v)} title="Menu">
            <Icon name="chevron" />
          </button>
          <button
            className={`tree-toggle ${explorerOpen ? 'active' : ''}`}
            onClick={() => setExplorerOpen((v) => !v)}
            title="Toggle explorer"
          >
            <Icon name="ledger" />
          </button>
          <div className="topbar-title">
            <div className="crumb">
              <TabIcon tab={ui.activeTab} size={16} />
              <span>{TAB_LABEL[ui.activeTab]}</span>
            </div>
            <div className="page-hint muted">{TAB_HINT[ui.activeTab]}</div>
          </div>

          <div className="spacer" />

          <div className="topbar-project" title={project.description || project.name}>
            <Icon name="ledger" size={15} />
            <span className="mono">{project.name}</span>
          </div>

          <div className="topbar-actions">
            <button className="icon-btn" onClick={undo} title="Undo (Ctrl+Z)">
              <Icon name="undo" />
            </button>
            <button className="icon-btn" onClick={redo} title="Redo (Ctrl+Y)">
              <Icon name="redo" />
            </button>
            <span className="divider" />
            <button className="icon-btn" onClick={() => setNewOpen(true)} title="New project">
              <Icon name="plus" />
            </button>
            <button className="icon-btn" onClick={() => loadProject(demoProject())} title="Load demo">
              <Icon name="book" />
            </button>
            <button className="icon-btn" onClick={() => exportProjectFile(project)} title="Export JSON">
              <Icon name="download" />
            </button>
            <button
              className="icon-btn"
              title="Import JSON"
              onClick={async () => {
                const p = await importProjectFile();
                if (p) {
                  loadProject(p);
                  setUi({ activeTab: 'ladder', message: `Imported “${p.name}”` });
                }
              }}
            >
              <Icon name="upload" />
            </button>
          </div>

          <div className="run-control">
            <button
              className={`btn-run ${running ? 'stop' : ''}`}
              onClick={() => engine.toggle()}
              title={running ? 'Stop the PLC' : 'Run the PLC'}
            >
              <Icon name={running ? 'stop' : 'play'} size={15} />
              <span>{running ? 'Stop' : 'Run'}</span>
            </button>
            <button className="btn-reset" onClick={() => engine.reset()} title="Reset tags and timers">
              <Icon name="reset" size={15} />
              <span>Reset</span>
            </button>
            <label className="scan-field" title="Scan cycle time in milliseconds">
              <Icon name="gauge" size={14} />
              <input
                type="number"
                min={1}
                max={1000}
                value={engine.scanTimeMs}
                onChange={(e) => engine.setScanTime(Number(e.target.value))}
              />
              <span>ms</span>
            </label>
          </div>

          <div className="account">
            <button
              className="account-btn"
              onClick={() => setMenuOpen((v) => !v)}
              title={`Signed in as ${user.username}`}
            >
              <span className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
              <span className="account-name">{user.displayName}</span>
              <Icon name="arrowDown" size={13} />
            </button>
            {menuOpen && (
              <>
                <div className="menu-scrim" onClick={() => setMenuOpen(false)} />
                <div className="account-menu">
                  <div className="account-head">
                    <div className="account-head-name">{user.displayName}</div>
                    <div className="muted small mono">@{user.username}</div>
                    <span className="badge role">{user.role}</span>
                  </div>
                  <div className="account-meta muted small">
                    {accounts().length} account{accounts().length === 1 ? '' : 's'} on this computer
                  </div>
                  <button className="menu-item" onClick={() => { setMenuOpen(false); setUi({ activeTab: 'home' }); }}>
                    <Icon name="help" size={15} /> Getting started
                  </button>
                  <button className="menu-item danger" onClick={() => { setMenuOpen(false); logout(); }}>
                    <Icon name="close" size={15} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
          </header>
        )}

        {!inArena && ui.activeTab === 'ladder' && (
          <div className="context-bar">
            <LadderToolbar />
          </div>
        )}

        <main className={`content ${inArena ? 'content-arena' : ''}`}>
          {ui.activeTab === 'home' && <HomeView onNewProject={() => setNewOpen(true)} />}
          {ui.activeTab === 'game' && (gameRun ? <GameArena /> : <GameBoard />)}
          {ui.activeTab === 'ladder' && <LadderEditor />}
          {ui.activeTab === 'st' && <StEditor />}
          {ui.activeTab === 'tags' && <TagEditor />}
          {ui.activeTab === 'io' && <IoView />}
          {ui.activeTab === 'plant' && <PlantView />}
          {ui.activeTab === 'hmi' && <HmiView />}
          {ui.activeTab === 'iiot' && <IiotView />}
          {ui.activeTab === 'training' && <TrainingView />}
        </main>
      </div>

      {navOpen && <div className="nav-scrim" onClick={() => setNavOpen(false)} />}
      {explorerOpen && !inArena && (
        <div className="explorer-scrim" onClick={() => setExplorerOpen(false)} />
      )}

      {ui.message && <div className="toast">{ui.message}</div>}

      <div className="notifications">
        {game.notifications.map((n) => (
          <div
            key={n.id}
            className={`notification ${n.kind}`}
            onClick={() => game.dismissNotification(n.id)}
          >
            <div className="notification-title">{n.title}</div>
            <div className="notification-detail">{n.detail}</div>
          </div>
        ))}
      </div>

      <NewProjectDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

