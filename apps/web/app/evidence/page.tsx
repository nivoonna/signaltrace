"use client";

import { useRouter } from "next/navigation";
import { useExperience } from "../experience-provider";
import { TechnicalEvidence } from "../../components/technical-evidence";
import { MissingWalkthrough, StepHeading } from "../../components/step-shell";
import { Icon } from "../../components/icon";
import { RecoveryPanel } from "../../components/recovery-panel";
import { summarizeValidation } from "../../lib/analytics";

export default function EvidencePage() {
  const router = useRouter();
  const { state, recovery, begin, reset } = useExperience();
  if (!state) return <MissingWalkthrough />;
  const recoveryConfirmed = recovery.validationRun && !recovery.busy && summarizeValidation(state).verified;

  return <div className="step-page evidence-page">
    <StepHeading step={3} title="Inspect what happened" instruction="Follow the evidence behind the Product outcome." mode={state.mode} />
    <TechnicalEvidence state={state} afterSummary={<RecoveryPanel />} />
    <div className="step-actions evidence-actions">
      <button className="secondary-cta" onClick={() => { reset(); router.push("/"); }}>Start over</button>
      <button className={state.mode === "healthy" || recoveryConfirmed ? "primary-cta" : "secondary-cta"} onClick={() => { begin(state.mode === "healthy" ? "issue" : "healthy"); router.push("/play"); }}>Try other scenario <Icon name="arrow" /></button>
    </div>
  </div>;
}
