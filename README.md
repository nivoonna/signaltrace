# SignalTrace

**SignalTrace shows what happens between a user tapping a button in a mobile app and that action appearing as analytics data, and what happens when something in that chain breaks.**

Analytics data records how people use an app, such as which products they view or add to their cart. Explore that journey through Nova, a fictional shopping app represented by a browser simulation. Nova's Product team wants reliable data to understand its customers' shopping journey.

**Current status: the first visible MVP works locally.** Shop in Nova and watch actual stored events appear in Nova Analytics. Switch between **Healthy Implementation** and **Implementation Issue** to see how a working shopping app can still leave its Product team without the data it needs. Technical evidence is available in a collapsed section. AI diagnosis, applying a fix within an incident, and native iOS remain planned.

The exercise demonstrates a simple product problem: a technical capability creates value only when it is implemented correctly and the customer can trust that it works.

## Happy Flow — See how it works

Start with everything working. Tap “Add to cart” and follow an **event**, a record of that action, through the system:

**Mobile app → SDK → API → backend → analytics dashboard**

1. **Mobile app:** Nova is the shopping interface where you view a product and tap “Add to cart.”
2. **SDK (software development kit):** The analytics code added to the app records your action as an event and sends it onward.
3. **API (application programming interface):** A defined entry point receives the event sent by the SDK.
4. **Backend:** The software running on a server checks the event and stores it.
5. **Analytics dashboard:** A screen displays the recorded action so you can see that it arrived.

## Diagnostic Flow — Find what broke

Explore the same system with one layer intentionally broken. The shopping app keeps working, so you can still view products and add them to your cart, but those actions are missing from the analytics dashboard.

The MVP lets you inspect delivery evidence yourself. In the planned full Diagnostic Flow, you will also be able to ask the **Integration Copilot**, an AI assistant that uses tools to read what the system reports. The investigation will examine:

- **SDK state:** Whether the analytics code has been started and is ready to record actions.
- **Logs:** Records of what the system did and any errors it encountered.
- **API behavior:** Whether the SDK sent a request and what response it received.
- **Event delivery:** Whether each recorded action reached the backend and appeared on the dashboard.

The MVP's first failure is analytics code that was never started, or **initialized**. The app still works, but no analytics delivery request is made. Switching modes starts a fresh session; it is not a fix or a recovery validation for the old session. Applying a fix and validating fresh events while preserving the original incident is planned for a later increment.

## Why this exercise exists

The goal is to show how I approach a technical product problem end to end: understanding the user workflow, designing the system, working across SDKs and APIs, using AI for diagnosis, and validating that the solution actually works.

## Product hypothesis

When analytics data is missing, finding where the chain broke can take longer than fixing it. An AI assistant that examines the system's evidence may help people find the cause faster.

That is a hypothesis to test, not a measured result. SignalTrace will compare investigation with and without the Copilot, then check whether the proposed fix actually restores event delivery.

## What exists and what is planned

The labels describe different dimensions: **implemented** means present and verified; **planned** means not built; **simulated** means an intentional model of another system; **mocked** means a fixed test substitute. A future component can be implemented while still representing a simulation.

| Component | Status today | Intended behavior |
| --- | --- | --- |
| Product brief, architecture, decisions, build plan | Present; ready for review | Documentation of the proposed product |
| Nova commerce experience | Implemented simulation | Browser shopping app with one product and a working cart |
| Browser analytics model | Implemented simulation | Browser-owned initialization state and expected events; healthy and uninitialized modes |
| Event ingestion API and stored events | Implemented | `POST /events` validates and persists events in SQLite |
| Automated ingestion tests | Implemented | Accepted events, invalid input, duplicate protection, and persistence after restart |
| Session retrieval and Nova Analytics | Implemented | `GET /sessions/{session_id}/events` reads SQLite; dashboard compares expected and received events |
| Technical evidence | Implemented | Browser tracking attempts, actual HTTP results, and stored status; durable diagnostic logs remain planned |
| Integration Copilot | Planned | Live server-side OpenAI calls and explicit diagnostic functions |
| Provider responses in deterministic tests | Planned; intended mocks | Clearly labeled fixed responses; never presented as live AI |
| SwiftUI app and `NovaAnalyticsSDK` | Planned | Native reference app and original Swift package |
| Broader tests, agent evaluations, GitHub Actions, hosted demo | Planned | Full-flow verification and delivery evidence; no agent evaluation results yet |

Nova is fictional. Product names, scenarios, data, assets, and implementation will be original. No employer code, internal documentation, screenshots, architecture, or data are used. Any simulated business metrics must be labeled **demo data**.

## Run the visible MVP

Start the API using the instructions below. In a second terminal, with Node.js 24+ and pnpm 11.19.0 installed:

```powershell
cd apps/web
pnpm install --frozen-lockfile
pnpm dev
```

If needed, install the pinned package manager with `npm install --global pnpm@11.19.0` first. Open [SignalTrace at localhost:3000](http://127.0.0.1:3000).

1. In **Healthy Implementation**, opening the product creates one view event. Press **Add to cart**: the dashboard should show **Expected: 2**, **Received: 2**, and **Implementation healthy**.
2. Switch to **Implementation Issue** and add the mug. The cart still updates, but the dashboard shows **Expected: 2**, **Received: 0**, and **Implementation issue**.
3. Expand **View technical evidence**. Healthy events show actual response codes and stored records. Issue events show **Not initialized**, **Delivery attempted: No**, and **API request: None**.

Each mode switch, reload, or **Start fresh** creates a new session. More cart clicks create more expected events. The dashboard reads stored events after each action and polls three seconds after each completed background read. Backend failures show delivery as **unconfirmed**, not as a successful or empty read.

The web server forwards `/api/events` to FastAPI's `/events` and `/api/sessions/{session_id}/events` to the matching read endpoint. Set `SIGNALTRACE_API_URL` before starting/building Next.js to change its default `http://127.0.0.1:8000` destination. No CORS configuration or browser secrets are required. To run the optimized build, use `pnpm build` then `pnpm start` instead of `pnpm dev`.

**Real:** HTTP ingestion, validation, duplicate protection, SQLite persistence, session retrieval, and dashboard results. **Simulated:** Nova, its product/cart, browser analytics initialization, and the intentional missing-initialization incident. The mug illustration is original SVG artwork. Cart contents and tracking evidence live only in browser memory; accepted events survive restarts in SQLite. There is no checkout, production SDK, AI, or recovery workflow.

This MVP is local only: session IDs filter data but do not authorize access. Authentication, retention/cleanup, pagination, deployment, and durable tracking-attempt storage are deferred.

## Run the event ingestion API

This first increment accepts one event at a time through `POST /events`. It uses real FastAPI validation and a real SQLite file; no application behavior is simulated or mocked here. Authentication and session ownership checks are deferred, so this increment is intended for local use. `session_id` is event metadata, not proof of identity.

With Python 3.12+ installed, run these commands from the repository root. PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m uvicorn apps.api.main:app --host 127.0.0.1 --port 8000
```

On macOS/Linux, use `python3 -m venv .venv` and `.venv/bin/python` in place of `.\.venv\Scripts\python.exe` for the remaining commands. Runtime-only installation can use `requirements.txt` instead.

The database is created at `data/signaltrace.sqlite3` when the app starts. Set `SIGNALTRACE_DB_PATH` before startup to use another SQLite file; relative paths are resolved from the working directory. The database and virtual environment are ignored by Git. Interactive API documentation is available at [localhost:8000/docs](http://127.0.0.1:8000/docs) while the server runs.

### Event contract

All five fields are required. Both supported events describe a product, so both require `product_id`.

| Field | Rule |
| --- | --- |
| `event_id` | Globally unique, case-sensitive string; 1–128 characters with no whitespace |
| `event` | Exactly `product_viewed` or `product_added_to_cart` |
| `session_id` | Case-sensitive string; 1–128 characters with no whitespace |
| `timestamp` | ISO 8601 string: `YYYY-MM-DDTHH:MM:SS[.ffffff]Z` or an explicit `+/-HH:MM` timezone offset; normalized to UTC for storage |
| `product_id` | Case-sensitive string; 1–128 characters with no whitespace |

Extra fields, missing fields, invalid types, invalid dates, timestamps without a timezone, and numeric timestamps are rejected. This increment has no product catalog: `product_id` identifies a product but is not checked against a catalog.

Send an event from a second PowerShell terminal:

```powershell
$event = @{
    event_id = 'evt-001'
    event = 'product_viewed'
    session_id = 'session-001'
    timestamp = '2026-09-28T12:34:56Z'
    product_id = 'nova-mug'
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/events' -ContentType 'application/json' -Body $event
```

The first submission returns `201 Created` with:

```json
{"event_id": "evt-001", "status": "accepted"}
```

| Request outcome | HTTP response | Storage behavior |
| --- | --- | --- |
| Valid new event | `201 Created` with event ID and `accepted` status | Returned only after SQLite commits the row |
| Malformed JSON or invalid event fields | `422 Unprocessable Entity` with a `detail` list of validation errors | Nothing stored |
| Unsupported event type | `422 Unprocessable Entity` with an error for `event` | Nothing stored |
| Duplicate `event_id`, even with a different session or payload | `409 Conflict` with `detail.code=duplicate_event_id` | Original record unchanged |
| SQLite operational failure | `503 Service Unavailable` with `detail.code=storage_unavailable` | No acceptance reported |

Repeating the example produces a duplicate response. Use a new `event_id` for a new action. The existing ingestion contract is unchanged by the visible MVP.

### Read a session's events

`GET /sessions/{session_id}/events` returns `200` with an array of the session's committed events in insertion order, including all five contract fields. An unknown session returns `[]`. Invalid session identifiers return `422`; unavailable storage returns `503` with `detail.code=storage_unavailable`. Responses use `Cache-Control: no-store`. Session filtering is case-sensitive and parameterized; it is not authentication.

```powershell
Invoke-RestMethod 'http://127.0.0.1:8000/sessions/session-001/events'
```

### Run the tests

```powershell
.\.venv\Scripts\python.exe -m pytest -q -W error
```

The 33 backend cases use fixed inputs and separate temporary SQLite files, leaving the local demo database untouched. They retain all 28 ingestion cases and add session filtering/order, empty results, identifier validation, read failure, and retrieval after restart. A live Uvicorn test verifies ingestion, retrieval, and duplicates over actual HTTP.

From `apps/web`:

```powershell
pnpm test
pnpm typecheck
pnpm build
```

The 16 browser-state cases use fixed IDs/clocks and explicitly mocked transport. They verify both modes, exact event payloads, storage-backed health, mismatched records, errors/recovery, repeated actions, and stale responses. They do not substitute for running the two applications together.

With both applications running, six Playwright browser tests check actual delivery/retrieval, no delivery in issue mode, session resets, an explicitly mocked read outage and recovery, a narrow screen, and keyboard controls. They add new UUID sessions to the local demo database without changing existing records. Screenshots and session evidence are written to ignored `apps/web/test-results/` files.

```powershell
# Use an installed Chrome browser (PowerShell):
$env:PLAYWRIGHT_CHANNEL = 'chrome'
pnpm test:e2e
```

Alternatively, run `pnpm exec playwright install chromium` and leave `PLAYWRIGHT_CHANNEL` unset. `PLAYWRIGHT_BASE_URL` defaults to `http://127.0.0.1:3000`.

## First incident: SDK not initialized

The first planned vertical slice is `sdk_not_initialized`:

1. Open the simulated Nova app in a new demo session.
2. View a product, then add it to the cart.
3. Expect `product_viewed` and `product_added_to_cart` events.
4. Observe two dropped tracking attempts because the SDK was never initialized.
5. See two expected events and zero ingested events in the dashboard.
6. Ask the Integration Copilot why events are missing.
7. Inspect its explicit `get_sdk_state` call and returned evidence.
8. Read a diagnosis tied to that evidence: initialization is missing.
9. Apply the demo initialization fix through a user-controlled action.
10. Rerun the two commerce actions as a new validation run.
11. Observe successful HTTP ingestion and the two stored events.
12. See validation pass while the original failed attempts remain visible.

Before initialization, **no ingestion request occurs**. The dashboard must distinguish a dropped SDK call from an HTTP rejection. The fix does not retroactively recover dropped events; validation generates fresh events.

## High-level architecture — planned

The diagram describes the future diagnostic system. In the current MVP, the browser owns the analytics simulation and posts directly through the web proxy to ingestion. The backend controller, Copilot, and validation runner below are not implemented; [D13](docs/product-decisions.md#d13--deliver-the-visible-mvp-with-a-browser-analytics-model) records this scope choice.

```mermaid
flowchart LR
    Web["Next.js: Nova simulation, dashboard, Under the Hood"] --> Demo["FastAPI: demo controller and simulated SDK"]
    Demo -->|HTTP after initialization| Ingest["FastAPI: event ingestion"]
    Native["SwiftUI app + NovaAnalyticsSDK"] -->|HTTP| Ingest
    Demo --> DB[(SQLite)]
    Ingest --> DB
    Web --> Agent["FastAPI: Integration Copilot"]
    Agent <-->|server-side only| OpenAI[OpenAI API]
    Agent --> Tools["Read-only diagnostic tools"]
    Tools --> DB
    Web --> Validate["FastAPI: validation runner"]
    Validate --> Demo
```

The browser does not run Swift. Its modeled SDK behavior and the native package will share event contracts and parity fixtures. FastAPI owns domain behavior; Next.js owns presentation. SQLite supports the initial small deployment. See [architecture](docs/architecture.md) for boundaries, API contracts, state, and tradeoffs.

## Incident coverage

**Missing initialization is runnable in the browser MVP.** It demonstrates missing delivery and inspectable evidence. Remediation within the same session, recovery validation, and additional incidents remain planned.

| Incident | Intended failing layer | Scope |
| --- | --- | --- |
| SDK not initialized | SDK lifecycle | Browser simulation implemented; same-session remediation and validation planned |
| Missing tracking call | Application instrumentation | Backlog candidate |
| Invalid ingestion credential | Authentication | Backlog candidate |
| Consent prevents collection | Privacy configuration | Backlog candidate; respect consent, do not bypass it |
| Invalid event payload | Event schema | Backlog candidate |
| Network unavailable or ingestion unavailable | Delivery / backend | Backlog candidates; distinguish no response from an HTTP error |

## Agent tools — proposed, not implemented

| Tool | Evidence returned |
| --- | --- |
| `get_sdk_state` | Initialization state, source, observation time, version, and dropped-attempt summary |
| `get_runtime_logs` | Bounded, redacted logs correlated with actions and tracking attempts |
| `get_event_delivery` | Expected events, attempted requests, actual HTTP outcomes, and stored events for a run |
| `get_validation_result` | Checks and evidence from a completed validation run |

Tool access is scoped to the active session by the backend. The agent diagnoses and recommends; the user applies the fix and starts validation. No model tool changes configuration. Planned tool definitions and error behavior are in [architecture](docs/architecture.md).

## Validation and evaluation

Deterministic ingestion tests now verify the event contract, HTTP responses, SQLite persistence, and duplicate protection. Tests for SDK transitions, authorized session isolation, and the complete failure-to-recovery flow remain planned. In that future flow, a validation pass will require fresh evidence from the current run, including both expected events in storage; a green chat message will be insufficient.

Agent evaluations will separately assess tool use, correct root cause, evidence grounding, uncertainty, and appropriate remediation. Offline tests will mock the model provider; separately labeled live evaluations will exercise the real OpenAI integration. Report versions, sample sizes, failures, latency, and cost alongside results. There are no measured results yet.

Product assessment will compare diagnosis and validated recovery with and without the Copilot using equivalent evidence. The [product brief](docs/product-brief.md) defines metrics; the [build plan](docs/build-plan.md) defines release gates.

## Repository structure

Present now:

```text
signaltrace/
|-- README.md
|-- .gitignore
|-- requirements.txt
|-- requirements-dev.txt
|-- apps/api/
|   |-- __init__.py
|   |-- main.py
|   |-- models.py
|   `-- database.py
|-- tests/
|   `-- test_events.py
`-- docs/
    |-- product-brief.md
    |-- architecture.md
    |-- product-decisions.md
    `-- build-plan.md
```

The web app now lives in `apps/web/` (Next.js/React, browser analytics model, and state tests). Remaining proposed directories:

```text
apps/ios/                    Nova SwiftUI reference app
packages/NovaAnalyticsSDK/    Original Swift package and package tests
contracts/                   Versioned event and diagnostic schemas; shared fixtures
evals/                       Agent cases, rubrics, runner, and labeled reports
.github/workflows/           CI workflows
```

## Explore further

- [Product brief](docs/product-brief.md): the problem, planned experience, and how success will be measured.
- [Architecture](docs/architecture.md): how the parts connect, exchange data, and verify delivery.
- [Product decisions](docs/product-decisions.md): the choices behind the design and their tradeoffs.
- [Build plan](docs/build-plan.md): milestones, tests, and evaluation of the Copilot's diagnoses.

The visible MVP demonstrates healthy delivery and missing analytics through the same shopping interface. The full Diagnostic Flow, Integration Copilot, native app, and deployment remain separate, reviewable increments.
