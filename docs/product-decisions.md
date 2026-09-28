# SignalTrace product decisions

Status: proposed decisions for the initial architecture review. These entries record design intent, alternatives, consequences, and revisit triggers. They do not claim implementation or completed validation. See [architecture](architecture.md) for contracts and [build plan](build-plan.md) for milestone gates.

## D01 — Start with one complete incident

**Decision:** Deliver `sdk_not_initialized` from symptom through diagnosis, explicit remediation, and verified event delivery before adding more incidents.

**Why:** One complete flow makes the connection between the user problem and technical evidence inspectable. Initialization has a clear boundary: a dropped tracking call produces no ingestion request.

**Alternative and tradeoff:** A broad incident catalog would show more coverage sooner but could leave fixes, validation, or tool behavior incomplete. One incident alone is weak evidence of general agent capability.

**Revisit when:** The first slice passes deterministic and live-agent gates. Then prioritize new layers based on diagnostic ambiguity and distinct evidence needs.

## D02 — Browser access with a separate native reference

**Decision:** Make the browser simulation the accessible entry point; retain a real SwiftUI app and original `NovaAnalyticsSDK` package as required later deliverables.

**Why:** Reviewers can inspect the incident without building an iOS app, while engineers can later inspect an actual lifecycle and SDK integration.

**Alternative and tradeoff:** A native-only experience increases setup friction. A browser-only experience cannot substantiate native SDK claims. Two implementations need shared fixtures and explicit parity verification.

**Revisit when:** Browser/native behavior diverges or a native-only incident becomes central. Never relabel browser execution as native execution.

## D03 — Own simulated SDK state on the backend

**Decision:** FastAPI owns each browser session's SDK model and commerce command execution. Eligible tracking uses actual HTTP ingestion; uninitialized tracking records a local drop without sending a request.

**Why:** Tools, the dashboard, and validation can inspect one authoritative state instead of relying on a browser snapshot that may never arrive.

**Alternative and tradeoff:** A JavaScript SDK running in the browser would put tracking closer to a real client but introduce a second telemetry path for diagnostic state. Backend ownership is deliberately a simulation and does not reproduce mobile networking. Loopback HTTP adds one transport boundary; keep it asynchronous and bounded.

**Revisit when:** Browser-network behavior or device inspection is required. Extend evidence provenance and freshness before allowing the Copilot to claim remote device state.

## D04 — Keep presentation and domain logic separate

**Decision:** Use Next.js/React/TypeScript for presentation and Python/FastAPI for ingestion, sessions, tools, and validation. Keep these backend functions in one deployed service initially.

**Why:** This follows the preferred stack and provides an explicit API boundary without requiring distributed infrastructure.

**Alternative and tradeoff:** A TypeScript-only stack would reduce language count; separate services could isolate workloads. The selected approach uses two web runtimes but keeps business rules out of the web server.

**Revisit when:** A measured deployment or maintenance constraint outweighs the current separation, or a module requires independent scaling.

## D05 — Start with SQLite and bounded demo sessions

**Decision:** Persist sessions, runs, attempts, events, logs, and validation evidence in SQLite on local persistent storage. Scope all reads and mutations to an authorized session.

**Why:** Evidence survives a page refresh, remains inspectable, and can be reset by starting a new session. Separate run IDs prevent old successes from passing a new validation.

**Alternative and tradeoff:** In-memory state is simpler but loses evidence. PostgreSQL would better accommodate distributed deployment but adds setup and operations before they are needed. SQLite constrains deployment and concurrent writes.

**Revisit when:** Multiple backend instances, write contention, stronger retention requirements, or the chosen host make local SQLite unsuitable.

## D06 — Drop pre-initialization events explicitly

**Decision:** The fictional SDK records `SDK_NOT_INITIALIZED`, drops the event, and leaves the commerce action usable. It does not buffer or automatically replay the dropped event. Initial transport sends one event per request without automatic retries.

**Why:** This creates deterministic, inspectable lifecycle behavior and keeps the first incident focused. Fresh actions after initialization are required to prove recovery.

**Alternative and tradeoff:** Buffering could preserve early events but would obscure the missing-initialization failure and require queue lifetime and retry semantics. Dropping events makes data loss explicit.

**Revisit when:** A queue or retry incident is added. Treat any behavior change as a contract change and update native parity tests.

## D07 — Use explicit, read-only diagnostic tools

**Decision:** The Copilot uses the server-side OpenAI Responses API and allowlisted diagnostic functions. The first incident's initial diagnostic call requires `get_sdk_state`. Tools do not apply fixes or start validation.

**Why:** Evidence acquisition is visible and reviewable. Keeping mutations in user controls preserves a clear link between diagnosis, action, and verification.

**Alternative and tradeoff:** A scripted explanation would be cheaper and deterministic but would not demonstrate live AI interpretation. Autonomous remediation would need broader authorization and recovery semantics. A required first tool call narrows the agent task; report this when evaluating it.

**Revisit when:** Read-only diagnosis is reliable across additional incidents and a concrete user need justifies bounded mutation tools. Model choice follows measured quality, latency, and cost, not an untested preference.

## D08 — Keep recovery independent of model confidence

**Decision:** A deterministic validator repeats the real command and delivery path with fresh IDs. It checks SDK readiness, expectations, attempts, HTTP acknowledgments, and persisted events. The UI distinguishes diagnosed, fix applied, and validated.

**Why:** An agent's answer and a configuration change do not prove that data arrived. Run-scoped evidence prevents stale or unrelated records from producing a false pass.

**Alternative and tradeoff:** A success toast after initialization is simpler but demonstrates only a state change. Full validation adds records and checks but provides meaningful acceptance evidence.

**Revisit when:** Asynchronous delivery or batching changes completion semantics. Define bounded waits and inconclusive states before adopting those behaviors.

## D09 — Separate deterministic tests from live evaluations

**Decision:** Offline CI uses controlled state, fixed IDs/clocks, and mocked provider responses. Separate opt-in live evaluations measure model behavior and disclose model/prompt/tool versions, sample sizes, and provider failures.

**Why:** Repeatable software checks and probabilistic agent quality answer different questions. A mocked response cannot establish model accuracy.

**Alternative and tradeoff:** Calling a live model in every PR could catch provider behavior changes but adds cost, variability, and credential requirements. Offline tests alone leave agent quality unmeasured.

**Revisit when:** A stable live baseline and a defined spending budget justify scheduled evaluations. No live-provider calls should run on untrusted PR code with secrets.

## D10 — Preserve original provenance and honest claims

**Decision:** Use original fictional Nova scenarios, data, visuals, SDK behavior, and implementation. Exclude proprietary employer materials. Clearly label simulations, mocks, planned functionality, and demo business metrics.

**Why:** Reviewers must be able to distinguish the designed exercise from measured behavior and external systems. Product-value claims require evidence.

**Alternative and tradeoff:** Familiar vendor material might appear realistic but is outside scope and is not a source for this work. An original system requires explicit design decisions and limits generalization.

**Revisit when:** New assets, examples, dependencies, or published results are introduced. Preserve provenance and update status labels in the same change.

## D11 — Use polling before streaming

**Decision:** The dashboard initially refreshes after mutations and polls bounded evidence endpoints, showing observation times. It derives status from stored evidence rather than animations.

**Why:** Two events per first-slice run do not require streaming infrastructure.

**Alternative and tradeoff:** Server-sent events or WebSockets could improve immediacy but introduce connection and replay concerns. Polling has bounded delay that should remain visible.

**Revisit when:** Measured update latency or event volume makes polling inadequate.

## Open decisions

| Decision | Resolve by | Evidence required |
| --- | --- | --- |
| Runtime, dependency, schema, and test-runner versions | First implementation PR | Compatible supported releases, reproducible lockfiles, documented local commands |
| Model identifier, prompt version, and provider limits | Live Copilot milestone | Live evaluation results, account availability, latency and cost budget |
| Minimum iOS target and native build setup | Native milestone | Available macOS/Xcode environment and required SwiftUI capabilities |
| Hosting, persistent volume, session retention, cleanup, and spend caps | Before public deployment | Deployment constraints, isolation checks, bounded resource use |
| Subsequent incident order | After the first complete slice | Distinct failing layers, observable evidence, and evaluation gaps |
| Product improvement target | After a formative baseline | Manual/Copilot comparison with sample size and limitations |

Maintain stable decision IDs. If a choice changes, record what supersedes it and why, and update the affected architecture, milestone gates, and README status together.
