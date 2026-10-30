// Pure saved-profile helpers (no DOM). freshProgress is the day-1 profile; startOver is the grown-up "Start over" (SPEC §16 SO1):
// everything goes back to day 1 except the grown-up's own settings (session limit, music on/off, difficulty overrides).
export const freshProgress = cfg => ({
  read: 1, trace: 1, math: 1, music: 1, shapes: 1,
  readHistory: [], traceHistory: [], mathHistory: [], musicHistory: [], shapesHistory: [],
  items: {}, guide: {},
  taskCount: {read: 0, trace: 0, music: 0, math: 0, shapes: 0},
  served: [], recipeBook: [], stickerDays: [], sparkles: 0, stickers: 0, stickerIds: [],
  settings: {music: true, limit: cfg.sessionLimitMinutes, read: 0, trace: 0, math: 0, musicLevel: 0},
});
export const startOver = (progress, cfg) => ({...freshProgress(cfg), settings: {...progress.settings}});
