// Visual Preferences for the account pages (text size, reduced motion). A per-browser convenience:
// stored under an fao- key so "Sign out and clear this computer" removes it.
export type TextSize = 'Standard' | 'Large' | 'Larger';
export interface VisualPrefs { textSize: TextSize; reduceMotion: boolean }

const KEY = 'fao-visual-preferences';
const DEFAULTS: VisualPrefs = { textSize: 'Standard', reduceMotion: false };
export const TEXT_ZOOM: Record<TextSize, number> = { Standard: 1, Large: 1.1, Larger: 1.2 };

function load(): VisualPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<VisualPrefs> | null;
    return { ...DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    return DEFAULTS;
  }
}

let prefs = load();
const listeners = new Set<() => void>();

export const visualPrefsStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  get: () => prefs,
};

export function setVisualPrefs(next: VisualPrefs) {
  prefs = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable: keep for this visit */ }
  listeners.forEach((listener) => listener());
}
