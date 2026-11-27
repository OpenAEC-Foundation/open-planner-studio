let pending: { name: string; start: number; feedbackDone: boolean } | null = null;

function measure(name: string, start: number, detail: string): void {
  try {
    performance.measure(name, { start, end: performance.now(), detail });
  } catch {
  }
}

export function markReportInput(name: string): void {
  const start = performance.now();
  pending = { name, start, feedbackDone: false };
  requestAnimationFrame(() => {
    if (pending && pending.start === start && !pending.feedbackDone) {
      pending.feedbackDone = true;
      measure('ops-report:feedback', start, name);
    }
  });
}

export function markReportPaperCommitted(): void {
  const current = pending;
  if (!current) return;
  pending = null;
  requestAnimationFrame(() => measure('ops-report:paper', current.start, current.name));
}

export function timeReportStep<T>(name: 'ops-report:record' | 'ops-report:record-rows' | 'ops-report:svg', run: () => T): T {
  const start = performance.now();
  const result = run();
  measure(name, start, '');
  return result;
}
