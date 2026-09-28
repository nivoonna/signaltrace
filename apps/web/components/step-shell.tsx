"use client";

import { useRouter } from "next/navigation";
import { useExperience } from "../app/experience-provider";
import type { Mode } from "../lib/analytics";

export function StepHeading({ step, title, instruction, mode }: { step: number; title: string; instruction: string; mode: Mode }) {
  return <header className="step-heading">
    <div className="step-meta"><p className="eyebrow">Step {step} of 3</p><span className={`scenario-tag ${mode}`}><span className={`mode-dot ${mode}-dot`} />{mode === "healthy" ? "Data flowing" : "Data missing"}</span></div>
    <h1>{title}</h1>
    <p>{instruction}</p>
  </header>;
}

export function MissingWalkthrough() {
  const router = useRouter();
  const { reset } = useExperience();
  return <section className="missing-walkthrough">
    <p className="eyebrow">A FRESH START</p>
    <h1>Start a walkthrough first</h1>
    <p>This page needs the actions from your Nova visit. Refreshing a page clears the walkthrough in this local demo.</p>
    <p>Choose a scenario and use the app again to see reliable results.</p>
    <button className="primary-cta" onClick={() => { reset(); router.push("/"); }}>Start over</button>
  </section>;
}
