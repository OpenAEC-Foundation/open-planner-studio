const DATE_PART = /^(\d{4})-(\d{2})-(\d{2})/;

function datePart(moment: string): string | undefined {
  return DATE_PART.test(moment) ? moment.slice(0, 10) : undefined;
}

function isMidnight(moment: string): boolean {
  return /^(T00:00(:00(\.0{1,3})?)?)?$/.test(moment.slice(10));
}

export function nextCalendarDate(date: string): string {
  const [, y, m, d] = DATE_PART.exec(date)!;
  const next = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d) + 1));
  return next.toISOString().slice(0, 10);
}

export interface SharedSpan {
  readonly start?: string;
  readonly endExclusive?: string;
}

export function projectSpan(start: string, finish: string): SharedSpan {
  const startDate = datePart(start);
  if (startDate === undefined) return {};
  const finishDate = datePart(finish);
  if (finishDate === undefined || finish <= start) return { start: startDate, endExclusive: nextCalendarDate(startDate) };
  const endExclusive = isMidnight(finish) ? finishDate : nextCalendarDate(finishDate);
  return { start: startDate, endExclusive: endExclusive > startDate ? endExclusive : nextCalendarDate(startDate) };
}

export function momentOfSharedDate(date: string): string {
  return `${date}T00:00`;
}
