import { isStored, summarize } from "../lib/analytics";
import type { Snapshot } from "../lib/analytics";
import { names, timeLabel } from "./event-labels";

export function TechnicalEvidence({ state }: { state: Snapshot }) {
  const { expected, health } = summarize(state);
  const explanation = health === "healthy"
    ? expected === 2
      ? "Both customer actions were captured, sent to the backend, and stored successfully."
      : `All ${expected} customer actions were captured, sent to the backend, and stored successfully.`
    : health === "waiting"
      ? "The product view was captured, sent to the backend, and stored successfully. Add the product to your cart to check the next action."
      : health === "unavailable"
        ? "Customer actions occurred, but we cannot currently confirm what is stored. The evidence below shows the last observed results."
        : health === "checking"
          ? "We are checking whether the customer actions reached storage. Delivery is not confirmed yet."
          : state.attempts.every((attempt) => !attempt.deliveryAttempted)
            ? "The customer actions occurred, but analytics never attempted delivery, so nothing reached the backend."
            : "Delivery was attempted, but not all customer actions have been verified in storage. Inspect the results below to see what happened.";
  return <section className="evidence" aria-label="Technical evidence">
    <div className="evidence-body">
      <div className="evidence-explanation"><h3>What happened</h3><p>{explanation}</p></div>
      <p>The analytics layer is simulated in this browser. Delivered events use the real FastAPI service and SQLite database. Switching modes creates a new session.</p>
      <div className="session-meta"><span>Session ID</span><code>{state.sessionId}</code></div>
      <div className="session-meta"><span>Storage read</span><code>GET /sessions/{state.sessionId}/events</code></div>
      <p className="observation">{state.readState === "error" ? state.readError : state.checkedAt ? `Last verified ${timeLabel(state.checkedAt)}. Refreshes every 3 seconds.` : "Waiting for the first storage read."}</p>
      {state.attempts.map((attempt) => <article className="event-evidence" key={attempt.payload.event_id}>
        <h3>{names[attempt.payload.event]} <span>{attempt.deliveryAttempted ? "Delivery attempted" : "Expected · not sent"}</span></h3>
        <dl>
          <div><dt>Event name</dt><dd><code>{attempt.payload.event}</code></dd></div>
          <div><dt>Event ID</dt><dd><code>{attempt.payload.event_id}</code></dd></div>
          <div><dt>Product ID</dt><dd><code>{attempt.payload.product_id}</code></dd></div>
          <div><dt>Event time</dt><dd><code>{attempt.payload.timestamp}</code></dd></div>
          <div><dt>Analytics state</dt><dd>{state.mode === "healthy" ? "Initialized" : "Not initialized"} <span className="muted">(simulated)</span></dd></div>
          <div><dt>Delivery attempted</dt><dd>{attempt.deliveryAttempted ? "Yes" : "No"}</dd></div>
          <div><dt>API request</dt><dd>{attempt.deliveryAttempted ? <><code>POST /events</code><span className="muted"> via web proxy /api/events</span></> : "None"}</dd></div>
          <div><dt>HTTP response</dt><dd>{attempt.httpStatus !== null ? <><code>{attempt.httpStatus}</code><pre>{attempt.responseBody}</pre></> : attempt.error ? `No response: ${attempt.error}` : attempt.pending ? "Waiting for response" : "None — no request was made"}</dd></div>
          <div><dt>Stored</dt><dd>{state.readState !== "ready" ? "Unknown — storage could not yet be verified" : isStored(attempt, state) ? "Yes — verified by reading SQLite" : "No"}</dd></div>
        </dl>
      </article>)}
    </div>
  </section>;
}

