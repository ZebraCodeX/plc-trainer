/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { App } from './App';
import { login, registerUser, logout, currentUser } from './auth/auth';
import { useAuth } from './auth/store';

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>();
    const ls: Storage = {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (k) => (store.has(k) ? store.get(k)! : null),
      key: (i) => [...store.keys()][i] ?? null,
      removeItem: (k) => void store.delete(k),
      setItem: (k, v) => void store.set(k, String(v)),
    };
    Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true });
  }
});

beforeEach(() => {
  cleanup();
  localStorage.clear();
  useAuth.setState({ user: null, ready: false, error: '', busy: false });
});

async function signInThroughUi(username: string, password: string) {
  render(<App />);
  await waitFor(() => expect(document.querySelector('form.login-card')).toBeTruthy(), {
    timeout: 5000,
  });
  const form = document.querySelector('form.login-card') as HTMLFormElement;
  const inputs = form.querySelectorAll('input');
  const usernameInput = inputs[0] as HTMLInputElement;
  const passwordInput = inputs[inputs.length - 1] as HTMLInputElement;
  fireEvent.change(usernameInput, { target: { value: username } });
  await waitFor(() => expect(usernameInput.value).toBe(username));
  fireEvent.change(passwordInput, { target: { value: password } });
  await waitFor(() => expect(passwordInput.value).toBe(password));
  fireEvent.submit(form);
  await waitFor(() => expect(document.querySelector('.content')).toBeTruthy(), { timeout: 15000 });
}

describe('auth', () => {
  it('registers, logs in and logs out', async () => {
    const u = await registerUser('alice', 'secret', 'Alice');
    expect(currentUser()).toBeNull();
    const logged = await login('alice', 'secret');
    expect(logged.username).toBe('alice');
    expect(currentUser()?.username).toBe('alice');
    logout();
    expect(currentUser()).toBeNull();
    void u;
  });

  it('rejects duplicate usernames and wrong passwords', async () => {
    await registerUser('bob', 'pw12', 'Bob');
    await expect(registerUser('Bob', 'pw34', 'Bobby')).rejects.toThrow();
    await expect(login('bob', 'nope')).rejects.toThrow();
  });
});

describe('App shell', () => {
  it('shows the login screen before signing in', async () => {
    render(<App />);
    await waitFor(() => expect(document.querySelector('form.login-card')).toBeTruthy(), {
      timeout: 5000,
    });
    expect(screen.getByText(/Accounts and passwords are stored only/)).toBeTruthy();
  });

  it('signs in through the form and shows the home screen', async () => {
    await registerUser('smoke', 'pw12', 'Smoke');
    await signInThroughUi('smoke', 'pw12');
    expect(screen.getByText(/Getting started in 5 minutes/)).toBeTruthy();
  });

  it('switches tabs after signing in', async () => {
    await registerUser('nav', 'pw12', 'Nav');
    await signInThroughUi('nav', 'pw12');

    fireEvent.click(screen.getByRole('button', { name: 'Tag Database' }));
    expect(screen.getByRole('button', { name: '+ Add Tag' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'I/O Configuration' }));
    expect(screen.getByText('Chassis I/O Configuration')).toBeTruthy();
  });

  it('opens ladder logic and shows instruction symbols', async () => {
    await registerUser('ladder', 'pw12', 'Ladder');
    await signInThroughUi('ladder', 'pw12');

    fireEvent.click(screen.getByRole('button', { name: 'Ladder Logic' }));
    expect(screen.getAllByText('XIC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('OTE').length).toBeGreaterThan(0);
  });

  it('shows the explorer tree merged into the sidebar', async () => {
    await registerUser('tree', 'pw12', 'Tree');
    await signInThroughUi('tree', 'pw12');
    // Explorer tree and navigation live in the same sidebar.
    expect(screen.getByText('Programs')).toBeTruthy();
    expect(screen.getByText('MainRoutine')).toBeTruthy();
    expect(document.querySelector('.sidebar .explorer-tree')).toBeTruthy();
    expect(document.querySelector('.sidebar .sidebar-nav')).toBeTruthy();
  });

  it('opens the PLCommando game board', async () => {
    await registerUser('gamer', 'pw12', 'Gamer');
    await signInThroughUi('gamer', 'pw12');
    fireEvent.click(screen.getByRole('button', { name: 'PLCommando' }));
    expect(screen.getAllByText('PLCommando').length).toBeGreaterThan(0);
    expect(screen.getByText('The Runaway Motor')).toBeTruthy();
  });

  it('opens the ladder palette dropdowns', async () => {
    await registerUser('pal', 'pw12', 'Pal');
    await signInThroughUi('pal', 'pw12');
    fireEvent.click(screen.getByRole('button', { name: 'Ladder Logic' }));

    fireEvent.click(screen.getByRole('button', { name: /Conditions/ }));
    expect(screen.getByText('Bit & Contacts')).toBeTruthy();
    expect(screen.getByText('Compare')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Outputs/ }));
    expect(screen.getByText('Timers')).toBeTruthy();
    expect(screen.getByText('Move')).toBeTruthy();
  });

  it('adds a rung from the integrated topbar toolbar', async () => {
    await registerUser('rung', 'pw12', 'Rung');
    await signInThroughUi('rung', 'pw12');
    fireEvent.click(screen.getByRole('button', { name: 'Ladder Logic' }));

    const before = document.querySelectorAll('.rung').length;
    fireEvent.click(screen.getByTitle('Add a new rung'));
    const after = document.querySelectorAll('.rung').length;
    expect(after).toBe(before + 1);
  });

  it('shows the I/O panel with a program column', async () => {
    await registerUser('iopanel', 'pw12', 'Io');
    await signInThroughUi('iopanel', 'pw12');
    fireEvent.click(screen.getByRole('button', { name: 'I/O Configuration' }));
    expect(screen.getByText('Chassis I/O Configuration')).toBeTruthy();
    expect(screen.getByText('Simulated I/O Panel')).toBeTruthy();
    expect(screen.getAllByRole('columnheader', { name: 'Program' }).length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.io-toggle').length).toBeGreaterThan(0);
  });

  it('renders the plant simulation with a 3D visual', async () => {
    await registerUser('plant', 'pw12', 'Plant');
    await signInThroughUi('plant', 'pw12');
    fireEvent.click(screen.getByRole('button', { name: 'Plant Simulation' }));
    expect(screen.getByText('Components')).toBeTruthy();
    expect(document.querySelectorAll('.pv3d-motor').length).toBeGreaterThan(0);
  });

  it('renders the HMI widget library', async () => {
    await registerUser('hmi', 'pw12', 'Hmi');
    await signInThroughUi('hmi', 'pw12');
    fireEvent.click(screen.getByRole('button', { name: 'HMI / SCADA' }));
    expect(screen.getByText('Widget Library')).toBeTruthy();
    expect(screen.getByText('Tag list')).toBeTruthy();
    expect(document.querySelectorAll('.hmi-lib-chip').length).toBeGreaterThan(4);
  });
});
