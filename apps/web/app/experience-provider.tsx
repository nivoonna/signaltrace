"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createExperience } from "../lib/analytics";
import type { Mode, Snapshot } from "../lib/analytics";

type Experience = {
  mode: Mode;
  state: Snapshot | null;
  active: boolean;
  selectScenario: (mode: Mode) => void;
  begin: (mode: Mode) => void;
  viewProduct: () => void;
  addToCart: () => void;
  refresh: () => void;
  reset: () => void;
};

const ExperienceContext = createContext<Experience | null>(null);

// The shared layout survives client navigation. Intentionally keep this state in
// memory: SQLite cannot reconstruct the customer actions that were never sent.
// A full refresh starts with no walkthrough and the step pages offer a restart.
export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const [mode, selectScenario] = useState<Mode>("healthy");
  const [state, setState] = useState<Snapshot | null>(null);
  const [active, setActive] = useState(false);
  const current = useRef<ReturnType<typeof createExperience> | null>(null);
  const started = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dispose = useCallback(() => {
    clearTimeout(timer.current);
    current.current?.dispose();
    current.current = null;
    started.current = false;
  }, []);

  useEffect(() => dispose, [dispose]);

  const begin = useCallback((scenario: Mode) => {
    dispose();
    selectScenario(scenario);
    setState(null);
    current.current = createExperience(scenario, setState);
    setActive(true);
  }, [dispose]);

  const viewProduct = useCallback(() => {
    const controller = current.current;
    if (!controller || started.current) return;
    started.current = true;
    async function poll() {
      await controller!.refresh();
      if (current.current === controller) timer.current = setTimeout(poll, 3000);
    }
    void controller.start().then(() => {
      if (current.current === controller) timer.current = setTimeout(poll, 3000);
    });
  }, []);

  const addToCart = useCallback(() => { void current.current?.addToCart(); }, []);
  const refresh = useCallback(() => { void current.current?.refresh(); }, []);
  const reset = useCallback(() => {
    dispose();
    setState(null);
    setActive(false);
  }, [dispose]);

  return <ExperienceContext.Provider value={{ mode, state, active, selectScenario, begin, viewProduct, addToCart, refresh, reset }}>
    {children}
  </ExperienceContext.Provider>;
}

export function useExperience() {
  const experience = useContext(ExperienceContext);
  if (!experience) throw new Error("Walkthrough pages require ExperienceProvider");
  return experience;
}
