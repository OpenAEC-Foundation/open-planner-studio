export interface WorkCalendar {
  id: string;
  name: string;
  description: string;
  workDays: number[]; // 1=Monday ... 7=Sunday (ISO 8601 day of week)
  workStartHour: number; // e.g., 7
  workEndHour: number;   // e.g., 16
  hoursPerDay: number;   // net working hours (e.g., 8)
  holidays: Holiday[];
}

export interface Holiday {
  name: string;
  startDate: string; // ISO 8601 date
  endDate: string;   // ISO 8601 date
}

export function createDefaultCalendar(): WorkCalendar {
  return {
    id: 'cal-default',
    name: 'Bouwkalender NL',
    description: 'Standaard bouwkalender: ma-vr 07:00-16:00',
    workDays: [1, 2, 3, 4, 5], // Monday to Friday
    workStartHour: 7,
    workEndHour: 16,
    hoursPerDay: 8,
    holidays: [
      { name: 'Nieuwjaar', startDate: '2026-01-01', endDate: '2026-01-01' },
      { name: 'Goede Vrijdag', startDate: '2026-04-03', endDate: '2026-04-03' },
      { name: 'Pasen', startDate: '2026-04-05', endDate: '2026-04-06' },
      { name: 'Koningsdag', startDate: '2026-04-27', endDate: '2026-04-27' },
      { name: 'Bevrijdingsdag', startDate: '2026-05-05', endDate: '2026-05-05' },
      { name: 'Hemelvaart', startDate: '2026-05-14', endDate: '2026-05-15' },
      { name: 'Pinksteren', startDate: '2026-05-24', endDate: '2026-05-25' },
      { name: 'Bouwvak (regio Noord)', startDate: '2026-07-20', endDate: '2026-08-07' },
    ],
  };
}
