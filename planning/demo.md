# FinAlly Demo Runbook

## Demo Objective

- Demonstrate that FinAlly delivers a live, AI-assisted trading workstation experience from a simple startup flow.
- Prove core product value: real-time market updates, instant simulated trading, and assistant-guided actions in one interface.
- Show that current implementation is already strong enough for a reliable course/demo presentation.

## Audience

- Course instructors, peers, and technical reviewers evaluating product clarity and execution quality.
- Anyone who should quickly understand what FinAlly is, what works today, and why the architecture is practical.

## What This Demo Proves

- Live market data is continuously available (simulator by default, optional real-data mode).
- Portfolio state updates immediately after trades (cash, positions, and valuation behavior).
- AI chat can provide contextual trading assistance and can drive meaningful user workflows.
- The backend market-data subsystem is complete, tested, and integrated as a reusable foundation.

## Skills To Use For This Demo

- `cerebras`: use for the AI assistant integration path (LiteLLM + OpenRouter + Cerebras provider) and any demo-time LLM behavior refinements.
- `frontend-design`: use for polishing visual quality, layout density, and trading-terminal style before demo day.
- `feature-dev`: reserve for structured feature implementation work that may be needed before the final demo pass.
- `find-skills`: use to discover and evaluate additional installable skills when new demo/development needs appear.

### Skill Availability Note

- `cerebras` is available in this repository skill set.
- `frontend-design` and `find-skills` are available in the broader local skill environment.
- `feature-dev` is listed here as a desired workflow skill; if it is not installed locally, use `find-skills` to locate an equivalent or install it.

## Prerequisites

### Environment

- Project repository is available locally.
- Docker is available for the one-command startup flow (preferred demo mode).
- `.env` exists at project root.

### Key Runtime Settings

- `OPENROUTER_API_KEY` set for live AI behavior.
- `MASSIVE_API_KEY` optional:
  - empty or unset -> simulator mode (recommended default for consistency)
  - set -> real market data mode (optional enhancement)
- Optional test mode: `LLM_MOCK=true` when deterministic AI responses are needed.

### Pre-Demo Validation (5-10 minutes before session)

- Confirm app starts and loads without manual database setup.
- Confirm prices are updating on the watchlist shortly after load.
- Confirm one buy and one sell action succeed.
- Confirm AI chat returns a response.
- Confirm fallback path is ready (LLM mock and simulator mode).

## Demo Formats

## 1) Quick Demo (3-5 min)

- Goal: show product identity and one complete user loop.
- Sequence:
  1. Launch app and orient the UI.
  2. Show live price movement.
  3. Execute one manual trade.
  4. Ask AI for one portfolio/trade suggestion.
  5. Close with architecture headline.

## 2) Standard Demo (8-10 min) - Recommended

- Goal: full narrative from launch to AI-assisted workflow with reliability framing.
- Sequence:
  1. Launch + UX overview.
  2. Real-time market behavior and connection semantics.
  3. Manual trading loop (buy + sell).
  4. Portfolio interpretation (cash/positions/P&L behavior).
  5. AI copilot interaction and action confirmation.
  6. Architecture and implementation credibility close.

## 3) Deep Dive Demo (15 min)

- Goal: include technical rationale and source-switch story (simulator vs Massive).
- Adds:
  - environment-variable source switching explanation
  - market subsystem status/testing callouts
  - more detailed Q&A around design choices (SSE, SQLite, single-container)

## Standard Demo Script (8-10 Minutes)

## Step 1 - Launch and Orientation (1-2 min)

### Presenter Actions

- Start the project using the established startup path.
- Open `http://localhost:8000`.
- Point out key areas: watchlist, trade controls, portfolio/positions views, chat panel.

### Talking Track

- "FinAlly is an AI trading workstation demo: live prices, instant simulated trading, and an AI copilot in one interface."
- "The first-run experience is designed to be simple: launch and interact immediately."

### Proof Point

- Product vision from `PLAN.md`: a single, cohesive trading-terminal style UX with AI assistance.

## Step 2 - Show Live Market Behavior (1-2 min)

### Presenter Actions

- Keep focus on watchlist updates.
- Call out directional moves and continuous feed behavior.
- Optionally switch selected ticker to show detail context.

### Talking Track

- "Prices are continuously updated and surfaced in real time."
- "By default, FinAlly uses a realistic simulator; if configured, it can switch to real data without changing downstream flows."

### Proof Point

- Market subsystem architecture and status from `MARKET_DATA_SUMMARY.md`: shared interface, shared cache, SSE endpoint, complete/tested subsystem.

## Step 3 - Execute Manual Trade Loop (2 min)

### Presenter Actions

- Enter a known ticker and quantity.
- Execute one buy trade.
- Show immediate changes in cash and positions.
- Execute one sell trade (partial or full) and show updated state.

### Talking Track

- "Trades are market-order style and execute instantly in this simulated environment."
- "The key behavior is immediate portfolio state transition after each action."

### Proof Point

- UX/behavior contract in `PLAN.md`: instant fills, no unnecessary friction, portfolio feedback loop.

## Step 4 - AI Copilot Flow (2-3 min)

### Presenter Actions

- Ask AI for a concise portfolio analysis.
- Ask for a concrete next action (trade idea or watchlist management suggestion).
- If applicable, demonstrate AI-triggered action confirmation in UI flow.

### Talking Track

- "The assistant is context-aware: it reasons over portfolio/watchlist context and supports action-oriented workflows."
- "This is not generic chat; this is a trading-assistant experience inside the workstation."

### Proof Point

- `PLAN.md` LLM workflow: context-informed assistant behavior with structured action pathways.

## Step 5 - Close: Why This Is Reliable (1 min)

### Presenter Actions

- End with a concise architecture and readiness statement.

### Talking Track

- "FinAlly keeps the stack simple: one cohesive app experience, clear market-data abstraction, and a tested backend market subsystem."
- "This allows predictable demos and fast iteration without sacrificing realism."

### Proof Point

- `MARKET_DATA_SUMMARY.md`: complete subsystem, strong test coverage, clear module boundaries.

## Fallback Paths (Demo Reliability)

## Fallback A - AI Provider Unavailable

- Symptom: chat call fails or times out.
- Action:
  - switch to deterministic mode with `LLM_MOCK=true` (if available in run context), or
  - proceed with manual trading + market-data narrative and explain AI integration path briefly.
- Presenter line:
  - "AI service is optional for this segment; core trading and live market flows remain fully demoable."

## Fallback B - Real Market API Not Available

- Symptom: missing/invalid `MASSIVE_API_KEY` or rate-limit issues.
- Action:
  - run in simulator mode (default) and continue the full demo.
- Presenter line:
  - "Simulator mode is the default and intentionally designed for stable demos while preserving realistic price behavior."

## Fallback C - UI/Network Refresh Issue

- Symptom: stale screen or missed updates.
- Action:
  - refresh browser and re-run one quick buy/sell action to re-anchor confidence.
- Presenter line:
  - "Let’s quickly re-establish state and continue the same user flow."

## Fallback D - Time Compression

- If running short on time, keep only:
  1. Launch/orientation
  2. One trade
  3. One AI prompt
  4. 30-second architecture close

## Demo Checklist

## Before Demo

- `.env` values confirmed for chosen mode.
- App launch path verified.
- Browser tab pre-opened.
- One rehearsal run completed.
- Fallback mode selected in advance (simulator + optional LLM mock).

## During Demo

- Narrate one proof point per step (avoid feature dumping).
- Keep trade inputs simple and deterministic.
- Keep AI prompt concise and outcome-focused.
- Watch time and switch to compressed format if needed.

## After Demo

- Invite Q&A on architecture and roadmap.
- Clarify what is complete now vs planned next.
- Capture audience feedback for next demo iteration.

## Suggested Presenter Prompts

- "Give me a concise portfolio risk summary."
- "Suggest one conservative trade and explain why."
- "Add one ticker I should monitor and explain the rationale."

## Questions / Open Decisions

- Should the default live demo mode always force simulator data, even when `MASSIVE_API_KEY` exists, to maximize consistency?
- Should the official demo script assume live AI (`OPENROUTER_API_KEY`) or default to `LLM_MOCK=true` for deterministic behavior?
- Do you want the standard demo to include explicit architecture callouts (SSE/cache/source abstraction), or keep it product-first and discuss architecture only in Q&A?
- Should this runbook also include exact startup commands per OS in a follow-up revision, or stay intentionally command-light and presenter-focused?

## Notes For Next Revision

- If requested, add a command appendix for macOS/Linux/Windows startup and stop flows.
- If requested, add a timed 10-minute spoken script variant with exact wording.
- If requested, add a "judge/investor" version emphasizing outcomes over technical details.
