// Full-page "Loading...this should only take a moment." screen the carrier shows while it opens a
// page (an account, a policy screen, ID cards, a portal page). The picture follows the policy: a
// car for auto and other vehicle products, a house for home (renters) policies.

export type LoaderIcon = 'auto' | 'home';

let current: LoaderIcon | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const LOADING_MS = 1700;

export const carLoaderStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  /** The icon on screen, or null when nothing is loading. */
  get: () => current,
};

/** Home policies show the house; everything else shows the car. */
export const loaderIconFor = (product: string | undefined): LoaderIcon => (product === 'renters' ? 'home' : 'auto');

/** Shows the loading page, then runs `work`. Ignored while a page is already loading. */
export function loadWithCar(work: () => void, icon: LoaderIcon = 'auto', ms = LOADING_MS) {
  if (current) return;
  current = icon;
  emit();
  window.setTimeout(() => {
    try { work(); } finally { current = null; emit(); }
  }, ms);
}
