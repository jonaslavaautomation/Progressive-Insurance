// Portal session: last login stamp, sign out / sign in and the idle timeout state.
// A tiny external store so any screen (profile menu, session guard) can read and change it.
import { notify } from '@/services/activity';

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

interface SessionState { signedOut: boolean; reason: 'manual' | 'timeout' | 'cleared' | ''; lastLogin: string }

/** Set by signOutAndClear so the reloaded page opens on the signed-out screen. */
function clearedFlag(): boolean {
  try { const cleared = sessionStorage.getItem('fao-cleared') === '1'; sessionStorage.removeItem('fao-cleared'); return cleared; } catch { return false; }
}
const cleared = clearedFlag();
let session: SessionState = cleared ? { signedOut: true, reason: 'cleared', lastLogin: '' } : { signedOut: false, reason: '', lastLogin: readPreviousLogin() };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const sessionStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  get: () => session,
};

export function signOut(reason: 'manual' | 'timeout' = 'manual') {
  notify({ kind: 'account', title: reason === 'timeout' ? 'Signed out (session timed out)' : 'Signed out', detail: reason === 'timeout' ? 'Session ended after 15 minutes of inactivity.' : 'User signed out of LAVA Training.' });
  session = { ...session, signedOut: true, reason };
  emit();
}

export function signIn() {
  session = { signedOut: false, reason: '', lastLogin: readPreviousLogin() };
  notify({ kind: 'account', title: 'Signed in', detail: `New sign-in on this browser (${navigator.userAgent.includes('Windows') ? 'Windows' : navigator.userAgent.includes('Mac') ? 'Mac' : 'device'}). Previous sign-in: ${formatLogin(session.lastLogin)}.` });
  emit();
}

let sessionNoted = false;
/** Records the start of this browser session once, as the signed-in agent. */
export function noteSessionStart(name: string) {
  if (sessionNoted || session.signedOut) return;
  sessionNoted = true;
  // A reload in the same tab is the same session.
  try { if (sessionStorage.getItem('fao-session-noted')) return; sessionStorage.setItem('fao-session-noted', '1'); } catch { /* storage unavailable */ }
  notify({ kind: 'account', title: 'Signed in', detail: `Session started on this browser. Previous sign-in: ${formatLogin(session.lastLogin)}.`, by: name });
}

/** Signs out and erases everything LAVA Training stored in this browser (policies, quotes, activity,
 * preferences, profile), for shared or public computers. */
export function signOutAndClear() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('fao-')) localStorage.removeItem(key);
    sessionStorage.clear();
    sessionStorage.setItem('fao-cleared', '1');
  } catch { /* storage unavailable */ }
  window.location.replace(window.location.pathname);
}

/** "09/29/2026 4:12 PM" from the stored ISO time (real clock, not the training clock). */
export function formatLogin(iso: string): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return 'First sign-in on this computer';
  return `${date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}
