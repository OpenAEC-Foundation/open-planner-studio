const DATE_PART = /^(\d{4})-(\d{2})-(\d{2})/;

function datePart(moment: string): string | undefined {
  return DATE_PART.test(moment) ? moment.slice(0, 10) : undefined;
}

function isMidnight(moment: string): boolean {
  return /^(T00:00(:00(\.0{1,3})?)?)?$/.test(moment.slice(10));
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

const twoDigits = (value: number) => String(value).padStart(2, '0');

export function nextCalendarDate(date: string): string {
  let year = Number(date.slice(0, 4)), month = Number(date.slice(5, 7)), day = Number(date.slice(8, 10)) + 1;
  if (day > daysInMonth(year, month)) {
    day = 1;
    month++;
    if (month > 12) { month = 1; year++; }
  }
  return `${String(year).padStart(4, '0')}-${twoDigits(month)}-${twoDigits(day)}`;
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
