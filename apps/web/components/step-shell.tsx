"use client";

import { useRouter } from "next/navigation";
import { useExperience } from "../app/experience-provider";
import type { Mode } from "../lib/analytics";
import { Icon } from "./icon";

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
  return <section className="missing-walkthrough" aria-labelledby="welcome-title">
    <div className="welcome-grid">
      <div className="welcome-story">
        <p className="eyebrow">WELCOME TO SIGNALTRACE</p>
        <h1 id="welcome-title">A customer taps.<br /><span>Does Product see it?</span></h1>
        <p className="welcome-intro">SignalTrace follows an action from a shopping app to the data behind product decisions. See what arrives, find what breaks, and prove the fix works.</p>
        <p className="welcome-role">You’re the PM for <strong>Nova</strong>, a fictional shopping app. Your team wants to understand what customers view and add to cart.</p>
        <div className="welcome-action">
          <button className="primary-cta" onClick={() => { reset(); router.push("/"); }}>Choose a scenario <Icon name="arrow" /></button>
          <span>Explore Data flowing or Data missing.</span>
        </div>
      </div>
      <aside className="walkthrough-preview" aria-labelledby="preview-title">
        <div className="preview-heading"><p className="eyebrow">THE WALKTHROUGH</p><span>3 steps</span></div>
        <h2 id="preview-title">Here’s what you’ll do.</h2>
        <ol className="welcome-steps">
          <li><span className="welcome-step-number" aria-hidden="true">01</span><div><h3>Shop like a customer</h3><p>Open Nova’s product and add it to your cart.</p></div></li>
          <li><span className="welcome-step-number" aria-hidden="true">02</span><div><h3>See what Product receives</h3><p>Check whether your actions reached the data your team relies on.</p></div></li>
          <li><span className="welcome-step-number" aria-hidden="true">03</span><div><h3>Follow the evidence</h3><p>If data is missing, diagnose the issue, apply a fix, and verify that fresh actions arrive.</p></div></li>
        </ol>
      </aside>
    </div>
    <p className="welcome-note"><Icon name="refresh" /><span><strong>Start a fresh walkthrough.</strong> There’s no active walkthrough on this page. Choose a scenario to create your own actions and results.</span></p>
  </section>;
}
