"use client";

import { useRouter } from "next/navigation";
import { useExperience } from "../experience-provider";
import { AnalyticsPanel } from "../../components/analytics-panel";
import { MissingWalkthrough, StepHeading } from "../../components/step-shell";
import { Icon } from "../../components/icon";

export default function ResultsPage() {
  const router = useRouter();
  const { state, refresh } = useExperience();
  if (!state) return <MissingWalkthrough />;

  return <div className="step-page results-page">
    <StepHeading step={2} title="See what Product receives" instruction="Compare what happened in Nova with what actually reached analytics." mode={state.mode} />
    <p className="customer-summary"><strong>Your visit</strong> Viewed The Everyday Mug · {state.cart} {state.cart === 1 ? "item" : "items"} added to cart</p>
    <AnalyticsPanel state={state} onRefresh={refresh} />
    <p className="product-meaning">Product uses these actions to understand which items attract interest and lead to carts. Missing actions leave gaps in those decisions.</p>
    <div className="step-actions"><button className="primary-cta" onClick={() => router.push("/evidence")}>Inspect what happened <Icon name="arrow" /></button></div>
  </div>;
}
