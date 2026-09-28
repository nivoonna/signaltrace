import assert from "node:assert/strict";
import { test } from "node:test";
import { createExperience, summarize, summarizeValidation } from "./analytics.ts";
import { createRecovery, initialRecovery } from "./recovery.ts";
import { createStaticDemo } from "./static-demo.ts";

for (const mode of ["healthy", "issue"] as const) {
  test(`static ${mode}: deterministic actions and delivery without an API`, async () => {
    const runs = [];
    for (let run = 0; run < 2; run++) {
      const demo = createStaticDemo();
      const experience = createExperience(mode, () => {}, demo);
      await experience.start();
      await experience.addToCart();
      const state = experience.getSnapshot();
      assert.deepEqual(summarize(state), { expected: 2, received: mode === "healthy" ? 2 : 0, health: mode === "healthy" ? "healthy" : "issue" });
      assert.ok(state.attempts.every((attempt) => attempt.deliveryAttempted === (mode === "healthy")));
      runs.push(state);
    }
    assert.deepEqual(runs[0], runs[1]);
  });
}

test("static recovery reads evidence, requires a user fix, and verifies fresh stored events", async () => {
  const demo = createStaticDemo();
  const experience = createExperience("issue", () => {}, demo);
  let recoveryState = { ...initialRecovery };
  const recovery = createRecovery(experience, (state) => { recoveryState = state; }, demo.transport);
  await experience.start();
  await experience.addToCart();
  const original = structuredClone(experience.getSnapshot());
  await recovery.applyFix();
  assert.equal(experience.getSnapshot().analyticsInitialized, false);
  await recovery.diagnose();
  assert.deepEqual(experience.getSnapshot(), original);
  assert.deepEqual(recoveryState.diagnosis?.evidence, {
    analytics_initialized: false, customer_actions: 2, delivery_attempts: 0, events_received: 0,
  });
  assert.equal(recoveryState.diagnosis?.issue, "sdk_not_initialized");
  const session = original.sessionId;
  assert.equal(demo.get_sdk_state(session).initialized, false);
  assert.equal(demo.get_event_delivery(session).storage_source, "browser_memory_simulation");
  assert.equal(demo.get_runtime_logs(session).entries.length, 4);
  await recovery.applyFix();
  assert.equal(demo.get_sdk_state(session).initialized, true);
  assert.deepEqual(experience.getSnapshot().received, []);
  assert.equal(summarizeValidation(experience.getSnapshot()).verified, false);
  assert.equal(recoveryState.validationRun, false);
  await recovery.validate();
  const restored = experience.getSnapshot();
  assert.deepEqual(summarizeValidation(restored), { received: 2, verified: true });
  assert.ok(restored.validation?.eventIds.every((id) => !original.attempts.some(({ payload }) => payload.event_id === id)));
  assert.deepEqual(restored.attempts.slice(0, 2), original.attempts);
  assert.equal(recoveryState.diagnosis?.evidence.events_received, 0);
  assert.deepEqual(await (await demo.transport(`/api/sessions/${session}/events`)).json(), restored.received);
  // API-style acceptance alone remains insufficient, including in the demo.
  assert.equal(summarizeValidation({ ...restored, received: [] }).verified, false);
});

for (const boundary of ["no actions", "missing runtime evidence", "already initialized", "delivery attempted", "stored event"] as const) {
  test(`static diagnosis remains unconfirmed with ${boundary}`, async () => {
    const demo = createStaticDemo();
    const experience = createExperience("issue", () => {}, demo);
    await experience.start();
    const snapshot = experience.getSnapshot();
    const attempts = snapshot.attempts.map((attempt) => ({ payload: attempt.payload, initialized: false, delivery_attempted: boundary === "delivery attempted" }));
    if (boundary === "stored event") await demo.transport("/api/events", { method: "POST", body: JSON.stringify(attempts[0].payload) });
    const base = `/api/diagnostics/sessions/${snapshot.sessionId}`;
    await demo.transport(`${base}/evidence`, { method: "PUT", body: JSON.stringify({
      analytics_initialized: boundary === "already initialized",
      attempts: boundary === "no actions" ? [] : attempts,
      logs: boundary === "missing runtime evidence" || boundary === "no actions" ? [] : snapshot.logs,
    }) });
    assert.equal((await (await demo.transport(`${base}/diagnosis`)).json()).issue, null);
  });
}

test("static stores isolate walkthroughs, protect duplicates, and never forward unknown requests", async () => {
  const first = createStaticDemo(1);
  const second = createStaticDemo(2);
  const experience = createExperience("healthy", () => {}, first);
  await experience.start();
  const event = experience.getSnapshot().received[0];
  assert.equal((await first.transport("/api/events", { method: "POST", body: JSON.stringify({ ...event, product_id: "different" }) })).status, 409);
  assert.deepEqual(await (await first.transport(`/api/sessions/${event.session_id}/events`)).json(), [event]);
  assert.deepEqual(await (await second.transport(`/api/sessions/${event.session_id}/events`)).json(), []);
  assert.notEqual(second.id(), event.session_id);
  assert.equal((await first.transport("https://example.com/api/events")).status, 404);
});
