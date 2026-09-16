"use client";
import { useEffect, useRef, useState } from "react";
import { type Finding, type Report, type ReportKey, type ReviewIssue, type Task, validateOutput } from "@/lib/analysis/contracts";
import { PROVIDERS } from "@/lib/analysis/providers";
import { buildPlan } from "@/lib/analysis/plan";
import { useConnection } from "./connection-provider";
import type { Collection } from "./use-live-sources";
class InvalidModelOutput extends Error {}
export function useAnalysis() {
  const [allReports, setReports] = useState<Partial<Record<ReportKey, Report>>>({});
  const [active, setActive] = useState<Task["lens"] | null>(null);
  const runRef = useRef<AbortController | null>(null);
  const connection = useConnection();
  const reports: Partial<Record<Task["lens"], Report>> = {};
  for (const report of Object.values(allReports)) if (report.provider === connection.provider) reports[report.lens] = report;
  useEffect(() => () => runRef.current?.abort(), []);
  function reset() { runRef.current?.abort(); runRef.current = null; setReports({}); setActive(null); }
  async function run(collection: Collection, lens: Task["lens"], restart = false) {
    if (active || runRef.current && !runRef.current.signal.aborted) return;
    const previous = restart ? undefined : reports[lens];
    const provider = connection.provider;
    const model = PROVIDERS[provider].model;
    const reportKey: ReportKey = `${provider}:${lens}`;
    if (previous?.status === "complete" && previous.collectionStartedAt === collection.startedAt) return;
    const controller = new AbortController(); runRef.current = controller; setActive(lens);
    let plan: ReturnType<typeof buildPlan>;
    try { plan = buildPlan(collection.pages, lens); }
    catch {
      setReports((current) => ({ ...current, [reportKey]: { provider, lens, collectionStartedAt: collection.startedAt, collectionFinishedAt: collection.finishedAt, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), status: "partial", results: [], tasks: 0, completedTasks: 0, eligible: 0, selected: 0, warnings: ["The collection could not be converted into a safe analysis request. No model request was made."], error: "Unsupported extracted record format. Refresh sources to collect a new dataset.", model } }));
      runRef.current = null; setActive(null); return;
    }
    const same = previous?.collectionStartedAt === collection.startedAt;
    const report: Report = same ? { ...previous!, results: [...previous!.results], status: "running", error: null, finishedAt: null } : { provider, lens, collectionStartedAt: collection.startedAt, collectionFinishedAt: collection.finishedAt, startedAt: new Date().toISOString(), finishedAt: null, status: "running", results: plan.deterministic, tasks: plan.tasks.length, completedTasks: 0, eligible: plan.eligible, selected: plan.selected, warnings: [...plan.warnings, ...(!collection.complete ? ["This analysis uses a partial collection."] : [])], error: null, model };
    report.stopReason = undefined;
    report.processedUnitIds = [...(previous && same ? previous.processedUnitIds ?? previous.results.map((r) => r.unitId) : plan.deterministic.map((r) => r.unitId))];
    report.issues = same ? (previous?.issues ?? []).map((issue) => ({ ...issue, reasons: [...issue.reasons] })) : [];
    const processed = new Set(report.processedUnitIds);
    const publish = () => { if (runRef.current === controller) setReports((current) => ({ ...current, [reportKey]: { ...report, results: [...report.results], processedUnitIds: [...report.processedUnitIds!], issues: report.issues!.map((issue) => ({ ...issue, reasons: [...issue.reasons] })) } })); };
    function addIssues(task: Task, unit: Task["units"][number], reason: ReviewIssue["reasons"][number]) {
      for (const id of unit.recordIds) {
        const issue = report.issues!.find((item) => item.record.id === id);
        if (issue) { if (!issue.reasons.includes(reason)) issue.reasons.push(reason); }
        else report.issues!.push({ record: task.records.find((r) => r.id === id)!, reasons: [reason] });
      }
    }
    function settle(task: Task, findings: Finding[] | null) {
      if (controller.signal.aborted) return;
      for (const unit of task.units) {
        if (processed.has(unit.id)) continue;
        const finding = findings?.find((f) => f.unitId === unit.id);
        if (!finding) addIssues(task, unit, "invalid_output");
        else if (finding.status === "inconclusive") addIssues(task, unit, "insufficient_evidence");
        else {
          const records = unit.recordIds.map((id) => task.records.find((r) => r.id === id)!);
          report.results.push({ ...finding, records, method: "ai", surface: lens === "review-similarity" ? new Set(records.map((r) => r.pageUrl)).size > 1 ? "Related records on different pages; patient identity is not established." : "Related records on the same page; patient identity is not established." : null });
        }
        processed.add(unit.id); report.processedUnitIds!.push(unit.id);
      }
      publish();
    }
    async function requestTask(task: Task) {
      const response = await fetch("/api/ai/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", signal: controller.signal, body: JSON.stringify({ task, provider, ...(connection.mode === "personal" ? { key: connection.key.trim() } : {}) }) });
      let data;
      try { data = await response.json(); } catch { if (response.ok) throw new InvalidModelOutput(); throw new Error("The analysis service returned an unreadable response. Resume when available."); }
      if (!data || typeof data !== "object" || Array.isArray(data)) { if (response.ok) throw new InvalidModelOutput(); throw new Error("The analysis service returned an unreadable response. Resume when available."); }
      if (!response.ok) {
        if (response.status === 422 && data.code === "invalid_model_output") throw new InvalidModelOutput();
        throw new Error(typeof data.error === "string" ? data.error : "The analysis service is unavailable. Resume when available.");
      }
      if (data.provider !== provider || data.model !== model) throw new Error("Provider or model mismatch. No findings from this batch were accepted.");
      try {
        const findings = validateOutput(task, { findings: data.findings });
        return findings;
      } catch { throw new InvalidModelOutput(); }
    }
    publish();
    try {
      if (plan.tasks.length && connection.mode === "personal" && !connection.key.trim()) throw new Error(`Add your ${PROVIDERS[provider].label} key in API setup, or select shared access.`);
      for (let i = report.completedTasks; i < plan.tasks.length; i++) {
        if (controller.signal.aborted) break;
        const original = plan.tasks[i];
        const units = original.units.filter((unit) => !processed.has(unit.id));
        const ids = new Set(units.flatMap((unit) => unit.recordIds));
        const task = { ...original, units, records: original.records.filter((r) => ids.has(r.id)) };
        if (units.length) try { settle(task, await requestTask(task)); }
        catch (error) {
          if (!(error instanceof InvalidModelOutput)) throw error;
          // Isolate a bad item instead of discarding its valid batch neighbours.
          // The server already attempted one repair; each isolated unit gets at
          // most one additional request, with no recursive/unbounded retry.
          if (units.length === 1) settle(task, null);
          else for (const unit of units) {
            if (controller.signal.aborted) break;
            const single = { ...task, units: [unit], records: task.records.filter((r) => unit.recordIds.includes(r.id)) };
            try { settle(single, await requestTask(single)); }
            catch (isolatedError) { if (!(isolatedError instanceof InvalidModelOutput)) throw isolatedError; settle(single, null); }
          }
        }
        if (controller.signal.aborted) break;
        report.completedTasks = i + 1; publish();
      }
      report.status = controller.signal.aborted ? "partial" : "complete";
      if (controller.signal.aborted) { report.stopReason = "cancelled"; report.error = "Analysis cancelled. Completed batches are preserved; resume to continue."; }
    } catch (error) { report.status = "partial"; report.stopReason = controller.signal.aborted ? "cancelled" : "error"; report.error = controller.signal.aborted ? "Analysis cancelled. Completed batches are preserved; resume to continue." : error instanceof Error ? error.message : "Analysis interrupted."; }
    finally { report.finishedAt = new Date().toISOString(); publish(); if (runRef.current === controller) { runRef.current = null; setActive(null); } }
  }
  return { reports, allReports, provider: connection.provider, active, run, reset, cancel: () => runRef.current?.abort() };
}
