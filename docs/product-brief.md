# SignalTrace product brief

Status: proposed product; documentation only. No customer research, runtime implementation, or measured product results exist in this repository yet. See the [README](../README.md) for current implementation status.

## Problem and intended user

A mobile developer has integrated an analytics SDK into an iOS commerce app. Product views and cart actions work, but their events do not appear in analytics. The symptom alone does not identify the failure: the app might never call tracking, the SDK might be uninitialized, authentication might fail, consent might prevent collection, or the request might fail during delivery or ingestion.

The developer needs to locate the responsible layer, understand the evidence, make an appropriate change, and prove that event delivery now works. SignalTrace models this workflow with original, fictional systems and observable behavior.

The primary user of the planned incident experience is a developer investigating missing events. Reviewers are a separate audience: they should be able to understand the product value quickly and inspect progressively deeper technical evidence.

## Product hypothesis

When an SDK integration fails, developers often spend more time identifying which layer is responsible than applying the eventual fix. If an AI agent can inspect configuration, runtime logs, API behavior, and event state through explicit diagnostic tools, it may reduce the search space and shorten time to root cause.

The hypothesis requires comparison with a useful manual workflow. An agent that repeats a scenario title or supplies a plausible explanation without inspecting evidence has not demonstrated diagnostic value.

## Purpose

**SignalTrace shows what happens between a user tapping a button in a mobile app and that action appearing as analytics data, and what happens when something in that chain breaks.**

Analytics data records how people use an app, such as viewing a product or adding it to a cart. The planned browser simulation of Nova, a fictional shopping app, will offer two separate experiences. Neither is implemented yet.

### Happy Flow — See how it works

Start with a healthy system. Tap “Add to cart” and follow an **event**, a record of that action, along this path:

**Mobile app → SDK → API → backend → analytics dashboard**

1. **Mobile app:** Nova is the shopping interface where you view a product and tap “Add to cart.”
2. **SDK (software development kit):** The analytics code added to the app records your action as an event and sends it onward.
3. **API (application programming interface):** A defined entry point receives the event sent by the SDK.
4. **Backend:** The software running on a server checks the event and stores it.
5. **Analytics dashboard:** A screen displays the recorded action so you can see that it arrived.

### Diagnostic Flow — Find what broke

Use the same system with one layer intentionally broken. Shopping still works, but the actions are missing from the analytics dashboard.

You can inspect the evidence yourself or ask the **Integration Copilot**, an AI assistant that uses tools to read what the system reports. Check the **SDK state** to see whether the analytics code is ready, read **logs** that record system activity and errors, inspect **API behavior** through requests and responses, and trace **event delivery** to see where an action stopped.

The first planned failure is an SDK that was never started, or **initialized**. Once you find the root cause, apply the fix and repeat the actions. **Validation** means checking that those fresh events successfully reach the dashboard; applying a fix alone does not prove it worked.

### Why this exercise exists

The goal is to show how I approach a technical product problem end to end: understanding the user workflow, designing the system, working across SDKs and APIs, using AI for diagnosis, and validating that the solution actually works.

## Planned live experience

The entry page will explain the problem and open a browser simulation of Nova, a fictional commerce company. The user can view one fictional product and add it to a cart. A debugging dashboard will show expected events, SDK tracking attempts, ingestion outcomes, and runtime logs.

The Integration Copilot will explain its diagnosis through visible tool names, sanitized arguments, tool results, and evidence references. The interface will distinguish “diagnosed,” “fix applied,” and “validated.” It will not equate a confident answer with a working integration.

An “Under the Hood” view will expose architecture, event schemas, actual request/response details, the diagnostic tool contract, and versioned evaluation reports when available. It will identify the browser simulation and link to the future native SwiftUI app and `NovaAnalyticsSDK` reference implementation.

Progressive disclosure should keep the main flow understandable while allowing reviewers to inspect raw evidence. Keyboard-accessible controls, labeled status changes, and status text independent of color are part of the planned web experience.

## First vertical slice

Scenario identifier: `sdk_not_initialized`. Event names: `product_viewed` and `product_added_to_cart`.

The new session starts with the modeled SDK uninitialized. Demo consent is explicitly granted, and the environment is configured for working ingestion; those conditions are scenario setup, not proof that the agent has tested every downstream layer.

| Step | User or system action | Observable result |
| --- | --- | --- |
| 1 | User opens the Nova simulation | A new isolated session starts with a baseline run |
| 2 | User views the fictional product | Commerce action succeeds; `product_viewed` is expected |
| 3 | User adds the product to cart | Cart changes; `product_added_to_cart` is expected |
| 4 | SDK model processes both tracking calls | Both are dropped with `SDK_NOT_INITIALIZED`; no ingestion request is made |
| 5 | Dashboard reads session evidence | Two expected events, two dropped attempts, zero ingested events |
| 6 | User asks why the events are missing | Copilot begins a diagnostic turn |
| 7 | Agent calls `get_sdk_state` | Trace shows the named function and its result |
| 8 | Tool returns current state | `initialized=false`, source, version, timestamp, and correlated attempt evidence |
| 9 | Agent diagnoses the failure | Explains that tracking occurred before initialization; cites evidence; recommends initialization before tracking |
| 10 | User selects “Apply demo fix” | Backend initializes this session's SDK model and records the change |
| 11 | User runs validation | A new run repeats the product-view and add-to-cart actions with fresh IDs through the same tracking path |
| 12 | Ingestion and validation complete | Two events are stored; dashboard shows HTTP outcomes and check results; original failure remains visible |

The demo fix changes simulated runtime configuration. It does not edit native source code. The later SwiftUI reference will demonstrate the corresponding initialization placement in an actual app lifecycle.

## Scope and exclusions

The first slice includes one product, two commerce actions, one reproducible incident, explicit diagnostics, user-controlled remediation, persistent evidence, and deterministic validation. Live AI is a separate milestone after the non-AI flow works.

Later scope includes the native app and SDK, browser/native contract parity, live agent evaluations, and a hosted experience. Additional incidents covering application instrumentation, authentication, consent, schema errors, delivery, and backend failure remain backlog candidates until the first slice is complete.

Checkout, payments, real customer data, production analytics scale, autonomous code repair, multi-agent orchestration, and integrations with real analytics vendors are outside the initial scope. No employer materials or private system designs are source material for the project.

## Product principles

1. **Evidence over magic.** Every diagnosis should identify observable facts and their sources.
2. **Diagnose before fixing.** Locate the failure before recommending a change.
3. **Explicit tools.** Retrieve system state through defined functions with inspectable results.
4. **Validate after remediation.** A fix is successful only after validation passes.
5. **Progressive disclosure.** Offer a clear entry point and deeper technical inspection.
6. **Real system behavior.** Use actual HTTP states, logs, event schemas, persistence, and tests where practical.
7. **No fake production claims.** Label simulated business metrics as demo data and distinguish hypotheses from measured results.

## Measurement plan

All metrics below are proposed. There are no baseline values or observed improvements yet.

| Metric | Definition and measurement |
| --- | --- |
| Time to correct root cause | Elapsed time from the dashboard first showing missing events to the first correct diagnosis supported by observed evidence |
| Time to validated recovery | Elapsed time from that same symptom to a passing validation for fresh events |
| Diagnostic search effort | Number of distinct evidence inspections and incorrect hypotheses before a correct diagnosis; report manual and agent activity separately |
| Root-cause accuracy | Correct, evidence-backed diagnoses divided by all attempted evaluable cases; include abstentions and provider errors separately |
| Unsupported diagnosis rate | Diagnoses asserting a cause without supporting evidence divided by all diagnoses |
| False recovery rate | Claims of successful recovery without a matching passing validation divided by all recovery claims |
| Delivery recovery | Stored expected events divided by expected events in the validation run, excluding previous runs and duplicate IDs |
| Copilot latency and cost | Per-turn duration, model/tool calls, token usage, and estimated API cost using the rates recorded for that evaluation |

For the first slice, the functional acceptance target is two stored events out of two expected events after remediation, and zero false recovery claims in the defined regression set. These are acceptance criteria, not reported achievements.

For a formative comparison, give participants the same logs, configuration, and event dashboard with or without the Copilot. Use separate fresh sessions and counterbalance condition order where possible. Record experience level, task completion, incorrect fixes, and the metric timestamps. Familiarity with the incident is a confound; report it rather than treating repeat attempts as independent discoveries.

A single obvious incident cannot establish broad developer productivity gains. Use the first slice to validate instrumentation and the end-to-end workflow. Broader product conclusions require more incident types and an appropriately reported participant sample. Establish a baseline before selecting a quantitative improvement target.

## Assumptions and risks

| Assumption or risk | Design response / evidence needed |
| --- | --- |
| A browser simulation makes the workflow easy to access | Label it clearly; add a native reference before claiming native behavior |
| Backend-owned simulated state differs from an actual device | Identify evidence source; require parity fixtures and separate native verification |
| A single incident lets the agent guess | Hide scenario labels and expected answers from model input; test healthy and ambiguous cases |
| An attractive dashboard could mask fabricated behavior | Derive delivery status from attempts and stored events; preserve request IDs and failures |
| OpenAI access or cost limits may interrupt a session | Keep manual diagnosis and validation usable; show live-provider errors; never silently substitute a mock |
| SQLite may constrain a future deployment | Start with one service instance and local persistent storage; revisit before scaling |
| Native verification needs an Apple build environment | Schedule macOS/Xcode verification explicitly; do not imply Windows-only checks prove iOS execution |

Technical decisions and revisit triggers are recorded in [product decisions](product-decisions.md). Milestone acceptance is defined in the [build plan](build-plan.md).
