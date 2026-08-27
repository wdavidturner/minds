export const DEFAULTS = {
  minThoughts: 8,
  digCap: 4,
  hotSleepSeconds: 45,
  idleSleepSeconds: 720,
  windDownMs: 120_000,
  alarmWallMs: 14 * 60 * 1000,
} as const;

export const DEFAULT_TEMPERAMENT = {
  branching: 0.5,
  persistence: 0.5,
  curiosity: 0.5,
  distance: 0.5,
} as const;
