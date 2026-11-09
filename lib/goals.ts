export type Goal = { id: string; title: string; progress: number };
export const STORAGE_KEY = "strategy-pulse:v1";
export const MAX_GOALS = 50;
export const PRESET_GOALS: readonly Goal[] = [
  { id: "clarity", title: "Clarify the product direction", progress: 60 },
  { id: "feedback", title: "Close the customer feedback loop", progress: 35 },
  { id: "delivery", title: "Improve delivery confidence", progress: 25 },
];
export function freshGoals(): Goal[] { return PRESET_GOALS.map(goal => ({ ...goal })); }
export function validProgress(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}
export function normalizeTitle(value: string): string {
  const title = value.trim().replace(/\s+/g, " ");
  if (!title || title.length > 80) throw new Error("Use a goal title between 1 and 80 characters.");
  return title;
}
export function addGoal(goals: Goal[], title: string, id: string): Goal[] {
  const clean = normalizeTitle(title);
  if (goals.length >= MAX_GOALS) throw new Error("This mini tracker supports up to 50 goals.");
  if (!id || goals.some(goal => goal.id === id)) throw new Error("Could not create a unique goal. Please retry.");
  if (goals.some(goal => goal.title.toLowerCase() === clean.toLowerCase())) throw new Error("That goal is already on your board.");
  return [...goals, { id, title: clean, progress: 0 }];
}
export function updateProgress(goals: Goal[], id: string, progress: number): Goal[] {
  if (!validProgress(progress)) throw new Error("Progress must be a whole number from 0 to 100.");
  if (!goals.some(goal => goal.id === id)) throw new Error("That goal could not be found.");
  return goals.map(goal => goal.id === id ? { ...goal, progress } : goal);
}
export function overallProgress(goals: Goal[]): number {
  return goals.length ? Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length) : 0;
}
export function decodeGoals(raw: string): Goal[] {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object" || !("version" in data) || data.version !== 1 || !("goals" in data) || !Array.isArray(data.goals)) throw new Error("Unsupported saved data.");
  if (data.goals.length < 1 || data.goals.length > MAX_GOALS) throw new Error("Invalid saved goal count.");
  const ids = new Set<string>();
  const titles = new Set<string>();
  return data.goals.map((goal: unknown) => {
    if (!goal || typeof goal !== "object" || !("id" in goal) || typeof goal.id !== "string" || !goal.id || goal.id.length > 100 || !("title" in goal) || typeof goal.title !== "string" || !("progress" in goal) || !validProgress(goal.progress)) throw new Error("Invalid saved goal.");
    const title = normalizeTitle(goal.title);
    if (ids.has(goal.id) || titles.has(title.toLowerCase())) throw new Error("Duplicate saved goal.");
    ids.add(goal.id); titles.add(title.toLowerCase());
    return { id: goal.id, title, progress: goal.progress };
  });
}
export type StoragePort = { getItem(key: string): string | null; setItem(key: string, value: string): void };
export function loadGoals(storage: StoragePort): { goals: Goal[]; warning: string | null; writable: boolean; raw: string | null; recoverable: boolean } {
  let raw: string | null;
  try { raw = storage.getItem(STORAGE_KEY); }
  catch { return { goals: freshGoals(), warning: "Browser storage cannot be read. Changes stay in this tab and may be lost on refresh.", writable: false, raw: null, recoverable: false }; }
  try { return { goals: raw === null ? freshGoals() : decodeGoals(raw), warning: null, writable: true, raw, recoverable: false }; }
  catch { return { goals: freshGoals(), warning: "Saved data is damaged or incompatible. This temporary board will not overwrite it. You can reset this app’s local data after confirmation; temporary changes will be lost on refresh.", writable: false, raw, recoverable: true }; }
}
export type SaveResult =
  | { status: "saved"; raw: string }
  | { status: "conflict"; message: string }
  | { status: "error"; message: string };
export const CONFLICT_MESSAGE = "Another tab changed the saved board. Saving is paused to protect that data. Reload the latest data to continue; this tab’s unsaved changes will be discarded.";
export function saveGoals(storage: StoragePort, goals: Goal[], expectedRaw: string | null): SaveResult {
  try {
    const raw = JSON.stringify({ version: 1, goals });
    decodeGoals(raw);
    // Best-effort stale-write guard, NOT an atomic compare-and-set.
    if (storage.getItem(STORAGE_KEY) !== expectedRaw) return { status: "conflict", message: CONFLICT_MESSAGE };
    storage.setItem(STORAGE_KEY, raw);
    if (storage.getItem(STORAGE_KEY) !== raw) return { status: "conflict", message: CONFLICT_MESSAGE };
    return { status: "saved", raw };
  } catch { return { status: "error", message: "Not saved. Changes are only in this tab and may be lost on refresh. Check browser storage before trying again." }; }
}
export type ResetStoragePort = StoragePort & { removeItem(key: string): void };
export function resetLocalData(storage: ResetStoragePort, confirmed: boolean, expectedRaw: string | null): { status: "cancelled" | "reset" | "conflict" | "error"; message?: string } {
  if (!confirmed) return { status: "cancelled" };
  try {
    if (storage.getItem(STORAGE_KEY) !== expectedRaw) return { status: "conflict", message: CONFLICT_MESSAGE };
    storage.removeItem(STORAGE_KEY);
    if (storage.getItem(STORAGE_KEY) !== null) return { status: "conflict", message: CONFLICT_MESSAGE };
    return { status: "reset" };
  } catch { return { status: "error", message: "Reset failed. Local data could not be removed; recovery has not been completed." }; }
}
