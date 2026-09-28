# SignalTrace build plan

Status: ingestion is committed. The next visible MVP adds session retrieval, Nova shopping, Nova Analytics, healthy/issue modes, implementation health, and technical evidence. The broader diagnostic system, agent evaluations, CI, and deployment remain planned.

## Delivery sequence

| Milestone | Outcome | Status |
| --- | --- | --- |
| M0 | Product framing and architecture | Documents present |
| M1 | Deterministic incident engine, evidence, and HTTP ingestion | In progress: ingestion/retrieval implemented; browser models the first incident |
| M2 | Browser failure-to-recovery experience and validation | In progress: shopping/dashboard and two modes implemented; same-session fix/validation deferred |
| M3 | Live Integration Copilot with visible tools and agent evaluations | Planned |
| M4 | Native SwiftUI app, Swift SDK, and parity evidence | Planned |
| M5 | Hosted experience, Under the Hood evidence, and product assessment | Planned |

Complete each milestone's acceptance criteria before claiming its functionality in the README. The first complete vertical slice spans M1–M3. The native reference remains a required project deliverable beyond that browser slice.

### Bounded visible MVP increment

The browser MVP uses the existing POST contract unchanged, adds only a session read endpoint to FastAPI, and models initialization in the browser. Its two modes compare working delivery with missing initialization while preserving shopping behavior. Dashboard health comes from actual stored events; HTTP codes and simulation details live in collapsed evidence. See D13 for the scope adjustment from the future backend incident engine.

Checks: retain all ingestion tests, add retrieval tests, test browser health/state decisions with fixed inputs, build/type-check Next.js, and verify both flows against the running API and SQLite. A mode switch starts a new session and is not remediation of the original incident. This increment does not complete M1 or M2, and introduces no AI, native code, CI, or deployment.

## M0 — Documentation and architecture

Deliver the [README](../README.md), [product brief](product-brief.md), [architecture](architecture.md), [product decisions](product-decisions.md), and this build plan.

Acceptance: the purpose and current status are clear at the entry point; product hypothesis, audiences, first flow, technology choices, state boundaries, tools, validation, milestones, assumptions, and tradeoffs are documented. Links resolve and status language does not imply working software. Application code is outside this milestone.

## M1 — Deterministic incident engine and ingestion

Build this milestone through small, independently reviewable increments. The first implements only ingestion: FastAPI `POST /events`, the five-field contract, SQLite, and deterministic tests. It does not add a commerce flow, SDK simulation, authentication, dashboard, diagnostics, or AI.

The first increment's checks cover both supported event types, malformed and unsupported input, duplicate IDs including concurrent submissions, UTC normalization, durable storage across application restart, configurable database paths, and storage failure. Setup and test commands are in the [README](../README.md#run-the-event-ingestion-api). Runtime and test dependencies are pinned. No commit is created before user review.

The remainder of M1 stays planned. Add only the backend and contract scaffolding required by each subsequent increment. Establish offline GitHub Actions checks later in this milestone; CI is not included in the first ingestion increment.

Implement isolated demo sessions, the two commerce commands, independent event expectations, the SDK state machine, bounded runtime logs, ingestion, and evidence persistence. Add the controlled initialization action and enforce session ownership. Use actual HTTP for an initialized simulated SDK in the runnable path, as defined in [architecture](architecture.md).

Acceptance criteria:

- A fresh baseline session is uninitialized. Product view and add-to-cart commands succeed, record two expected events and two `SDK_NOT_INITIALIZED` drops, and send zero ingestion requests.
- Initialization with the same configuration is idempotent. Fresh post-fix actions produce two real HTTP requests and two correctly correlated stored events.
- Ingestion schema validation, credential checks, duplicate IDs, and conflicting payloads have asserted outcomes. A duplicate cannot inflate counts.
- Session and run isolation hold for diagnostic reads and mutations. Refreshing or restarting the service does not turn old evidence into a new success.
- Clocks and ID generation can be controlled in tests. Unknown or missing evidence is distinguishable from a healthy result.
- Offline CI verifies backend and contract behavior without an OpenAI key. README setup instructions and status match what actually runs.

## M2 — Browser incident flow and validation

Build Nova's simulated commerce interface, the expected-versus-delivered dashboard, runtime logs, user-controlled initialization, and validation. Establish the “Under the Hood” view for architecture, event schema, and request/response inspection. Display the Copilot as unavailable until its integration exists; do not fill it with an unlabeled scripted answer.

Acceptance criteria:

- The user can open a session, view the product, add it to the cart, and see the two failed tracking attempts with no ingestion request.
- Dashboard counts come from backend evidence. Command HTTP success is not displayed as event delivery success.
- “Apply demo fix” changes initialization state but does not mark recovery complete.
- “Run validation” creates a fresh run and repeats the same commerce/SDK path. Before the fix it fails; after the fix all named checks pass with two fresh stored events.
- Baseline failures remain inspectable. Concurrent or repeated actions cannot cross-contaminate validation; duplicate requests cannot create extra successes.
- Browser tests cover the failure/fix/validation flow, expired session behavior, and backend unavailability. Essential controls work by keyboard and status is understandable without color.
- Documentation identifies the browser simulation, its backend SDK model, and all remaining planned components.

## M3 — Integration Copilot and evaluations

Add server-side OpenAI orchestration, strict function definitions, the four diagnostic tools, scoped handlers, and visible sanitized traces. The first diagnosis uses `get_sdk_state`; user controls continue to own all mutations. Select a model only after a baseline evaluation and record its identifier and configuration.

Acceptance criteria:

- The full first user flow includes a real provider call, an explicit tool request, execution by the backend, the returned SDK state, and a diagnosis grounded in that result.
- The Copilot cites evidence, explains the failing layer, recommends initialization before tracking, and does not claim the fix is validated before a matching validation result exists.
- Tool arguments, run ownership, output size, and call/time/token limits are enforced by the backend. The OpenAI key is absent from browser/native artifacts and diagnostic output.
- A provider error, tool error, stale result, or exhausted limit is visible. No automatic switch to mocked success occurs.
- Offline orchestration tests pass. Live regression evaluations run separately and publish their configuration, traces, counts, and failures as described below.
- The complete M1–M3 slice is reproducible through the interface. Documentation distinguishes deterministic coverage from live evaluation evidence.

## M4 — Native app and SDK parity

Implement a small original `NovaAnalyticsSDK` Swift package and Nova SwiftUI reference app with the two commerce actions. Demonstrate missing initialization and its lifecycle correction against the same event ingestion schema.

Acceptance criteria:

- Swift package tests verify pre-initialization drops with zero transport calls, post-initialization payloads, consent handling, and typed errors.
- The iOS app builds and runs in a documented macOS/Xcode environment. Capture the toolchain and simulator/device used; Windows-only inspection is not native execution evidence.
- A native integration run sends the two expected events to FastAPI and verifies persistence and correlation. Any dashboard pairing is scoped to the native demo session.
- Shared fixtures demonstrate parity for event names, payload rules, lifecycle outcomes, and errors. Browser simulation and native implementation remain visibly distinct.
- The Copilot is not presented as inspecting device state unless a separate native diagnostics connection has actually been implemented and verified.
- CI adds the appropriate Swift/iOS checks. README links to real native source and explains how to reproduce the verified flow.

## M5 — Hosted experience and product assessment

Choose hosting that supports the documented persistent SQLite arrangement, or record a revised persistence decision. Establish session expiration/cleanup, resource limits, provider budget controls, and observable failure behavior before publishing a live experience.

Acceptance criteria:

- A hosted smoke run completes failure, diagnosis, explicit fix, and fresh validation against the deployed backend. Cold starts or restarts do not fabricate or misattribute event state.
- “Under the Hood” links to the actual architecture, API examples, sanitized traces, evaluation reports, tests, and relevant PR/CI evidence.
- All surfaces label simulations, mocks, and demo business data. An unavailable live Copilot is described accurately.
- A formative assessment compares manual and Copilot-assisted diagnosis using the [product metrics](product-brief.md). Publish method, sample size, observations, and limitations; do not invent time savings.
- The README lists verified functionality, supported scenarios, setup and live links, known limitations, and the next planned scope.

Further incidents are backlog work after this milestone sequence. Each new scenario requires a distinct evidence model, controlled reproduction, appropriate remediation, deterministic validation, and agent cases before being labeled supported.

## Verification strategy

Ingestion tests for accepted events, malformed/unsupported input, duplicates, UTC normalization, restart persistence, configuration, and storage failure now exist. Authentication checks and the other test layers below remain planned. Add each alongside its implementation rather than deferring verification to the end.

| Layer | Planned checks | What they establish |
| --- | --- | --- |
| SDK state / commerce | Unit tests with fixed clocks, IDs, and a transport spy | Expectations are independent of delivery; no request before initialization; explicit state transitions |
| Ingestion | HTTP tests for valid events, auth, malformed payloads, duplicates, conflicts, persistence failures | Actual status/body contracts and durable receipts |
| Evidence / session isolation | Multiple sessions and runs; stale results; missing records | No cross-session access or false recovery from old evidence |
| Browser | Playwright flow through the running web/API stack | A user can reproduce failure, apply a fix, and inspect validated recovery |
| Agent orchestration | Scripted provider responses, invalid arguments, tool failures, state changes, injected log instructions | Tool dispatch, scope, bounds, error handling, and evidence display; not model intelligence |
| Native | Swift package tests and simulator/backend integration | Actual Swift behavior and parity with shared contracts |
| Live agent | Real provider runs against controlled evidence | Diagnosis quality and limitations of the chosen model/prompt/tools |

Use isolated temporary databases and deterministic fixtures for software tests. Test network failures and persisted-but-unacknowledged events explicitly; validation must return failure or inconclusive evidence, never fabricated recovery. Browser integration tests should synchronize on observed state rather than fixed timing delays.

## Agent evaluation protocol

Version each case with an input question, initial system state or tool fixture, evidence available to the agent, expected diagnostic behavior, and a grading rubric. Keep the expected root cause, fault injection settings, and grader labels out of the model input. Distinguish a live model over mocked tool fixtures from a live model over the integrated running system in every report.

| Case family | Required behavior |
| --- | --- |
| Canonical missing initialization | Use the required state tool, identify missing initialization, cite observed state/attempts, recommend the correct change |
| Healthy initialized system | Do not diagnose missing initialization when current evidence supports healthy delivery |
| Initialized after earlier failures | Explain historical pre-initialization drops without treating old errors as the current SDK state; require fresh validation |
| Missing or contradictory evidence | State uncertainty or request relevant evidence; do not invent a diagnosis |
| Tool unavailable or provider timeout | Surface the incomplete investigation; preserve usable evidence and manual controls |
| No post-fix validation | Do not claim recovery from configuration state alone |
| Validation contains old or foreign event IDs | Do not claim a pass; enforce session/run boundaries |
| Instruction-like content in logs | Treat it as data; do not change permissions, leak secrets, or invoke unsupported tools |

Grade root-cause correctness, evidence grounding, appropriate additional tool use, remediation correctness, uncertainty, and recovery claims separately. The first tool call is required by orchestration; it is not evidence of autonomous tool selection. Use programmatic checks for trace structure, tool arguments, evidence IDs, and validation references, plus human review for the diagnosis and explanation. Do not use a model grader as the sole release authority.

For the initial live regression gate, plan three independent attempts per case under a recorded configuration. Require correct, grounded diagnoses in the canonical case, no false missing-initialization claim for the healthy case, and no fabricated evidence or recovery claims across the set. A failure is investigated and the affected gate rerun before release. This is a small regression gate, not a statistical reliability claim; all results remain unmeasured today.

Reports should include commit, case-set version, model identifier, prompt/tool versions, provider mode, run count, per-case outcomes, latency, tool/model calls, token use, cost assumptions, and provider errors. Keep missing/failed provider runs in the attempted-run denominator and report them separately from incorrect diagnoses. Report abstentions separately as well. Redact credentials and keep all scenario data fictional.

## GitHub and Codex-assisted workflow

The future workflow will use a scoped issue, a focused branch, and a reviewable PR for each coherent increment. The issue should identify the user-visible outcome, relevant decision IDs, acceptance criteria, and affected contracts. This ingestion task stops with local changes for review; it creates no commit, issue, branch, PR, or workflow.

Use Codex to implement bounded changes against those criteria, inspect its diff, and verify the behavior with the appropriate checks. Each PR should explain the problem and resulting behavior, include actual verification evidence and limitations, and update README status and affected design decisions. Do not describe planned checks as passing checks.

Run formatting, type checks, relevant deterministic tests, and contract checks in ordinary PR CI. Add web and native jobs as those components appear. Keep live provider evaluations in an explicitly triggered trusted workflow with secret access and spending limits; ordinary untrusted PR checks must work without provider credentials. Store sanitized reports as versioned artifacts associated with the evaluated commit.

## Current stop point

The event ingestion API and its tests are the current deliverable. Review the schema, `201`/`422`/`409` behavior, SQLite persistence, and test evidence before creating the first implementation commit. The full Happy Flow, Diagnostic Flow, dashboard, Integration Copilot, OpenAI integration, and SwiftUI app belong to subsequent increments.
