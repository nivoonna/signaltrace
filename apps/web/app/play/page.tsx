"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useExperience } from "../experience-provider";
import { NovaApp } from "../../components/nova-app";
import { MissingWalkthrough, StepHeading } from "../../components/step-shell";
import { Icon } from "../../components/icon";

export default function PlayPage() {
  const router = useRouter();
  const { state, active, mode, viewProduct, addToCart } = useExperience();
  useEffect(() => { viewProduct(); }, [viewProduct]);

  if (!active) return <MissingWalkthrough />;

  return <div className="step-page play-page">
    <StepHeading step={1} title="Use the app" instruction="The product is open. Add the mug to your cart, just like a shopper would." mode={state?.mode ?? mode} />
    {state ? <NovaApp state={state} onAdd={addToCart} /> : <p role="status">Opening Nova…</p>}
    <div className="step-actions"><button className="primary-cta" disabled={!state?.cart} onClick={() => router.push("/results")}>See what Product receives <Icon name="arrow" /></button></div>
  </div>;
}
