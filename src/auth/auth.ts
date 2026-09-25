/**
 * Local user accounts for the trainer. This is a self-contained, offline
 * authentication layer: no server. Passwords are salted and hashed with
 * PBKDF2 via the Web Crypto API and stored in localStorage. It is designed
 * for classroom use on a shared machine, not for protecting real secrets.
 */

export interface User {
  id: string;
  username: string;
  displayName: string;
  role: 'instructor' | 'student';
  createdAt: number;
}

export interface Session {
  userId: string;
  since: number;
}

interface StoredUser extends User {
  salt: string;
  hash: string;
}

const USERS_KEY = 'plc-trainer.users.v1';
const SESSION_KEY = 'plc-trainer.session.v1';
const ITERATIONS = 120000;

function getCrypto(): Crypto {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto is not available in this environment');
  }
  return crypto;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  getCrypto().getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await getCrypto().subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await getCrypto().subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    256,
  );
  return toHex(bits);
}

function readUsers(): StoredUser[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredUser[]) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function publicUser(u: StoredUser): User {
  const { salt: _salt, hash: _hash, ...rest } = u;
  void _salt;
  void _hash;
  return rest;
}

export function listUsers(): User[] {
  return readUsers().map(publicUser);
}

export function findUser(username: string): User | undefined {
  const u = readUsers().find((x) => x.username.toLowerCase() === username.toLowerCase());
  return u ? publicUser(u) : undefined;
}

export async function registerUser(
  username: string,
  password: string,
  displayName: string,
  role: User['role'] = 'student',
): Promise<User> {
  const name = username.trim();
  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(name)) {
    throw new Error('Username must be 3–32 characters (letters, numbers, . _ -)');
  }
  if (password.length < 4) {
    throw new Error('Password must be at least 4 characters');
  }
  const users = readUsers();
  if (users.some((u) => u.username.toLowerCase() === name.toLowerCase())) {
    throw new Error('That username is already taken');
  }
  const salt = randomSalt();
  const hash = await hashPassword(password, salt);
  const stored: StoredUser = {
    id: `user_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    username: name,
    displayName: displayName.trim() || name,
    role,
    createdAt: Date.now(),
    salt,
    hash,
  };
  users.push(stored);
  writeUsers(users);
  return publicUser(stored);
}

export async function login(username: string, password: string): Promise<User> {
  const stored = readUsers().find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (!stored) throw new Error('No account with that username');
  const hash = await hashPassword(password, stored.salt);
  if (hash !== stored.hash) throw new Error('Incorrect password');
  const user = publicUser(stored);
  writeSession({ userId: user.id, since: Date.now() });
  return user;
}

export function logout(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SESSION_KEY);
}

function writeSession(session: Session): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function currentUser(): User | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    const stored = readUsers().find((u) => u.id === session.userId);
    return stored ? publicUser(stored) : null;
  } catch {
    return null;
  }
}

/** Seed a default account on first run so the app is usable immediately. */
export async function ensureSeedUser(): Promise<User | null> {
  if (readUsers().length > 0) return currentUser();
  try {
    await registerUser('instructor', 'plc123', 'Instructor', 'instructor');
  } catch {
    /* ignore */
  }
  return currentUser();
}
