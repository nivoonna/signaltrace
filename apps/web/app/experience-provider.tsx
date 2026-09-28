"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createExperience } from "../lib/analytics";
import type { Mode, Snapshot } from "../lib/analytics";
import { createRecovery, initialRecovery } from "../lib/recovery";
import type { RecoveryState } from "../lib/recovery";
import { isStaticDemo } from "../lib/runtime-mode";
import { createStaticDemo } from "../lib/static-demo";

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
  recovery: RecoveryState;
  diagnose: () => void;
  applyFix: () => void;
  validate: () => void;
};

const ExperienceContext = createContext<Experience | null>(null);

// The shared layout survives client navigation. Intentionally keep this state in
// memory: SQLite cannot reconstruct the customer actions that were never sent.
// A full refresh starts with no walkthrough and the step pages offer a restart.
export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const [mode, selectScenario] = useState<Mode>("healthy");
  const [state, setState] = useState<Snapshot | null>(null);
  const [active, setActive] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryState>(initialRecovery);
  const current = useRef<ReturnType<typeof createExperience> | null>(null);
  const recoveryController = useRef<ReturnType<typeof createRecovery> | null>(null);
  const started = useRef(false);
  const walkthrough = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dispose = useCallback(() => {
    clearTimeout(timer.current);
    recoveryController.current?.dispose();
    recoveryController.current = null;
    current.current?.dispose();
    current.current = null;
    started.current = false;
  }, []);

  useEffect(() => dispose, [dispose]);

  const begin = useCallback((scenario: Mode) => {
    dispose();
    selectScenario(scenario);
    setState(null);
    const demo = isStaticDemo ? createStaticDemo(++walkthrough.current) : undefined;
    current.current = createExperience(scenario, setState, demo);
    setRecovery(initialRecovery);
    recoveryController.current = createRecovery(current.current, setRecovery, demo?.transport);
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
  const diagnose = useCallback(() => { void recoveryController.current?.diagnose(); }, []);
  const applyFix = useCallback(() => { void recoveryController.current?.applyFix(); }, []);
  const validate = useCallback(() => { void recoveryController.current?.validate(); }, []);
  const reset = useCallback(() => {
    dispose();
    setState(null);
    setActive(false);
    setRecovery(initialRecovery);
  }, [dispose]);

  return <ExperienceContext.Provider value={{ mode, state, active, selectScenario, begin, viewProduct, addToCart, refresh, reset, recovery, diagnose, applyFix, validate }}>
    {children}
  </ExperienceContext.Provider>;
}

export function useExperience() {
  const experience = useContext(ExperienceContext);
  if (!experience) throw new Error("Walkthrough pages require ExperienceProvider");
  return experience;
}
