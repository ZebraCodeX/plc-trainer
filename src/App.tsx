import { useEffect, useState } from 'react';
import { useStore, type AppTab } from './store/store';
import { useRunning, useScanCount } from './store/hooks';
import { exportProjectFile, importProjectFile } from './store/persistence';
import { bridge } from './store/bridge';
import { demoProject } from './engine/factory';
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

const TABS: { id: AppTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'ladder', label: 'Ladder Logic' },
  { id: 'st', label: 'Structured Text' },
  { id: 'tags', label: 'Tag Database' },
  { id: 'io', label: 'I/O Configuration' },
  { id: 'plant', label: 'Plant Simulation' },
  { id: 'hmi', label: 'HMI / SCADA' },
  { id: 'iiot', label: 'IIoT / MQTT' },
  { id: 'training', label: 'Training' },
];

export function App() {
  const { project, ui, setUi, engine, loadProject, undo, redo, setMessage } = useStore();
  const running = useRunning();
  const scanCount = useScanCount();
  const [newOpen, setNewOpen] = useState(false);

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

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          PLC Trainer{' '}
          <small title={project.description || project.name}>{project.name}</small>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <button className={running ? 'danger' : 'primary'} onClick={() => engine.toggle()}>
            {running ? '■ Stop' : '▶ Run'}
          </button>
          <button onClick={() => engine.reset()}>Reset</button>
          <span className="pill">
            <span className={`dot ${running ? 'on' : ''}`} />
            {running ? 'RUN' : 'PROG'}
          </span>
          <span className="pill mono">Scan #{scanCount}</span>
          <label className="pill">
            Scan
            <input
              type="number"
              min={1}
              max={1000}
              value={engine.scanTimeMs}
              style={{ width: 60, padding: '1px 4px' }}
              onChange={(e) => engine.setScanTime(Number(e.target.value))}
            />{' '}
            ms
          </label>
        </div>
        <div className="spacer" />
        <div className="row" style={{ gap: 6 }}>
          <button onClick={undo}>Undo</button>
          <button onClick={redo}>Redo</button>
          <button className="primary" onClick={() => setNewOpen(true)}>
            + New
          </button>
          <button onClick={() => loadProject(demoProject())}>Demo</button>
          <button onClick={() => exportProjectFile(project)}>Export</button>
          <button
            onClick={async () => {
              const p = await importProjectFile();
              if (p) {
                loadProject(p);
                setUi({ activeTab: 'ladder', message: `Imported “${p.name}”` });
              }
            }}
          >
            Import
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${ui.activeTab === t.id ? 'active' : ''}`}
            onClick={() => setUi({ activeTab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {ui.activeTab === 'home' && <HomeView onNewProject={() => setNewOpen(true)} />}
        {ui.activeTab === 'ladder' && <LadderEditor />}
        {ui.activeTab === 'st' && <StEditor />}
        {ui.activeTab === 'tags' && <TagEditor />}
        {ui.activeTab === 'io' && <IoView />}
        {ui.activeTab === 'plant' && <PlantView />}
        {ui.activeTab === 'hmi' && <HmiView />}
        {ui.activeTab === 'iiot' && <IiotView />}
        {ui.activeTab === 'training' && <TrainingView />}
      </main>

      {ui.message && <div className="toast">{ui.message}</div>}

      <NewProjectDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}
