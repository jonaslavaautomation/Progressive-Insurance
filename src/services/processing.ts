// "Processing..." overlay shown while the carrier system submits a transaction (bind, payment,
// policy change, search). Runs the work after a short, realistic delay.

let label = '';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const processingStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  get: () => label,
};

/** Shows the overlay with `text`, then runs `work`. Ignored while another transaction is running. */
export function runWithSpinner(text: string, work: () => void, ms = 800) {
  if (label) return;
  label = text;
  emit();
  window.setTimeout(() => {
    try { work(); } finally { label = ''; emit(); }
  }, ms);
}
