// Full-page "Loading...this should only take a moment." screen the carrier shows while it pulls up a
// customer account. Runs the navigation after a short, realistic delay.

let loading = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const LOADING_MS = 1700;

export const carLoaderStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  get: () => loading,
};

/** Shows the loading car, then runs `work`. Ignored while an account is already loading. */
export function loadWithCar(work: () => void, ms = LOADING_MS) {
  if (loading) return;
  loading = true;
  emit();
  window.setTimeout(() => {
    try { work(); } finally { loading = false; emit(); }
  }, ms);
}
