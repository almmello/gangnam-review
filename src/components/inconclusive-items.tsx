"use client";
import { useState } from "react";
import type { ReviewIssue } from "@/lib/analysis/contracts";
import { issueReasons, kindLabel } from "@/lib/analysis/presentation";

export function InconclusiveItems({ items }: { items: ReviewIssue[] }) {
  const [shown, setShown] = useState(12);
  if (!items.length) return null;
  return <section className="inconclusive-items" aria-labelledby="inconclusive-title">
    <div className="panel-heading"><div><span className="eyebrow">INDIVIDUAL ITEMS · NO PAIR ASSIGNED</span><h3 id="inconclusive-title">Inconclusive</h3><p>{items.length} individual records match the selected filters. Each is shown separately, without an assigned partner.</p></div></div>
    <div className="findings-list">{items.slice(0, shown).map((item) => <article className="finding-card compact-finding" aria-label="Inconclusive item" key={item.record.id}>
      <div className="finding-top"><div><strong>{item.record.clinic}</strong><small>{kindLabel(item.record.kind)} · Individual record</small></div><span className="status-pill">Inconclusive</span></div>
      {item.reasons.map((reason) => <p className="finding-reason" key={reason}>{issueReasons[reason]}</p>)}
      <details className="finding-details"><summary>View item details</summary><p className="source-text">{item.record.text}</p><a href={item.record.pageUrl} target="_blank" rel="noreferrer">Open source page ↗</a><small>Record reference: {item.record.id}</small></details>
    </article>)}</div>
    {items.length > shown && <button className="button button-secondary show-more" onClick={() => setShown((n) => n + 12)}>Show 12 more inconclusive items</button>}
  </section>;
}
