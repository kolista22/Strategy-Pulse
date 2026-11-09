"use client";
import { useEffect, useRef, useState } from "react";
import { addGoal, freshGoals, loadGoals, overallProgress, saveGoals, updateProgress, type Goal } from "../lib/goals";
export default function Dashboard() {
  const [goals, setGoals] = useState<Goal[]>(freshGoals);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const writable = useRef(false);
  useEffect(() => {
    try { const saved = loadGoals(window.localStorage); setGoals(saved.goals); setWarning(saved.warning); writable.current = saved.writable; }
    catch { setWarning("Browser storage is unavailable. Changes will only last in this tab."); }
    setReady(true);
  }, []);
  // Never persist the server-rendered defaults before the saved board is loaded.
  useEffect(() => {
    if (!ready || !writable.current) return;
    try { setWarning(saveGoals(window.localStorage, goals)); }
    catch { setWarning("Browser storage is unavailable. Changes will only last in this tab."); }
  }, [goals, ready]);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    try { const next = addGoal(goals, title, crypto.randomUUID()); setGoals(next); setTitle(""); setNotice("Goal added. Make a little progress today."); }
    catch (problem) { setError(problem instanceof Error ? problem.message : "Could not add the goal. Please retry."); }
  }
  function change(id: string, value: string) {
    try { setGoals(current => updateProgress(current, id, Number(value))); setNotice(""); }
    catch { setError("Progress must be a whole number from 0 to 100."); }
  }
  const total = overallProgress(goals);
  return <main>
    <header className="topbar"><a className="brand" href="/" aria-label="Strategy Pulse home"><span className="brand-icon" aria-hidden="true">↗</span>Strategy Pulse<span className="lite">LITE</span></a><span className="local-badge"><span />Local-first workspace</span></header>
    <section className="intro"><p className="eyebrow">SMALL STEPS. SHARED DIRECTION.</p><h1>Turn direction<br />into <em>momentum.</em></h1><p className="description">A clear view of what matters. Track your strategic goals,<br className="desktop-break" /> celebrate progress, and keep moving forward.</p></section>
    <section className="overview" aria-label="Progress overview"><div><p className="eyebrow">OVERALL PROGRESS</p><div className="big-number">{total}<span>%</span></div><p className="muted">An equal-weight average of your goals</p></div><div className="overview-right"><span>{goals.length} active goals <span aria-hidden="true">↗</span></span><progress aria-label="Overall progress" value={total} max={100} /><p>Every step counts.</p></div></section>
    {warning && <p role="alert" className="warning">{warning}</p>}
    <section aria-labelledby="goals-heading"><div className="section-heading"><h2 id="goals-heading">Your strategic goals</h2><span>Focus on the next step</span></div><div className="goals-grid">{goals.map((goal,index) => <article className="goal-card" key={goal.id}><div className="card-top"><span className="goal-number">{String(index+1).padStart(2,"0")}</span><span className="status">{goal.progress === 100 ? "Complete" : goal.progress === 0 ? "Not started" : "In motion"}</span></div><h3>{goal.title}</h3><div className="progress-label"><label htmlFor={`progress-${goal.id}`}>Progress</label><output htmlFor={`progress-${goal.id}`}>{goal.progress}%</output></div><input id={`progress-${goal.id}`} type="range" min="0" max="100" step="1" value={goal.progress} disabled={!ready} onChange={event => change(goal.id,event.target.value)} /><div className="scale"><span>Just starting</span><span>Done</span></div></article>)}</div></section>
    <section className="add-section" aria-labelledby="add-heading"><div><p className="eyebrow">MAKE SPACE FOR WHAT’S NEXT</p><h2 id="add-heading">A new direction?</h2><p className="muted">Add one clear goal. Start small, build momentum.</p></div><form onSubmit={submit} noValidate><label htmlFor="goal-title">Goal title</label><div className="input-row"><input id="goal-title" name="title" value={title} onChange={event => { setTitle(event.target.value); setError(null); }} maxLength={80} placeholder="e.g. Launch a customer pilot" aria-describedby={error ? "form-error" : "title-hint"} aria-invalid={Boolean(error)} disabled={!ready} /><button disabled={!ready} type="submit">Add goal <span aria-hidden="true">+</span></button></div><p id="title-hint" className="hint">Up to 80 characters · New goals start at 0%</p>{error && <p id="form-error" role="alert" className="form-error">{error}</p>}</form></section>
    <p role="status" className="notice">{notice || (ready ? "Your board is ready." : "Loading your saved board…")}</p>
    <footer><span>Strategy Pulse — a fictional, AI-assisted portfolio project.</span><span>Stored in this browser only. No account. No cloud sync.</span></footer>
  </main>;
}
