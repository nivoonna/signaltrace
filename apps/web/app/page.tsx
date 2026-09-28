"use client";

import { useEffect, useRef, useState } from "react";
import { createExperience, isStored, summarize } from "../lib/analytics";
import type { EventName, Mode, Snapshot } from "../lib/analytics";

type IconName = "trace" | "bag" | "arrow" | "check" | "alert" | "refresh" | "eye" | "chevron";
function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    trace: <path d="M2 14h5l3-9 4 15 3-10h5" />,
    bag: <><path d="M5 7h14l1 14H4L5 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
    arrow: <path d="M4 12h15m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
    alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 3v.1" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6 7a7 7 0 0 1 12-2l2 3M4 16l2 3a7 7 0 0 0 12-2" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    chevron: <path d="m8 5 7 7-7 7" />,
  };
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function ProductVisual() {
  return <svg className="product-visual" viewBox="0 0 320 265" role="img" aria-label="Original illustration of a moss green ceramic mug on a cream pedestal">
    <defs>
      <linearGradient id="ceramic" x1="0" x2="1"><stop stopColor="#608275" /><stop offset=".35" stopColor="#78988a" /><stop offset=".8" stopColor="#5e7e70" /><stop offset="1" stopColor="#496c5c" /></linearGradient>
      <linearGradient id="plinth" x1="0" x2="0" y2="1"><stop stopColor="#dedbd0" /><stop offset="1" stopColor="#e9e6db" /></linearGradient>
      <pattern id="speckle" width="21" height="19" patternUnits="userSpaceOnUse"><circle cx="4" cy="6" r=".7" fill="#2e5044" opacity=".28" /><circle cx="16" cy="15" r=".5" fill="#d5e0d2" opacity=".45" /></pattern>
    </defs>
    <path d="M0 214 320 195v70H0Z" fill="#e1dfd5" />
    <path d="m45 215 116-27 122 29-116 33Z" fill="#f3f0e5" />
    <path d="m45 215 122 35v15H45Z" fill="url(#plinth)" /><path d="m167 250 116-33v48H167Z" fill="#d6d3c7" />
    <ellipse cx="172" cy="208" rx="83" ry="14" fill="#b6b7a7" opacity=".36" />
    <path d="M207 112c54-14 64 63 16 68l-15-2v-17l11 2c25-2 23-38-8-32Z" fill="#4e7060" />
    <path d="M209 110c53-10 62 60 16 64" fill="none" stroke="#7f9b8c" strokeWidth="6" />
    <path d="m97 101 8 88c3 33 102 33 107 0l8-88Z" fill="url(#ceramic)" />
    <path d="m97 101 8 88c3 33 102 33 107 0l8-88Z" fill="url(#speckle)" />
    <ellipse cx="158.5" cy="101" rx="61.5" ry="22" fill="#93a99a" /><ellipse cx="158.5" cy="101" rx="54.5" ry="16" fill="#375849" />
    <path d="M110 103c17-15 80-16 98 0-20 15-78 14-98 0Z" fill="#496a57" />
    <path d="m109 123 5 57" stroke="#bacaba" strokeWidth="3" opacity=".3" strokeLinecap="round" />
  </svg>;
}

const names: Record<EventName, string> = { product_viewed: "Product viewed", product_added_to_cart: "Added to cart" };
function timeLabel(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function Evidence({ state }: { state: Snapshot }) {
  return <details className="evidence">
    <summary><span><span className="code-mark" aria-hidden="true">&lt;/&gt;</span> View technical evidence</span><span className="evidence-hint">Follow each event <Icon name="chevron" /></span></summary>
    <div className="evidence-body">
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
  </details>;
}

function Dashboard({ state, onRefresh }: { state: Snapshot | null; onRefresh: () => void }) {
  const totals = state ? summarize(state) : null;
  const health = totals?.health ?? "checking";
  const messages = {
    healthy: ["Implementation healthy", "Nova's Product team is receiving the behavioral data it needs to understand the shopping journey."],
    issue: ["Implementation issue", "Customers can still use Nova normally, but Product is not receiving the behavioral data it expects."],
    checking: ["Checking event delivery", "Comparing the shopping activity with the events that have actually arrived."],
    waiting: ["Product view received", "Add the mug to your cart to check the next step in the shopping journey."],
    unavailable: ["Unable to verify delivery", "Shopping still works. We cannot reach the event store right now, so delivery is unconfirmed."],
  } as const;
  return <section className="analytics-panel" aria-labelledby="analytics-title">
    <div className="panel-label"><span><span className="step">02</span> THE PRODUCT TEAM'S VIEW</span><span className={`connection ${state?.readState === "error" ? "offline" : ""}`}><i />{state?.readState === "error" ? "Connection issue" : "Live session"}</span></div>
    <h2 id="analytics-title">Nova Analytics<span className="small-trace"><Icon name="trace" /></span></h2>
    <p className="panel-subtitle">Is the shopping journey showing up?</p>
    <div className="counts" aria-label="Event counts">
      <div><span>Expected events</span><strong>{totals?.expected ?? "—"}</strong><small>From actions in the app</small></div>
      <div><span>Received events</span><strong className={health === "issue" ? "amber-text" : "green-text"}>{state?.readState === "ready" ? totals?.received : "—"}</strong><small>{state?.readState === "error" ? "Currently unconfirmed" : "Verified in event storage"}</small></div>
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
      <div><p className="eyebrow">IMPLEMENTATION HEALTH</p><h3>{messages[health][0]}</h3><p>{messages[health][1]}</p>{health === "unavailable" && <button className="text-button" onClick={onRefresh}>Try again <Icon name="refresh" /></button>}</div>
    </div>
    <div className="activity-heading"><h3>Latest activity</h3><span>Received this session</span></div>
    {!state?.received.length ? <div className="empty-activity"><span className="activity-dot" /><p>{state?.readState === "error" ? "Activity is temporarily unavailable." : "No events received yet."}<small>{health === "issue" ? "The app is active, but its analytics are silent." : "Received shopping activity will appear here."}</small></p></div>
      : <ol className="activity-list">{[...state.received].reverse().slice(0, 3).map((event) => <li key={event.event_id}><span className="activity-dot arrived" /><span>{names[event.event]}<small>The Everyday Mug</small></span><time dateTime={event.timestamp}>{timeLabel(event.timestamp)}</time></li>)}</ol>}
    {state?.readState === "error" && state.received.length > 0 && <p className="stale-note">Showing the last confirmed activity. Current delivery is unconfirmed.</p>}
  </section>;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("healthy");
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<Snapshot | null>(null);
  const experience = useRef<ReturnType<typeof createExperience> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let current: ReturnType<typeof createExperience> | null = null;
    let polling: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      await current?.refresh();
      if (!cancelled) polling = setTimeout(poll, 3000);
    }
    // Deferring startup prevents React's development effect replay from sending
    // a second product view. Disposal also fences late responses from old sessions.
    queueMicrotask(() => {
      if (cancelled) return;
      current = createExperience(mode, setState);
      experience.current = current;
      void current.start().then(() => {
        if (!cancelled) polling = setTimeout(poll, 3000);
      });
    });
    return () => {
      cancelled = true;
      current?.dispose();
      experience.current = null;
      clearTimeout(polling);
    };
  }, [mode, generation]);

  function startFresh(nextMode: Mode) {
    experience.current?.dispose();
    experience.current = null;
    setState(null);
    setMode(nextMode);
    setGeneration((value) => value + 1);
  }

  return <main>
    <header className="site-header"><a className="wordmark" href="/" aria-label="SignalTrace home"><span className="brand-icon"><Icon name="trace" /></span>SignalTrace</a><span className="header-note">An interactive product exercise<span className="version">01 / MVP</span></span></header>
    <section className="intro" aria-labelledby="page-title"><p className="eyebrow">FROM INTERACTION TO INSIGHT</p><h1 id="page-title">The app works.<br />Does the data arrive?</h1><p>Nova is launching a shopping app. Its Product team needs to understand what customers view and add to cart. Explore how a working implementation makes that possible — and what happens when it breaks.</p></section>
    <div className="mode-bar"><div className="mode-controls" role="group" aria-label="Implementation mode">
      <button className={mode === "healthy" ? "selected" : ""} aria-pressed={mode === "healthy"} onClick={() => { if (mode !== "healthy") startFresh("healthy"); }}><span className="mode-dot healthy-dot" />Healthy Implementation</button>
      <button className={mode === "issue" ? "selected" : ""} aria-pressed={mode === "issue"} onClick={() => { if (mode !== "issue") startFresh("issue"); }}><span className="mode-dot issue-dot" />Implementation Issue</button>
    </div><button className="restart" onClick={() => startFresh(mode)}><Icon name="refresh" />Start fresh</button></div>
    <div className={`experience ${mode}`}>
      <section className="shopping-panel" aria-labelledby="shopping-title"><div className="panel-label"><span><span className="step">01</span> THE CUSTOMER'S VIEW</span><span className="simulation-label">Browser simulation</span></div><h2 className="sr-only" id="shopping-title">Nova shopping app</h2>
        <div className="phone"><div className="phone-status" aria-hidden="true"><span>9:41</span><span className="island" /><span className="phone-indicators">▮▮▮ <span className="battery" /></span></div>
          <div className="nova-nav"><span className="nova-logo">nova<span>®</span></span><span className="cart-indicator" role="status" aria-live="polite" aria-label={`Cart: ${state?.cart ?? 0} items`}><Icon name="bag" /><span>{state?.cart ?? 0}</span></span></div>
          <div className="product-art"><span className="collection-tag">THE EVERYDAY COLLECTION</span><ProductVisual /><span className="image-pagination" aria-hidden="true"><i /><i /><i /></span></div>
          <div className="product-info"><div className="product-title"><h3>The Everyday Mug</h3><span>$28</span></div><p>A little calm in your daily ritual.</p><div className="product-options"><span className="color-swatch" />Moss<span className="product-material">Glazed stoneware · 12 oz</span></div><button className="add-to-cart" disabled={!state} onClick={() => { void experience.current?.addToCart(); }}>Add to cart<Icon name="bag" /></button><p className={`cart-feedback ${state?.cart ? "has-items" : ""}`} aria-live="polite">{state?.cart ? <><Icon name="check" />{state.cart} {state.cart === 1 ? "item" : "items"} in your cart · ${(state.cart * 28).toFixed(2)}</> : "Thoughtfully made for everyday moments."}</p></div>
          <div className="home-indicator" aria-hidden="true" />
        </div>
        <p className="shopping-prompt"><span>Try it yourself</span> Add the mug to your cart.<Icon name="arrow" /></p>
      </section>
      <Dashboard state={state} onRefresh={() => { void experience.current?.refresh(); }} />
    </div>
    <div className="takeaway"><span className="takeaway-line" /><p>{mode === "healthy" ? "A customer action becomes a signal the Product team can use." : "A working shopping experience can still leave the Product team in the dark."}</p></div>
    {state && <Evidence state={state} />}
    <footer><span>SignalTrace<span className="footer-divider">/</span>Customer goal → implementation → observable value</span><span>Fictional shop. Real event delivery.</span></footer>
  </main>;
}
