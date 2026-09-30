// Training clock: lets trainers move "today" forward to practice billing, cancellation and renewal.
let override: Date | null = null;

export function setClock(date: Date | null) {
  override = date ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : null;
}

export function clockDate(): Date {
  if (override) return new Date(override);
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
