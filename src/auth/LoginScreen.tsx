import { useEffect, useState } from 'react';
import { useAuth } from './store';

export function LoginScreen() {
  const { login, register, error, busy, accounts } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const users = accounts();

  useEffect(() => {
    if (mode === 'login' && users.length > 0 && !username) {
      setUsername(users[0].username);
    }
  }, [mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'login') await login(username, password);
    else await register(username, password, displayName);
  }

  return (
    <div className="login-screen">
      <div className="login-visual">
        <div className="login-brand">
          <span className="logo big">PLC</span>
          <h1>PLC Trainer</h1>
          <p>
            A hands-on simulator for <b>ladder logic</b>, <b>structured text</b>,{' '}
            <b>industrial I/O</b> and <b>IIoT</b>. Sign in to keep your projects and progress on
            this machine.
          </p>
          <ul className="login-features">
            <li>Program in Ladder and Structured Text</li>
            <li>Simulate I/O, motors, tanks and HMI screens</li>
            <li>Practice IIoT with MQTT and Modbus</li>
            <li>Guided training scenarios with auto-checks</li>
          </ul>
        </div>
      </div>

      <div className="login-panel">
        <form className="login-card" onSubmit={submit} data-testid="login-form">
          <div className="login-tabs">
            <button
              type="button"
              className={`login-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => setMode('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`login-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => setMode('register')}
            >
              Create account
            </button>
          </div>

          <label className="col" style={{ gap: 4 }}>
            <span className="muted small">Username</span>
            <input
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. instructor"
              autoComplete="username"
            />
          </label>

          {mode === 'register' && (
            <label className="col" style={{ gap: 4 }}>
              <span className="muted small">Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Alex Rivera"
              />
            </label>
          )}

          <label className="col" style={{ gap: 4 }}>
            <span className="muted small">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="primary login-submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>

          {mode === 'login' && users.length > 0 && (
            <div className="login-hint muted small">
              Accounts on this computer: {users.map((u) => u.username).join(', ')}
            </div>
          )}
          {mode === 'login' && users.length === 1 && users[0].username === 'instructor' && (
            <div className="login-hint muted small">
              First run — sign in with <b className="mono">instructor</b> /{' '}
              <b className="mono">plc123</b>, then create your own account.
            </div>
          )}
        </form>
        <div className="login-foot muted small">
          Accounts and passwords are stored only in this browser. Nothing is uploaded.
        </div>
      </div>
    </div>
  );
}
