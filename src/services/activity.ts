// Account activity feed behind the notification bell: every quote, bind, document, payment,
// policy change, claim and sign-in done under this login is recorded with who did it and when.
// Stored in this browser and synced live across its tabs.

export type ActivityKind = 'quote' | 'bind' | 'document' | 'payment' | 'change' | 'claim' | 'cancel' | 'renewal' | 'billing' | 'system' | 'account';

export interface ActivityTarget {
  view: 'policy' | 'customer' | 'proof' | 'wizard' | 'commercial' | 'page';
  policyId?: string;
  customerKey?: string;
  page?: string;
}

export interface ActivityEntry {
  id: string;
  /** Real clock time (ISO). */
  at: string;
  /** Training date the action happened on (MM/DD/YYYY). */
  day: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  /** Signed-in agent who did it ('System' for automatic policy events). */
  by: string;
  read: boolean;
  target?: ActivityTarget;
}

const KEY = 'fao-activity-v1';
const LIMIT = 300;

function load(): ActivityEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as ActivityEntry[]; } catch { return []; }
}

let entries: ActivityEntry[] = load();
let actor = 'Training Agent';
let trainingDay = '';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* storage unavailable */ } };

// Another tab using the same login updates this bell live.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => { if (event.key === KEY) { entries = load(); emit(); } });
}

export const activityStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  get: () => entries,
};

/** Who is signed in and the training date, so entries record them. */
export function setActivityContext(name: string, day: string) { actor = name; trainingDay = day; }

export function notify(input: { kind: ActivityKind; title: string; detail?: string; target?: ActivityTarget; by?: string; day?: string }) {
  const entry: ActivityEntry = { id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), day: input.day ?? trainingDay, kind: input.kind, title: input.title, detail: input.detail ?? '', by: input.by ?? actor, read: false, target: input.target };
  entries = [entry, ...entries].slice(0, LIMIT);
  save();
  emit();
}

export function markRead(id?: string) {
  entries = entries.map((entry) => (!id || entry.id === id ? { ...entry, read: true } : entry));
  save();
  emit();
}

export function clearActivity() {
  entries = [];
  save();
  emit();
}

/** "Just now", "5 min ago", "2 hr ago", "Yesterday", or the date. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  if (hours < 48) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Maps a policy history event to a notification kind (used for servicing transactions and clock events). */
export function kindForEvent(event: string): ActivityKind {
  if (/claim/i.test(event)) return 'claim';
  if (/payment|refund|fee/i.test(event)) return 'payment';
  if (/cancel|rescind|reinstat|expired|non-renew/i.test(event)) return 'cancel';
  if (/renew/i.test(event)) return 'renewal';
  if (/bill|installment/i.test(event)) return 'billing';
  if (/ID card|verification|document|e-Sign|emailed/i.test(event)) return 'document';
  if (/change|lienholder|address|vehicle|driver/i.test(event)) return 'change';
  return 'system';
}
