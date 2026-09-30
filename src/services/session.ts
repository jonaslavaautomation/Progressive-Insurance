// Portal session: last login stamp, sign out / sign in and the idle timeout state.
// A tiny external store so any screen (profile menu, session guard) can read and change it.

const LAST_LOGIN_KEY = 'fao-last-login';
/** Idle time before the timeout warning, and the countdown shown in the warning. */
export const IDLE_WARNING_MS = 15 * 60 * 1000;
export const WARNING_COUNTDOWN_S = 120;

function readPreviousLogin(): string {
  try {
    const previous = localStorage.getItem(LAST_LOGIN_KEY) ?? '';
    localStorage.setItem(LAST_LOGIN_KEY, new Date().toISOString());
    return previous;
  } catch {
    return '';
  }
}

interface SessionState { signedOut: boolean; reason: 'manual' | 'timeout' | ''; lastLogin: string }

let session: SessionState = { signedOut: false, reason: '', lastLogin: readPreviousLogin() };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const sessionStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  get: () => session,
};

export function signOut(reason: 'manual' | 'timeout' = 'manual') {
  session = { ...session, signedOut: true, reason };
  emit();
}

export function signIn() {
  session = { signedOut: false, reason: '', lastLogin: readPreviousLogin() };
  emit();
}

/** "09/29/2026 4:12 PM" from the stored ISO time (real clock, not the training clock). */
export function formatLogin(iso: string): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return 'First sign-in on this computer';
  return `${date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}
