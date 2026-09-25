import { useState } from 'react';
import { useStore } from '../store/store';
import { blankProject, demoProject } from '../engine/factory';

export function NewProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { loadProject, setUi } = useStore();
  const [name, setName] = useState('My Project');
  const [template, setTemplate] = useState<'blank' | 'starter'>('blank');

  if (!open) return null;

  function create() {
    const finalName = name.trim() || 'Untitled Project';
    const project = template === 'starter' ? demoProject(finalName) : blankProject(finalName);
    loadProject(project);
    setUi({ activeTab: 'ladder', message: `Created project “${project.name}”` });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Project</h2>
        <label className="col" style={{ gap: 4, marginTop: 10 }}>
          <span className="muted small">Project name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="e.g. Line 1 Conveyor"
          />
        </label>

        <div className="muted small" style={{ marginTop: 12, marginBottom: 6 }}>
          Starting point
        </div>
        <label className={`choice ${template === 'blank' ? 'active' : ''}`}>
          <input
            type="radio"
            checked={template === 'blank'}
            onChange={() => setTemplate('blank')}
          />
          <span>
            <b>Blank</b>
            <div className="muted small">
              One program with an empty ladder routine — drag instructions in right away.
            </div>
          </span>
        </label>
        <label className={`choice ${template === 'starter' ? 'active' : ''}`}>
          <input
            type="radio"
            checked={template === 'starter'}
            onChange={() => setTemplate('starter')}
          />
          <span>
            <b>Starter example</b>
            <div className="muted small">
              The full demo: start/stop motor logic, I/O modules, plant motor and HMI screen.
            </div>
          </span>
        </label>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={create}>
            Create project
          </button>
        </div>
      </div>
    </div>
  );
}
