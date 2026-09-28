// The shopping and analytics lifecycle are a browser simulation. Transport and
// received events are real HTTP requests to FastAPI and reads from SQLite.
export type Mode = "healthy" | "issue";
export type EventName = "product_viewed" | "product_added_to_cart";
export type AnalyticsEvent = {
  event_id: string;
  event: EventName;
  session_id: string;
  timestamp: string;
  product_id: string;
};
export type Attempt = {
  payload: AnalyticsEvent;
  initialized: boolean;
  deliveryAttempted: boolean;
  pending: boolean;
  httpStatus: number | null;
  responseBody: string | null;
  error: string | null;
};
export type RuntimeLog = {
  timestamp: string;
  code: "customer_action" | "delivery_skipped_uninitialized" | "delivery_attempted" | "http_response" | "delivery_error" | "analytics_initialized";
  event_id: string | null;
  detail: string;
};
export type Snapshot = {
  sessionId: string;
  mode: Mode;
  cart: number;
  attempts: Attempt[];
  received: AnalyticsEvent[];
  readState: "checking" | "ready" | "error";
  readError: string | null;
  checkedAt: string | null;
  analyticsInitialized: boolean;
  logs: RuntimeLog[];
  validation: { eventIds: string[]; running: boolean } | null;
};

export function summarizeValidation(snapshot: Snapshot) {
  const run = snapshot.validation;
  const attempts = snapshot.attempts.filter((attempt) => run?.eventIds.includes(attempt.payload.event_id));
  const received = attempts.filter((attempt) => isStored(attempt, snapshot)).length;
  const complete = attempts.length === 2 && new Set(run?.eventIds).size === 2 &&
    attempts.some((attempt) => attempt.payload.event === "product_viewed") &&
    attempts.some((attempt) => attempt.payload.event === "product_added_to_cart");
  const verified = Boolean(complete && !run?.running && snapshot.analyticsInitialized &&
    attempts.every((attempt) => attempt.deliveryAttempted && !attempt.pending) &&
    snapshot.readState === "ready" && received === 2);
  return { received: snapshot.readState === "ready" ? received : null, verified };
}

export function isStored(attempt: Attempt, snapshot: Snapshot): boolean {
  return snapshot.received.some((event) =>
    event.event_id === attempt.payload.event_id &&
    event.session_id === attempt.payload.session_id &&
    event.event === attempt.payload.event &&
    event.product_id === attempt.payload.product_id &&
    Date.parse(event.timestamp) === Date.parse(attempt.payload.timestamp));
}

export function summarize(snapshot: Snapshot) {
  const received = snapshot.attempts.filter((attempt) => isStored(attempt, snapshot)).length;
  const pending = snapshot.attempts.some((attempt) => attempt.pending);
  const bothActions = (["product_viewed", "product_added_to_cart"] as const).every(
    (name) => snapshot.attempts.some((attempt) => attempt.payload.event === name));
  const health = snapshot.readState === "error" ? "unavailable"
    : snapshot.readState === "checking" || pending ? "checking"
    : received < snapshot.attempts.length ? "issue"
    : bothActions ? "healthy" : "waiting";
  return { expected: snapshot.attempts.length, received, health } as const;
}

type Dependencies = {
  transport?: typeof fetch;
  id?: () => string;
  now?: () => string;
};

export function createExperience(mode: Mode, notify: (state: Snapshot) => void, dependencies: Dependencies = {}) {
  const transport = dependencies.transport ?? fetch;
  const id = dependencies.id ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date().toISOString());
  let state: Snapshot = {
    sessionId: id(), mode, cart: 0, attempts: [], received: [],
    readState: "checking", readError: null, checkedAt: null,
    analyticsInitialized: mode === "healthy", logs: [], validation: null,
  };
  let disposed = false;
  let started = false;
  let readVersion = 0;
  const emit = () => { if (!disposed) notify(state); };
  const log = (code: RuntimeLog["code"], event_id: string | null, detail: string) => {
    state = { ...state, logs: [...state.logs, { timestamp: now(), code, event_id, detail }] };
  };
  const updateAttempt = (eventId: string, change: Partial<Attempt>) => {
    state = { ...state, attempts: state.attempts.map((attempt) =>
      attempt.payload.event_id === eventId ? { ...attempt, ...change } : attempt) };
    emit();
  };

  async function refresh() {
    if (disposed) return;
    const version = ++readVersion;
    try {
      const response = await transport(`/api/sessions/${encodeURIComponent(state.sessionId)}/events`, {
        cache: "no-store", signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`Session read returned HTTP ${response.status}.`);
      const received: unknown = await response.json();
      if (!Array.isArray(received) || !received.every((event) =>
        event && typeof event.event_id === "string" && event.session_id === state.sessionId &&
        ["product_viewed", "product_added_to_cart"].includes(event.event) &&
        typeof event.product_id === "string" && typeof event.timestamp === "string" &&
        Number.isFinite(Date.parse(event.timestamp)))) {
        throw new Error("Session read returned unexpected event data.");
      }
      if (disposed || version !== readVersion) return;
      state = { ...state, received, readState: "ready", readError: null, checkedAt: now() };
    } catch (error) {
      if (disposed || version !== readVersion) return;
      state = { ...state, readState: "error", readError: error instanceof Error ? error.message : "Session read failed." };
    }
    emit();
  }

  async function track(event: EventName, validation = false) {
    if (disposed) return;
    const payload: AnalyticsEvent = {
      event_id: id(), event, session_id: state.sessionId, timestamp: now(), product_id: "nova-mug",
    };
    const deliveryAttempted = state.analyticsInitialized;
    state = { ...state, attempts: [...state.attempts, {
      payload, initialized: state.analyticsInitialized, deliveryAttempted, pending: deliveryAttempted, httpStatus: null, responseBody: null, error: null,
    }] };
    if (validation && state.validation) state = { ...state, validation: { ...state.validation, eventIds: [...state.validation.eventIds, payload.event_id] } };
    log("customer_action", payload.event_id, event);
    log(deliveryAttempted ? "delivery_attempted" : "delivery_skipped_uninitialized", payload.event_id,
      deliveryAttempted ? "POST /events" : "Tracking stopped before HTTP delivery");
    emit();
    if (deliveryAttempted) {
      try {
        const response = await transport("/api/events", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
        });
        const responseBody = await response.text();
        log("http_response", payload.event_id, `HTTP ${response.status}`);
        updateAttempt(payload.event_id, { httpStatus: response.status, responseBody });
      } catch (error) {
        log("delivery_error", payload.event_id, error instanceof Error ? error.message : "No HTTP response");
        updateAttempt(payload.event_id, { error: error instanceof Error ? error.message : "No HTTP response received." });
      }
    }
    // A successful POST is not proof for this dashboard: always read storage.
    await refresh();
    updateAttempt(payload.event_id, { pending: false });
  }

  async function addToCart(validation = false) {
    if (disposed || !started) return;
    state = { ...state, cart: state.cart + 1 };
    emit();
    await track("product_added_to_cart", validation);
  }

  return {
    async start() {
      if (started || disposed) return;
      started = true;
      await track("product_viewed");
    },
    addToCart: () => addToCart(),
    initialize() {
      if (disposed || !started || state.analyticsInitialized) return;
      state = { ...state, analyticsInitialized: true };
      log("analytics_initialized", null, "User applied the initialization fix");
      emit();
    },
    async runValidation() {
      if (disposed || !started || !state.analyticsInitialized || state.validation?.running) return;
      state = { ...state, validation: { eventIds: [], running: true } };
      emit();
      // Same tracking/cart path, new IDs and timestamps; never replay failed events.
      await track("product_viewed", true);
      await addToCart(true);
      state = { ...state, validation: { ...state.validation!, running: false } };
      emit();
    },
    getSnapshot: () => state,
    refresh,
    dispose() { disposed = true; },
  };
}
