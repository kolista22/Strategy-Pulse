"use client";
import { useEffect, useRef, useState } from "react";
import { addGoal, freshGoals, loadGoals, saveGoals, resetLocalData, STORAGE_KEY, CONFLICT_MESSAGE, overallProgress, updateProgress, type Goal } from "../lib/goals";
type SaveState = "loading" | "ready" | "saved" | "unsaved" | "blocked" | "conflict";
export default function Dashboard() {
  const [goals, setGoals] = useState<Goal[]>(freshGoals);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [recoverable, setRecoverable] = useState(false);
  const writable = useRef(false);
  const baseline = useRef<string | null>(null);
  function conflict() {
    writable.current = false; setRecoverable(false); setSaveState("conflict"); setWarning(CONFLICT_MESSAGE); setNotice("");
  }
  function readBoard() {
    try {
      const saved = loadGoals(window.localStorage);
      setGoals(saved.goals); setWarning(saved.warning); writable.current = saved.writable;
      baseline.current = saved.raw; setRecoverable(saved.recoverable);
      setSaveState(saved.writable ? (saved.raw === null ? "ready" : "saved") : "blocked");
    } catch {
      writable.current = false; setRecoverable(false); setSaveState("blocked");
      setWarning("Browser storage is unavailable. Changes stay in this tab and may be lost on refresh.");
    }
    setError(null); setNotice(""); setReady(true);
  }
  useEffect(() => {
    readBoard();
    function externalChange(event: StorageEvent) {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try {
        if (event.storageArea !== window.localStorage) return;
        if (window.localStorage.getItem(STORAGE_KEY) !== baseline.current) conflict();
      } catch {
        writable.current = false; setSaveState("blocked");
        setWarning("Storage cannot be checked. Saving is paused; changes may be lost on refresh.");
      }
    }
    window.addEventListener("storage", externalChange);
    return () => window.removeEventListener("storage", externalChange);
  }, []);
  function persist(next: Goal[]) {
    if (!writable.current) return;
    try {
      const result = saveGoals(window.localStorage, next, baseline.current);
      if (result.status === "saved") { baseline.current = result.raw; setSaveState("saved"); setWarning(null); }
      else if (result.status === "conflict") conflict();
      else { setSaveState("unsaved"); setWarning(result.message); }
    } catch { setSaveState("unsaved"); setWarning("Not saved. Changes are only in this tab and may be lost on refresh."); }
  }
  function apply(next: Goal[], message: string) {
    setGoals(next); setNotice(message); persist(next);
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!ready || saveState === "conflict") return; setError(null);
    try { apply(addGoal(goals, title, crypto.randomUUID()), "Goal added on this page."); setTitle(""); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Could not add the goal. Please retry."); }
  }
  function change(id: string, value: string) {
    if (!ready || saveState === "conflict") return;
    try { apply(updateProgress(goals, id, Number(value)), "Progress updated on this page."); setError(null); }
    catch { setError("Progress must be a whole number from 0 to 100."); }
  }
  function reset() {
    if (!window.confirm("Reset Strategy Pulse local data? This removes this app’s saved board and restores the three defaults. Other apps’ data will not be touched. Temporary changes will be discarded.")) return;
    try {
      const result = resetLocalData(window.localStorage, true, baseline.current);
      if (result.status === "conflict") { conflict(); return; }
      if (result.status !== "reset") { setSaveState("blocked"); setWarning(result.message ?? "Reset was not completed."); return; }
      baseline.current = null; writable.current = true; setRecoverable(false);
      setSaveState("unsaved"); setError(null); setTitle("");
      apply(freshGoals(), "Local data reset to defaults.");
    } catch { setSaveState("blocked"); setWarning("Reset failed. Recovery has not been completed."); }
  }
  const saveFeedback = saveState === "saved" ? "Saved in this browser." : saveState === "ready" ? "Default board ready. Edits will be saved in this browser." : saveState === "loading" ? "Loading your saved board…" : "Not saved in this tab. See the warning above.";
  const total = overallProgress(goals);
  return <main>
    <header className="topbar"><a className="brand" href="/" aria-label="Strategy Pulse home"><span className="brand-icon" aria-hidden="true">↗</span>Strategy Pulse<span className="lite">LITE</span></a><span className="local-badge"><span />Local-first workspace</span></header>
    <section className="intro"><p className="eyebrow">SMALL STEPS. SHARED DIRECTION.</p><h1>Turn direction<br />into <em>momentum.</em></h1><p className="description">A clear view of what matters. Track your strategic goals,<br className="desktop-break" /> celebrate progress, and keep moving forward.</p></section>
    <section className="overview" aria-label="Progress overview"><div><p className="eyebrow">OVERALL PROGRESS</p><div className="big-number">{total}<span>%</span></div><p className="muted">An equal-weight average of your goals</p></div><div className="overview-right"><span>{goals.length} active goals <span aria-hidden="true">↗</span></span><progress aria-label="Overall progress" value={total} max={100} /><p>Every step counts.</p></div></section>
    {warning && <div role="alert" className="warning"><p>{warning}</p>{recoverable && <button type="button" onClick={reset}>Reset local data</button>}{saveState === "conflict" && <button type="button" onClick={() => { if (window.confirm("Reload latest local data? Unsaved changes in this tab will be discarded.")) { setTitle(""); readBoard(); } }}>Reload latest data</button>}</div>}
    <section aria-labelledby="goals-heading"><div className="section-heading"><h2 id="goals-heading">Your strategic goals</h2><span>Focus on the next step</span></div><div className="goals-grid">{goals.map((goal,index) => <article className="goal-card" key={goal.id}><div className="card-top"><span className="goal-number">{String(index+1).padStart(2,"0")}</span><span className="status">{goal.progress === 100 ? "Complete" : goal.progress === 0 ? "Not started" : "In motion"}</span></div><h3>{goal.title}</h3><div className="progress-label"><label htmlFor={`progress-${goal.id}`}>Progress</label><output htmlFor={`progress-${goal.id}`}>{goal.progress}%</output></div><input id={`progress-${goal.id}`} type="range" min="0" max="100" step="1" value={goal.progress} disabled={!ready || saveState === "conflict"} onChange={event => change(goal.id,event.target.value)} /><div className="scale"><span>Just starting</span><span>Done</span></div></article>)}</div></section>
    <section className="add-section" aria-labelledby="add-heading"><div><p className="eyebrow">MAKE SPACE FOR WHAT’S NEXT</p><h2 id="add-heading">A new direction?</h2><p className="muted">Add one clear goal. Start small, build momentum.</p></div><form onSubmit={submit} noValidate><label htmlFor="goal-title">Goal title</label><div className="input-row"><input id="goal-title" name="title" value={title} onChange={event => { setTitle(event.target.value); setError(null); }} maxLength={80} placeholder="e.g. Launch a customer pilot" aria-describedby={error ? "form-error" : "title-hint"} aria-invalid={Boolean(error)} disabled={!ready || saveState === "conflict"} /><button disabled={!ready || saveState === "conflict"} type="submit">Add goal <span aria-hidden="true">+</span></button></div><p id="title-hint" className="hint">Up to 80 characters · New goals start at 0%</p>{error && <p id="form-error" role="alert" className="form-error">{error}</p>}</form></section>
    <p role="status" className="notice">{notice && <>{notice} </>}{saveFeedback}</p>
    <footer><span>Strategy Pulse — a fictional, AI-assisted portfolio project.</span><span>Stored in this browser only. No account. No cloud sync.</span></footer>
  </main>;
}
