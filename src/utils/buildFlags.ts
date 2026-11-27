export const PLATFORM_BUILD: boolean = import.meta.env?.VITE_OPS_PLATFORM === '1';

export const EXTENSIONS_ENABLED: boolean = !PLATFORM_BUILD;

export const DEMO_START_EXAMPLE: boolean = !PLATFORM_BUILD;

export const AI_MODE_AVAILABLE: boolean = !PLATFORM_BUILD;

export const DOWNLOAD_STATS_AVAILABLE: boolean = !PLATFORM_BUILD;

export const FEEDBACK_AVAILABLE: boolean = !PLATFORM_BUILD;

export const UPDATES_AVAILABLE: boolean = !PLATFORM_BUILD;
