import type { AnalyticsEvent, RuntimeLog } from "./analytics.ts";
import type { Diagnosis } from "./recovery.ts";

type Observation = {
  analytics_initialized: boolean;
  attempts: { payload: AnalyticsEvent; initialized: boolean; delivery_attempted: boolean }[];
  logs: RuntimeLog[];
};

// In-process delivery model for the public export only. Never calls fetch and
// never falls back to a server. Each walkthrough owns its own ephemeral store.
// This models controller-generated events; FastAPI remains the event validator.
export function createStaticDemo(walkthrough = 1) {
  const rows = new Map<string, AnalyticsEvent>();
  const observations = new Map<string, Observation>();
  let sequence = 0;
  let ticks = 0;
  const id = () => `demo-${walkthrough}-${++sequence}`;
  const now = () => new Date(Date.UTC(2026, 0, 1, 12) + ticks++ * 1000).toISOString();
  const stored = (session: string) => [...rows.values()].filter((event) => event.session_id === session);
  const observation = (session: string) => {
    const value = observations.get(session);
    if (!value) throw new Error("No browser evidence is available for this session");
    return structuredClone(value);
  };
  const get_sdk_state = (session: string) => ({
    session_id: session, initialized: observation(session).analytics_initialized, source: "browser_demo",
  });
  const get_event_delivery = (session: string) => {
    const evidence = observation(session);
    const events = stored(session);
    const matched = evidence.attempts.filter(({ payload }) => events.some((event) =>
      event.event_id === payload.event_id && event.session_id === payload.session_id &&
      event.event === payload.event && event.product_id === payload.product_id &&
      Date.parse(event.timestamp) === Date.parse(payload.timestamp)));
    return {
      session_id: session, customer_actions: evidence.attempts.length,
      delivery_attempts: evidence.attempts.filter((attempt) => attempt.delivery_attempted).length,
      events_received: matched.length, stored_event_ids: matched.map(({ payload }) => payload.event_id),
      session_events_received: events.length, attempts: evidence.attempts, storage_source: "browser_memory_simulation",
    };
  };
  const get_runtime_logs = (session: string) => ({
    session_id: session, source: "browser_demo", entries: observation(session).logs,
  });
  const diagnose = (session: string): Diagnosis => {
    const sdk = get_sdk_state(session);
    const delivery = get_event_delivery(session);
    const logs = get_runtime_logs(session);
    const expected = delivery.attempts.map(({ payload }) => payload.event_id);
    const actions = new Set(logs.entries.filter((log) => log.code === "customer_action").map((log) => log.event_id));
    const dropped = new Set(logs.entries.filter((log) => log.code === "delivery_skipped_uninitialized").map((log) => log.event_id));
    // Mirrors the single incident's backend evidence rule, not a canned result.
    const found = sdk.initialized === false && expected.length > 0 &&
      delivery.attempts.every((attempt) => !attempt.initialized) &&
      delivery.delivery_attempts === 0 && delivery.session_events_received === 0 &&
      expected.every((eventId) => actions.has(eventId) && dropped.has(eventId));
    return {
      issue: found ? "sdk_not_initialized" : null,
      message: found
        ? "Nova’s analytics integration was not initialized. Customer actions occurred normally, but analytics never attempted to send those events."
        : "The available evidence does not confirm the missing-initialization incident.",
      checks: ["get_sdk_state", "get_event_delivery", "get_runtime_logs"],
      evidence: { analytics_initialized: sdk.initialized, customer_actions: delivery.customer_actions,
        delivery_attempts: delivery.delivery_attempts, events_received: delivery.events_received },
      expected_event_ids: expected.sort(),
      tools: { sdk_state: sdk, event_delivery: delivery, runtime_logs: logs },
    };
  };

  // Response objects preserve the existing controller interface. They are
  // simulated responses, never HTTP requests or independently durable storage.
  const transport: typeof fetch = async (input, init) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path === "/api/events" && method === "POST") {
      const event: AnalyticsEvent = JSON.parse(String(init?.body));
      if (rows.has(event.event_id)) return Response.json({ detail: { code: "duplicate_event_id" } }, { status: 409 });
      rows.set(event.event_id, structuredClone(event));
      return Response.json({ event_id: event.event_id, status: "accepted" }, { status: 201 });
    }
    const read = path.match(/^\/api\/sessions\/([^/]+)\/events$/);
    if (read && method === "GET") return Response.json(stored(decodeURIComponent(read[1])));
    const diagnostic = path.match(/^\/api\/diagnostics\/sessions\/([^/]+)\/(evidence|sdk-state|event-delivery|runtime-logs|diagnosis)$/);
    if (diagnostic) {
      const session = decodeURIComponent(diagnostic[1]);
      const action = diagnostic[2];
      if (action === "evidence" && method === "PUT") {
        const evidence: Observation = JSON.parse(String(init?.body));
        if (evidence.attempts.some(({ payload }) => payload.session_id !== session)) {
          return Response.json({ detail: "Events must belong to this session" }, { status: 422 });
        }
        observations.set(session, structuredClone(evidence));
        return new Response(null, { status: 204 });
      }
      if (method === "GET" && observations.has(session)) {
        if (action === "sdk-state") return Response.json(get_sdk_state(session));
        if (action === "event-delivery") return Response.json(get_event_delivery(session));
        if (action === "runtime-logs") return Response.json(get_runtime_logs(session));
        if (action === "diagnosis") return Response.json(diagnose(session));
      }
    }
    return Response.json({ detail: "Unknown browser simulation operation" }, { status: 404 });
  };
  return { transport, id, now, get_sdk_state, get_event_delivery, get_runtime_logs };
}
