import { isStored, summarize } from "../lib/analytics";
import type { Snapshot } from "../lib/analytics";
import { Icon } from "./icon";
import { names, timeLabel } from "./event-labels";

export function AnalyticsPanel({ state, onRefresh }: { state: Snapshot | null; onRefresh: () => void }) {
  const totals = state ? summarize(state) : null;
  const health = totals?.health ?? "checking";
  const messages = {
    healthy: ["Product has the data it needs", "The customer actions recorded in Nova successfully reached analytics."],
    issue: ["Product is missing data", "Customers can still shop normally, but their actions are not reaching analytics."],
    checking: ["Checking what Product received", "Comparing the actions in Nova with the data that has actually arrived."],
    waiting: ["The product view reached analytics", "You've viewed the product. Now add it to your cart to see whether that action arrives too."],
    unavailable: ["Unable to verify delivery", "Shopping still works. We cannot check analytics right now, so delivery is unconfirmed."],
  } as const;
  return <section className="analytics-panel" aria-label="Nova Analytics">
    <div className="panel-label"><span>NOVA ANALYTICS</span><span className={`connection ${state?.readState === "error" ? "offline" : ""}`}><i />{state?.readState === "error" ? "Connection issue" : "Live session"}</span></div>
    <p className="panel-subtitle">Actions from your Nova visit.</p>
    <div className="counts" aria-label="Customer actions and analytics">
      <div><span>Customer actions</span><strong>{totals?.expected ?? "—"}</strong><small>{totals ? `${totals.expected} happened in the app` : "Waiting for the app"}</small></div>
      <div><span>Reached analytics</span><strong className={health === "issue" ? "amber-text" : "green-text"}>{state?.readState === "ready" ? <>{totals?.received}<span className="count-total"> of {totals?.expected}</span></> : "—"}</strong><small>{state?.readState === "error" ? "Currently unconfirmed" : "Available to the Product team"}</small></div>
    </div>
    <div className="event-statuses" aria-label="Expected behaviors">
      {(["product_viewed", "product_added_to_cart"] as const).map((name) => {
        const expected = state?.attempts.filter((attempt) => attempt.payload.event === name) ?? [];
        const received = state ? expected.filter((attempt) => isStored(attempt, state)).length : 0;
        const label = !expected.length ? "Awaiting action" : state?.readState === "error" ? "Unconfirmed" : state?.readState !== "ready" || expected.some((attempt) => attempt.pending) ? "Checking" : received === expected.length ? "Received" : "Missing";
        return <div className="event-status" key={name}><span className="event-symbol"><Icon name={name === "product_viewed" ? "eye" : "bag"} /></span><span className="event-name">{names[name]}<small>{name === "product_viewed" ? "A customer opens the product" : "A customer adds it to their cart"}</small></span><span className={`badge ${label.toLowerCase().replace(" ", "-")}`}>{label === "Received" && <Icon name="check" />}{label === "Missing" && <Icon name="alert" />}{label}</span></div>;
      })}
    </div>
    <div className={`health ${health}`} role="status" aria-live="polite">
      <span className="health-icon"><Icon name={health === "healthy" || health === "waiting" ? "check" : health === "issue" || health === "unavailable" ? "alert" : "refresh"} /></span>
      <div><p className="eyebrow">WHAT THIS MEANS FOR PRODUCT</p><h3>{messages[health][0]}</h3><p>{messages[health][1]}</p>{health === "unavailable" && <button className="text-button" onClick={onRefresh}>Try again <Icon name="refresh" /></button>}</div>
    </div>
    <div className="activity-heading"><h3>Latest activity</h3><span>Received this session</span></div>
    {!state?.received.length ? <div className="empty-activity"><span className="activity-dot" /><p>{state?.readState === "error" ? "Activity is temporarily unavailable." : "No customer actions have reached analytics yet."}<small>{health === "issue" ? "Product cannot see what customers are doing in Nova." : "Received shopping activity will appear here."}</small></p></div>
      : <ol className="activity-list">{[...state.received].reverse().slice(0, 3).map((event) => <li key={event.event_id}><span className="activity-dot arrived" /><span>{names[event.event]}<small>The Everyday Mug</small></span><time dateTime={event.timestamp}>{timeLabel(event.timestamp)}</time></li>)}</ol>}
    {state?.readState === "error" && state.received.length > 0 && <p className="stale-note">Showing the last confirmed activity. Current delivery is unconfirmed.</p>}
  </section>;
}

