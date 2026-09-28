"use client";

import { useExperience } from "../app/experience-provider";
import { summarizeValidation } from "../lib/analytics";
import { isStaticDemo } from "../lib/runtime-mode";

const checks = [
  ["get_sdk_state", "Checking implementation state"],
  ["get_event_delivery", "Checking event delivery"],
  ["get_runtime_logs", "Reviewing runtime evidence"],
] as const;

export function RecoveryPanel() {
  const { state, recovery, diagnose, applyFix, validate } = useExperience();
  if (!state || state.mode !== "issue") return null;
  const { diagnosis, busy, fixApplied, validationRun, error } = recovery;
  const validation = summarizeValidation(state);
  const restored = validationRun && !busy && validation.verified;

  return <section className="recovery-panel" aria-label="Diagnosis and recovery">
    {!diagnosis && <button className="primary-cta" disabled={Boolean(busy)} onClick={diagnose}>{busy === "diagnosis" ? "Investigating…" : "Diagnose the issue"}</button>}
    {!fixApplied && (busy === "diagnosis" || diagnosis) && <ul className="investigation-checks" aria-label="Investigation checks">
      {checks.map(([tool, label]) => <li key={tool}>{label} <span>{diagnosis?.checks.includes(tool) ? "✓" : "…"}</span></li>)}
    </ul>}
    {diagnosis && <>
      {!fixApplied && <>
        <div className="diagnosis-result" role="status"><h3>{diagnosis.issue ? "Issue found" : "Diagnosis unconfirmed"}</h3><p>{diagnosis.message}</p></div>
        <h4>Evidence</h4>
        <ul className="diagnosis-facts">
          <li>Analytics initialized: <strong>{diagnosis.evidence.analytics_initialized ? "Yes" : "No"}</strong></li>
          <li>Customer actions: <strong>{diagnosis.evidence.customer_actions}</strong></li>
          <li>Delivery attempts: <strong>{diagnosis.evidence.delivery_attempts}</strong></li>
          <li>Events received: <strong>{diagnosis.evidence.events_received}</strong></li>
        </ul>
        <button className="primary-cta" disabled={Boolean(busy)} onClick={diagnosis.issue ? applyFix : diagnose}>{diagnosis.issue ? "Apply fix" : "Check again"}</button>
      </>}
      {fixApplied && !restored && <div className="validation-prompt" role="status">
        <h3>{busy === "validation" ? "Validating fresh delivery…" : validationRun ? "Recovery not yet verified" : "Fix applied"}</h3>
        <p>{busy === "validation"
          ? "Generating a new product view and cart action, then checking that both reached storage."
          : validationRun
            ? `After validation: ${validation.received ?? "Unconfirmed"}${validation.received === null ? "" : " of 2"}. Both fresh actions must be verified in storage.`
            : "The analytics integration is now initialized, but we still need to prove that new customer actions reach Product."}</p>
        <button className="primary-cta" disabled={Boolean(busy)} onClick={validate}>{busy === "validation" ? "Validating…" : validationRun ? "Run validation again" : "Run validation"}</button>
      </div>}
      {restored && <div className="restored-outcome" role="status">
        <h3>Implementation restored</h3>
        <strong>2 of 2 fresh customer actions reached analytics.</strong>
        <dl className="recovery-comparison">
          <div><dt>Before fix</dt><dd>{diagnosis.evidence.events_received} of {diagnosis.evidence.customer_actions} reached analytics</dd></div>
          <div className="recovery-after"><dt>After validation</dt><dd>{validation.received} of 2 reached analytics</dd></div>
        </dl>
        <p>Nova’s Product team is receiving the behavioral data it needs again.</p>
      </div>}
      <details className="tool-evidence"><summary>Diagnostic tool results</summary><p>{isStaticDemo
        ? "Simulated read-only investigation. Tools inspect this walkthrough’s browser state, runtime records, and simulated event store. No backend or AI service is called."
        : "Read-only investigation snapshot. SDK state and runtime records come from this browser simulation; delivery is checked independently in SQLite."}</p><pre>{JSON.stringify(diagnosis.tools, null, 2)}</pre></details>
    </>}
    {error && <p role="alert" className="recovery-error">{error}</p>}
    <p className="recovery-principle">A fix earns trust when fresh customer actions reach Product again.</p>
  </section>;
}
