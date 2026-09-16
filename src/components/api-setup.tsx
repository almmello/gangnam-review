"use client";
import { useEffect, useRef, useState } from "react";
import { PROVIDERS } from "@/lib/analysis/providers";
import { useConnection } from "./connection-provider";
import { Icon } from "./icon";
export function ApiSetup({ disabled = false }: { disabled?: boolean }) {
  const { provider } = useConnection();
  return <ProviderSetup key={provider} disabled={disabled} />;
}
function ProviderSetup({ disabled }: { disabled: boolean }) {
  const { provider, mode, key, setMode, setKey } = useConnection();
  const config = PROVIDERS[provider];
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState("Connection not tested.");
  const [busy, setBusy] = useState(false);
  const testController = useRef<AbortController | null>(null);
  const locked = disabled || busy;
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/ai/connection?provider=${provider}`, { cache: "no-store", signal: controller.signal })
      .then((r) => r.json()).then((data) => { if (!controller.signal.aborted) setAvailable(data.provider === provider && data.sharedAvailable === true); })
      .catch(() => { if (!controller.signal.aborted) setStatus("Could not check server configuration. You can still use a personal key."); });
    return () => { controller.abort(); testController.current?.abort(); };
  }, [provider]);
  async function test() {
    const controller = new AbortController(); testController.current = controller;
    setBusy(true); setStatus(`Testing a small request to ${config.label}…`);
    try {
      const response = await fetch("/api/ai/connection", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: controller.signal, body: JSON.stringify({ provider, ...(mode === "personal" ? { key: key.trim() } : {}) }) });
      const data = await response.json();
      if (!controller.signal.aborted) setStatus(response.ok && data.provider === provider && data.model === config.model ? `Connected. ${config.label} accepted the request and returned text.` : data.error ?? "Connection could not be verified.");
    } catch { if (!controller.signal.aborted) setStatus("Connection could not be tested. Try again."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className="setup-grid"><section className="setup-card" aria-labelledby="connection-title">
    <div className="panel-heading"><div><span className="eyebrow">ANALYSIS PROVIDER</span><h2 id="connection-title">{config.label} API</h2></div></div>
    <div className="stage-notice"><Icon name="info" size={17} /><p><strong>Your key stays private.</strong><br />Server keys never reach the browser. Your personal key stays in tab memory. Changing your connection does not clear collected sources or start an analysis.</p></div>
    <fieldset className="connection-options"><legend>Choose a connection</legend>{(["demo", "personal"] as const).map((value) => <label key={value} className={mode === value ? "connection-option selected" : "connection-option"}><input type="radio" name="connection" value={value} disabled={locked} checked={mode === value} onChange={() => { setMode(value); setStatus("Connection changed. Test before analyzing."); }} /><span><strong>{value === "demo" ? "Shared demo access" : "Bring your own key"}</strong><small>{value === "demo" ? available === null ? "Checking server configuration…" : available ? `Configured on this server for ${config.label}. Test to verify provider access.` : "Unavailable. Use your own key or ask the site owner to enable shared access." : `Use your own authorized ${config.label} API key.`}</small></span></label>)}</fieldset>
    {mode === "personal" ? <div className="key-preview"><label htmlFor="provider-key">Your {config.label} API key</label><input id="provider-key" type="password" value={key} disabled={locked} onChange={(e) => { setKey(e.target.value); setStatus("Key changed. Connection not tested."); }} autoComplete="off" spellCheck={false} placeholder={`Paste your ${config.label} API key`} aria-describedby="key-help" /><p id="key-help">Memory only: no browser storage, cookies, URL parameters or exports. Reloading or clearing below removes your personal key. Production uses HTTPS; localhost uses your loopback connection.</p><button type="button" className="button button-secondary" disabled={locked} onClick={() => { setKey(""); setStatus("Personal key cleared."); }}>Clear personal key</button></div> : <div className="connection-explainer"><Icon name="shield" size={19} /><p>Shared demo access uses the site owner&apos;s {config.label} balance when enabled. A personal key uses your own account. The server key is never exposed to your browser.</p></div>}
    <div className="model-row"><span>Model</span><code>{config.model}</code></div><button type="button" className="button button-primary" disabled={locked || (mode === "personal" ? key.trim().length < 20 : available !== true)} onClick={() => void test()}><Icon name="key" size={17} />{busy ? "Testing…" : "Test connection"}</button><p role="status" className="field-hint">{status}</p>
  </section><aside className="setup-aside"><div className="round-icon"><Icon name="key" size={24} /></div><h2>Your key,<br />your connection.</h2><p>Analysis uses the direct DeepSeek API and may consume your account balance.</p><ol><li>Sign in to your DeepSeek account.</li><li>Open API keys and create an authorized key.</li><li>Select “Bring your own key”, paste it, and test the connection.</li></ol><a className="text-link" href={config.keyUrl} target="_blank" rel="noreferrer">Manage DeepSeek API keys<Icon name="external" size={15} /></a><p className="fine-print">DeepSeek pricing, balance and limits apply. No automatic balance purchase is performed.</p><div className="privacy-note"><Icon name="shield" size={18} /><div><strong>Know what leaves the app.</strong><p>Relevant published text is sent to DeepSeek. Obvious emails and contact numbers are removed, but this is not full anonymization. Provider data policies apply. No medical advice or authenticity certification.</p><a href={config.docsUrl} target="_blank" rel="noreferrer">DeepSeek API documentation<Icon name="external" size={12} /></a></div></div></aside></div>;
}
