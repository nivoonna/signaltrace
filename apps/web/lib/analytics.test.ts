import assert from "node:assert/strict";
import { test } from "node:test";
import { createExperience, summarize, summarizeValidation } from "./analytics.ts";
import type { AnalyticsEvent, Mode, Snapshot } from "./analytics.ts";

// Transport is explicitly mocked here. Backend tests and the browser exercise
// verify actual HTTP/SQLite; these fixed inputs verify browser state decisions.
function fixture(mode: Mode = "healthy", override?: typeof fetch) {
  let sequence = 0;
  let snapshot: Snapshot | undefined;
  const rows: AnalyticsEvent[] = [];
  const calls: { url: string; method: string; payload?: AnalyticsEvent }[] = [];
  const transport: typeof fetch = async (url, init) => {
    const method = init?.method ?? "GET";
    const payload: AnalyticsEvent | undefined = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: String(url), method, payload });
    if (override) return override(url, init);
    if (payload) {
      rows.push(payload);
      return Response.json({ event_id: payload.event_id, status: "accepted" }, { status: 201 });
    }
    return Response.json(rows);
  };
  const controller = createExperience(mode, (value) => { snapshot = value; }, {
    transport, id: () => `fixed-${++sequence}`, now: () => "2026-09-28T12:34:56.000Z",
  });
  return {
    controller, calls, rows,
    get state() { assert.ok(snapshot); return snapshot; },
  };
}

test("healthy journey posts the exact contract and verifies both events by reading storage", async () => {
  const f = fixture();
  await f.controller.start();
  assert.equal(summarize(f.state).health, "waiting");
  await f.controller.addToCart();
  assert.deepEqual(summarize(f.state), { expected: 2, received: 2, health: "healthy" });
  assert.equal(f.state.cart, 1);
  assert.deepEqual(f.calls.map((call) => call.method), ["POST", "GET", "POST", "GET"]);
  assert.deepEqual(f.calls[2], { url: "/api/events", method: "POST", payload: {
    event_id: "fixed-3", event: "product_added_to_cart", session_id: "fixed-1",
    timestamp: "2026-09-28T12:34:56.000Z", product_id: "nova-mug",
  } });
  assert.equal(f.calls[3].url, "/api/sessions/fixed-1/events");
  assert.equal(f.state.attempts[1].httpStatus, 201);
  assert.equal(JSON.parse(f.state.attempts[1].responseBody!).event_id, "fixed-3");
});

test("uninitialized analytics leaves shopping working, records expectations, and never posts", async () => {
  const f = fixture("issue");
  await f.controller.start();
  await f.controller.addToCart();
  assert.equal(f.state.cart, 1);
  assert.deepEqual(summarize(f.state), { expected: 2, received: 0, health: "issue" });
  assert.ok(f.calls.every((call) => call.method === "GET"));
  assert.ok(f.state.attempts.every((attempt) => !attempt.deliveryAttempted && attempt.httpStatus === null && attempt.responseBody === null));
});

test("successful acknowledgments without stored events cannot make the dashboard healthy", async () => {
  const f = fixture("healthy", async (_, init) => init?.method === "POST"
    ? Response.json({ status: "accepted" }, { status: 201 }) : Response.json([]));
  await f.controller.start();
  await f.controller.addToCart();
  assert.deepEqual(summarize(f.state), { expected: 2, received: 0, health: "issue" });
});

for (const boundary of ["event_id", "event", "session_id", "timestamp", "product_id"] as const) {
  test(`stored events with a mismatched ${boundary} cannot verify delivery`, async () => {
    const f = fixture();
    await f.controller.start();
    await f.controller.addToCart();
    const mismatched = f.state.received.map((event) => ({ ...event, [boundary]: boundary === "timestamp" ? "2026-09-28T12:34:55Z" : "unrelated" }));
    assert.deepEqual(summarize({ ...f.state, received: mismatched as AnalyticsEvent[] }), { expected: 2, received: 0, health: "issue" });
  });
}

test("UTC offset serialization still matches the original timestamp", async () => {
  const f = fixture();
  await f.controller.start();
  await f.controller.addToCart();
  const received = f.state.received.map((event) => ({ ...event, timestamp: "2026-09-28T12:34:56+00:00" }));
  assert.equal(summarize({ ...f.state, received }).health, "healthy");
});

for (const failure of ["http", "network"] as const) {
  test(`${failure} delivery failure preserves cart and reports only the observed response`, async () => {
    const f = fixture("healthy", async (_, init) => {
      if (init?.method !== "POST") return Response.json([]);
      if (failure === "network") throw new Error("Connection refused");
      return Response.json({ detail: { code: "storage_unavailable" } }, { status: 503 });
    });
    await f.controller.start();
    await f.controller.addToCart();
    assert.equal(f.state.cart, 1);
    assert.equal(summarize(f.state).health, "issue");
    assert.equal(f.state.attempts[1].httpStatus, failure === "http" ? 503 : null);
    assert.equal(f.state.attempts[1].error, failure === "network" ? "Connection refused" : null);
  });
}

test("read failure makes delivery unconfirmed and a later successful read recovers", async () => {
  let failReads = false;
  const rows: AnalyticsEvent[] = [];
  const f = fixture("healthy", async (_, init) => {
    if (init?.method === "POST") {
      rows.push(JSON.parse(String(init.body)));
      return Response.json({ status: "accepted" }, { status: 201 });
    }
    return failReads ? new Response("Unavailable", { status: 503 }) : Response.json(rows);
  });
  await f.controller.start();
  await f.controller.addToCart();
  failReads = true;
  await f.controller.refresh();
  assert.equal(summarize(f.state).health, "unavailable");
  assert.equal(f.state.readError, "Session read returned HTTP 503.");
  assert.equal(f.state.received.length, 2); // Last known data remains explicitly stale.
  failReads = false;
  await f.controller.refresh();
  assert.equal(summarize(f.state).health, "healthy");
  assert.equal(f.state.readError, null);
});

test("unexpected read data is an error, never an empty success", async () => {
  const f = fixture("issue", async () => Response.json({ events: [] }));
  await f.controller.start();
  assert.equal(summarize(f.state).health, "unavailable");
});

test("repeated and concurrent actions keep distinct IDs and count every expectation", async () => {
  const f = fixture();
  await f.controller.start();
  await f.controller.start(); // Initialization is idempotent.
  await Promise.all([f.controller.addToCart(), f.controller.addToCart(), f.controller.addToCart()]);
  assert.equal(f.state.cart, 3);
  assert.deepEqual(summarize(f.state), { expected: 4, received: 4, health: "healthy" });
  assert.equal(new Set(f.state.attempts.map((attempt) => attempt.payload.event_id)).size, 4);
});

test("disposing a session prevents late responses from updating the next experience", async () => {
  let finishPost!: (response: Response) => void;
  const f = fixture("healthy", () => new Promise((resolve) => { finishPost = resolve; }));
  const pending = f.controller.start();
  const beforeDisposal = f.state;
  f.controller.dispose();
  finishPost(Response.json({ status: "accepted" }, { status: 201 }));
  await pending;
  await f.controller.addToCart();
  await f.controller.refresh();
  assert.equal(f.state, beforeDisposal);
  assert.equal(f.calls.length, 1);
});

test("an older read cannot overwrite newer stored evidence", async () => {
  const pendingReads: ((response: Response) => void)[] = [];
  const f = fixture("issue", () => new Promise((resolve) => pendingReads.push(resolve)));
  const initial = f.controller.start();
  const latest = f.controller.refresh();
  pendingReads[1](Response.json([]));
  await latest;
  const latestState = f.state;
  pendingReads[0](new Response("Unavailable", { status: 503 }));
  await initial;
  assert.equal(f.state.readState, "ready");
  assert.equal(f.state.checkedAt, latestState.checkedAt);
  assert.equal(f.state.readError, null);
});

test("a user fix preserves failed attempts; only a fresh stored validation restores delivery", async () => {
  const f = fixture("issue");
  await f.controller.start();
  await f.controller.addToCart();
  const original = structuredClone(f.state.attempts);
  assert.equal(f.state.analyticsInitialized, false);
  assert.equal(f.state.logs.filter((log) => log.code === "delivery_skipped_uninitialized").length, 2);
  await f.controller.runValidation();
  assert.equal(f.state.validation, null); // No validation before initialization.

  f.controller.initialize();
  f.controller.initialize(); // Idempotent; no replay and no success on fix alone.
  assert.equal(f.state.analyticsInitialized, true);
  assert.equal(f.state.logs.filter((log) => log.code === "analytics_initialized").length, 1);
  assert.equal(f.calls.filter((call) => call.method === "POST").length, 0);
  assert.equal(summarizeValidation(f.state).verified, false);

  await f.controller.runValidation();
  assert.deepEqual(f.state.attempts.slice(0, 2), original);
  assert.deepEqual(f.controller.getSnapshot().validation?.eventIds, ["fixed-4", "fixed-5"]);
  assert.equal(new Set(f.state.attempts.map((attempt) => attempt.payload.event_id)).size, 4);
  assert.equal(new Set(f.state.attempts.map((attempt) => attempt.payload.session_id)).size, 1);
  assert.deepEqual(f.rows.map((event) => event.event), ["product_viewed", "product_added_to_cart"]);
  assert.deepEqual(summarizeValidation(f.state), { received: 2, verified: true });
  assert.equal(f.state.cart, 2);
});

for (const storage of ["empty", "unavailable"] as const) {
  test(`validation stays unverified when POST succeeds but storage is ${storage}`, async () => {
    const f = fixture("issue", async (_, init) => init?.method === "POST"
      ? Response.json({ status: "accepted" }, { status: 201 })
      : storage === "empty" ? Response.json([]) : new Response("Unavailable", { status: 503 }));
    await f.controller.start();
    await f.controller.addToCart();
    f.controller.initialize();
    await f.controller.runValidation();
    assert.deepEqual(summarizeValidation(f.state), { received: storage === "empty" ? 0 : null, verified: false });
    assert.equal(f.state.attempts.filter((attempt) => attempt.httpStatus === 201).length, 2);
  });
}
