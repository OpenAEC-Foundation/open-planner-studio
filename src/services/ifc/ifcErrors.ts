export type IfcParseErrorReason =
  | 'not-step'
  | 'duration'
  | 'building-model'
  | 'truncated'
  | 'no-data-section'
  | 'xer-source-archive';

export class IfcParseError extends Error {
  readonly reason: IfcParseErrorReason;

  constructor(reason: IfcParseErrorReason, message: string) {
    super(message);
    this.name = 'IfcParseError';
    this.reason = reason;
    Object.setPrototypeOf(this, IfcParseError.prototype);
  }
}

export class IfcCalendarTimePrecisionError extends Error {
  readonly code = 'IFC_CALENDAR_TIME_PRECISION';
  constructor(readonly minutes: number) {
    super(`Calendar time cannot be saved exactly with its source information: ${minutes} minutes`);
    this.name = 'IfcCalendarTimePrecisionError';
  }
}
