"use client";

import { useRouter } from "next/navigation";
import { useExperience } from "./experience-provider";
import { Icon } from "../components/icon";

export default function LandingPage() {
  const router = useRouter();
  const { mode, selectScenario, begin } = useExperience();

  return <section className="landing" aria-labelledby="page-title">
    <p className="eyebrow">FROM CUSTOMER ACTION TO PRODUCT INSIGHT</p>
    <h1 id="page-title">Can you trust the data behind your product decisions?</h1>
    <p className="intro-copy">You’re the PM for Nova’s shopping app. Your team wants to understand what customers view and add to cart. Try the app, then see whether those customer actions actually make it into analytics.</p>
    <fieldset className="scenario-choice"><legend>Choose a scenario</legend>
      <div className="mode-controls">
        <button className={mode === "healthy" ? "selected" : ""} aria-label="Data flowing" aria-describedby="healthy-description" aria-pressed={mode === "healthy"} onClick={() => selectScenario("healthy")}><span className="mode-dot healthy-dot" /><span>Data flowing<small id="healthy-description">Everything is working correctly</small></span></button>
        <button className={mode === "issue" ? "selected" : ""} aria-label="Data missing" aria-describedby="issue-description" aria-pressed={mode === "issue"} onClick={() => selectScenario("issue")}><span className="mode-dot issue-dot" /><span>Data missing<small id="issue-description">The app still works, but Product is losing analytics</small></span></button>
      </div>
    </fieldset>
    <button className="primary-cta" onClick={() => { begin(mode); router.push("/play"); }}>Start walkthrough <Icon name="arrow" /></button>
  </section>;
}
