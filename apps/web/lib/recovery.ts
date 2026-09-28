import type { createExperience } from "./analytics.ts";

export type Diagnosis = {
  issue: "sdk_not_initialized" | null;
  message: string;
  checks: string[];
  evidence: { analytics_initialized: boolean; customer_actions: number; delivery_attempts: number; events_received: number };
  expected_event_ids: string[];
  tools: Record<string, unknown>;
};
export type RecoveryState = {
  busy: "diagnosis" | "fix" | "validation" | null;
  diagnosis: Diagnosis | null;
  fixApplied: boolean;
  validationRun: boolean;
  error: string | null;
};
export const initialRecovery: RecoveryState = { busy: null, diagnosis: null, fixApplied: false, validationRun: false, error: null };

export function createRecovery(experience: ReturnType<typeof createExperience>, notify: (state: RecoveryState) => void, transport: typeof fetch = fetch) {
  let state = { ...initialRecovery };
  let disposed = false;
  const update = (change: Partial<RecoveryState>) => {
    if (disposed) return;
    state = { ...state, ...change };
    notify(state);
  };
  const base = `/api/diagnostics/sessions/${encodeURIComponent(experience.getSnapshot().sessionId)}`;
  async function request(path: string, init?: RequestInit) {
    const response = await transport(`${base}/${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Diagnostic evidence request returned HTTP ${response.status}. Please try again.`);
    return response;
  }
  async function upload() {
    const snapshot = experience.getSnapshot();
    await request("evidence", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analytics_initialized: snapshot.analyticsInitialized,
        attempts: snapshot.attempts.map((attempt) => ({ payload: attempt.payload, initialized: attempt.initialized, delivery_attempted: attempt.deliveryAttempted })),
        logs: snapshot.logs,
      }),
    });
  }
  const message = (error: unknown) => error instanceof Error ? error.message : "Unable to read diagnostic evidence. Please try again.";

  return {
    async diagnose() {
      if (disposed || state.busy || state.fixApplied) return;
      update({ busy: "diagnosis", diagnosis: null, error: null });
      try {
        await upload();
        if (disposed) return;
        const diagnosis: Diagnosis = await (await request("diagnosis")).json();
        update({ diagnosis });
      } catch (error) { update({ error: message(error) }); }
      finally { update({ busy: null }); }
    },
    async applyFix() {
      if (disposed || state.busy || state.fixApplied || state.diagnosis?.issue !== "sdk_not_initialized") return;
      const ids = experience.getSnapshot().attempts.map((attempt) => attempt.payload.event_id).sort();
      if (JSON.stringify(ids) !== JSON.stringify(state.diagnosis.expected_event_ids)) {
        update({ diagnosis: null, error: "Customer activity changed. Diagnose again using the latest evidence." });
        return;
      }
      update({ busy: "fix", error: null });
      // Explicit user command; the read-only investigation cannot invoke this.
      experience.initialize();
      update({ fixApplied: true });
      try { await upload(); }
      catch { update({ error: "The fix was applied locally, but its evidence could not be synchronized. Run validation to retry." }); }
      finally { update({ busy: null }); }
    },
    async validate() {
      if (disposed || state.busy || !state.fixApplied) return;
      update({ busy: "validation", error: null, validationRun: false });
      try {
        await experience.runValidation();
        if (disposed) return;
        update({ validationRun: true });
        await upload();
      } catch (error) { update({ error: message(error) }); }
      finally { update({ busy: null }); }
    },
    dispose() { disposed = true; },
  };
}
