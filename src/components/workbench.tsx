"use client";
import { useState } from "react";
import Link from "next/link";
import { scenarios, type ScenarioId } from "@/lib/product";
import { Icon } from "./icon";
import { LiveSources } from "./live-sources";
export function Workbench() {
  const [selected, setSelected] = useState<ScenarioId>("missing-information");
  const scenario = scenarios.find((item) => item.id === selected)!;
  return <section className="page-width workbench" aria-label="Review quality workbench">
    <div className="stage-notice"><Icon name="info" size={16} /><p><strong>Evidence-led analysis</strong><span> One live collection, three lenses. AI interpretations with traceable citations.</span></p></div>
    <div className="source-first-workspace">
      <LiveSources scenario={selected}>
        <section className="lens-section" aria-labelledby="lens-title">
          <div className="section-step"><span className="step-index">2</span><div><p className="eyebrow">CHANGE THE QUESTION, NOT THE DATA</p><h2 id="lens-title">Choose your lens</h2><p>Switch lenses without scanning or collecting the website again.</p></div></div>
          <div className="scenario-menu" role="group" aria-label="Analysis scenario">{scenarios.map((item) => <button type="button" key={item.id} className={"scenario-button " + (selected === item.id ? "selected" : "")} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
            <span className="scenario-icon"><Icon name={item.icon} size={20} /></span><span><span className="scenario-number">{item.number}</span><strong>{item.title}</strong><small>{item.short}</small></span><Icon name="arrow" size={15} className="scenario-arrow" />
          </button>)}</div>
          <div className="scenario-intro" aria-live="polite"><span className="eyebrow">SELECTED LENS</span><h2>{scenario.title}</h2><p>{scenario.description}</p></div>
          <ul className="lens-checks">{scenario.checks.map((check) => <li key={check}><Icon name="check" size={16} />{check}</li>)}</ul>
          <div className="evidence-note"><Icon name="shield" size={18} /><p>{scenario.takeaway}</p></div>
        </section>
      </LiveSources>
      <div className="workspace-bottom"><span>No medical advice. No authenticity certification.</span><Link href="/setup">Review API setup<Icon name="arrow" size={14} /></Link></div>
    </div>
  </section>;
}
