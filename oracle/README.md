# SENSE — spider-sense for the live web

**WeMakeDevs "Into the Scrape-Verse" hackathon · Bright Data Scraper Studio**

SENSE watches a page for a user-defined condition ("alert me when this drops below $949") and pings the moment it's met. When the target site redesigns, SENSE detects the break, heals its own scraper from the original plain-English intent, and keeps watching — same Collector ID, zero gaps. Every heal leaves a visible **scar**.

The demo is a single screen, split in two:

- **LEFT — SENSE**: an Apple-style chat — macOS sidebar (New Chat, Chats, Tools, profile) plus a conversation pane with quick-action cards and an iOS-style composer.
- **RIGHT — STORE**: an Apple-style storefront (nav, "New season. Elevated." hero, benefits, a five-product grid). Every product card has a **Watch** button — watch any product, not just the iPhone — which selects it into the live store and opens its product page. A floating **"⚙ Break This Site"** button opens demo controls: redesign the page, move the price, toggle stock, toggle bot detection.
- **BOTTOM — TERMINAL**: the live collector log, styled as a dark macOS terminal — every scrape, break, heal, and alert streams here via SSE.

Beyond the controllable store, SENSE also runs a **live watch on a real site**: say "alert me when an AI-agents story hits the top 5 on Hacker News" and a real Bright Data collector (`c_mt443qoyivn3opd1i`) scrapes the real front page every few minutes, an NVIDIA NIM model classifies which stories match your topic semantically (no selector could do this), and the same condition/alert engine fires. Real URL, real scrapes, real latency.

**The rule above all rules: no simulations.** The store's price lives in a real `products` table in PostgreSQL. The store UI fetches it from `/api/products/active` and subscribes to `/api/store/stream` (SSE). The scraper is a **real Bright Data collector** running against the **deployed public store URL** (`https://sense-rho.vercel.app/api/store/html`) — the terminal's `200 OK · price=…` line is parsed from Bright Data's real envelope, not a local regex. When the price changes in the popup, the database changes, the store UI updates, and the next real scrape returns the new price.

**Architecture (the correct production topology):**

| Piece | Where it lives | Why |
|---|---|---|
| Store (scrape target) | **Vercel** (`sense-rho.vercel.app`) | Must be publicly reachable by Bright Data's cloud. Stateless, so serverless is perfect. |
| SENSE runtime (scheduler, SSE, CLI invocations) | **pm2 long-lived process** | `setInterval` dies in serverless functions; SSE breaks across instances. pm2 keeps one process alive. |

The pm2 server runs `bdata scraper run c_… <vercel-url>` → Bright Data's cloud → unlocker network → fetches the Vercel store → returns a real envelope with price/stock → the terminal logs real data → SSE pushes to the browser.

---

## Setup

```bash
npm install
cp .env.example .env.local   # fill in real values
psql "$DATABASE_URL" -f db/schema.sql   # create tables (idempotent)
npm run build
npm run start
```

### Environment variables (`.env.local`)

```
DATABASE_URL=postgresql://...
BRIGHT_DATA_API_KEY=your_key_here
BRIGHT_DATA_SERP_ZONE=your_zone_here    # optional: live SERP search features
BRIGHT_DATA_COLLECTOR_ID=c_xxxxxxxx     # optional: production collector
BRIGHT_DATA_STORE_COLLECTOR_ID=c_xxxxxxxx  # the store page's real collector
STORE_PUBLIC_URL=https://sense-rho.vercel.app/api/store/html  # deployed URL the collector scrapes
BRIGHT_DATA_HN_COLLECTOR_ID=c_mt443qoyivn3opd1i  # the live Hacker News collector (Phase A)
NVIDIA_API_KEY=your_nvidia_key          # intent parsing + live story classification (NIM)
NVIDIA_API_KEY_2=your_backup_key        # fallback key
OPENROUTER_API_KEY=your_key_here        # optional fallback
```

### Real Bright Data scrape + heal (production path)

Create a collector against the **deployed public store URL** once (never localhost —
Bright Data's cloud cannot reach it):

```bash
bdata scraper create "https://sense-rho.vercel.app/api/store/html" \
  "Extract the active product card: its price (number, e.g. 999) and stock status (in_stock boolean — true when the page shows In Stock). Return JSON: price (number), in_stock (boolean)."
```

Put the returned `c_…` ID in `BRIGHT_DATA_STORE_COLLECTOR_ID`. When it's set:

- **every scrape** runs `bdata scraper run <collector_id> <vercel-url> --json` via
  child process (no shell) — the real envelope (`[{ price, in_stock, … }]`) is
  parsed into the watch's value. The terminal's `200 OK · price=…` line is
  **Bright Data's truth, not a local render**.
- **break detection** is real: when a template redesign breaks the collector's
  learned extraction rules, the envelope's price degrades to `0` — that's the
  honest break signal (`selector-stale`).
- **heals genuinely run** `bdata scraper heal <collector_id> "<original intent>"`
  via the CLI (`--auto-approve --auto-save`), and the CLI's output is surfaced
  in the terminal + scar log. Same collector ID across heals.
- if the CLI fails or times out, the heal falls back to deterministic
  re-derivation so the demo never stalls (same semantic action).
- if **no collector is configured**, the scrape falls back to the old
  in-process render — but it is clearly labelled `via local-fallback` in the
  terminal and never silently pretends to be the real run.

### The live watch — a real site, real scrapes (Phase A)

SENSE also watches a **real, fast-moving public URL**: Hacker News. This is the
part a skeptical judge can poke — nothing about it is on our server.

- **Collector**: `BRIGHT_DATA_HN_COLLECTOR_ID` (`c_mt443qoyivn3opd1i`), created
  with `bdata scraper create https://news.ycombinator.com "Extract the top
  stories …"` and runnable in your Bright Data dashboard.
- **Scrape**: `lib/live.ts` → `bdata scraper run <collector_id> <url> --json`
  via child process (no shell). HN exceeds the realtime page limit, so runs go
  through Bright Data's **async batch mode**: each scrape is a submitted job
  polled to completion, **~2–3 min per job** — that's the real latency SENSE
  reports, not a made-up interval.
- **Real envelope shape** (captured 2026-08-22):
  ```json
  [{ "stories": [{ "title": "…", "url": "…", "points": 123, "comment_count": 45 }],
     "product_page_url": "https://news.ycombinator.com", "input": { "url": "…" } }]
  ```
  The collector does not yet return the front-page `rank`, so rank is derived
  as **position by points, descending** — an honest prominence proxy. When the
  collector returns a `rank` field (after a successful heal), it's honoured
  verbatim.
- **Semantic condition**: the "top N" condition is evaluated by an NVIDIA NIM
  model — `classifyStoryRanks()` asks which of the top 10 story titles relate
  to the topic and returns the matching integer ranks (a selector-based monitor
  literally cannot do this). Verified live: "OpenRouter is joining Stripe" was
  classified as an AI story at rank 6, correctly *not* alerting a top-5 watch.
- **Shared engine**: the diff, condition evaluation (`<=` vs `target`), alert
  stream, and Scar Log are the exact same code as the store path — only the
  "fetch" differs (`scrapeLiveWatch` vs `scrapeStore`). The store isn't a
  simulation of the pattern; it's a controllable instance of it.

---

## The 90-second demo script

1. **In SENSE chat, type:**
   `Watch the iPhone 17 Pro and alert me when it drops below $949`
   → SENSE parses intent (NVIDIA NIM), creates a watch with a real collector ID
   (`c_…` visible on the card), runs the first real scrape: **"Currently $999."**

2. **Click ⚙ Break This Site → Redesign.**
   The store's DOM completely changes (template A→B). The watch's selector no
   longer exists in the markup. The terminal narrates:
   `❌ Empty extraction — break detected` → `Heal protocol · intent: "…"`
   → `✅ Healed · price now at .pricing-section [data-test='current-price']`
   → `Scar #1 · zero downtime downstream`. Status: **Healed**, scar count 1.

3. **Drag the price slider below $949 (e.g. to $929).**
   The store UI updates live (SSE). The next scrape returns $929.
   `CONDITION MET: $929 < 949 → alert dispatched`. The chat fires the alert
   with the signature **tingle** (fast red shiver) — the one animation reserved
   for alerts.

4. **Open the Scar Log** (top bar → 🕸 Scars):
   intent used, old vs new selector, confidence (94%), recovery time. *"The
   ledger isn't a museum. It's an immune-system log."*

5. **Try Bot Detection**: toggle it on → scrapes get 403 → status **Broken**.
   Toggle off → SENSE recovers on the next check.

**The live beat (Phase A — the real web):**

6. **In SENSE chat, type:** `Alert me when an AI-agents story hits the top 5 on Hacker News`
   → SENSE creates a **live watch** on the real HN collector (`c_mt443qoyivn3opd1i`).
   The terminal shows the real Bright Data batch job submitting, polling
   (`~2–3 min`), and returning **real stories** — e.g. `149 stories · top AI match rank=6`.
   The NIM classifier decides *semantically* which stories are about your topic;
   the alert fires the moment a matching story ranks ≤ 5. You can watch this
   happen live in the dashboard while the store demo runs beside it.

A judge can do all of it unaided — every control is on screen.

---

## How it works

| Piece | Where | What's real |
|---|---|---|
| Store price | `products` table (Postgres) | One source of truth |
| Store UI | `components/StorePanel.tsx` | Fetches `/api/products` + SSE |
| DOM redesign | `lib/store.ts` (templates A/B/C) | Real markup change, different selectors |
| Store scrape | `lib/scraper.ts` → `bdata scraper run` | Real Bright Data envelope against the deployed Vercel store URL |
| Live scrape | `lib/live.ts` + `bdata scraper run` | Real Bright Data batch job against real HN (~2–3 min) |
| Semantic classify | `lib/live.ts` + NVIDIA NIM | Which story ranks match the topic ("top N" condition) |
| Break | selector no longer matches | Empty extraction |
| Heal | `lib/heal.ts` + `bdata scraper heal` | Real Bright Data CLI heal, same collector ID, logs scar |
| Alerts | `lib/stream.ts` + SSE | Condition evaluation → chat tingle |
| Intent parsing | `lib/agent.ts` + NVIDIA NIM | Structured JSON, deterministic fallback |

### API routes

- `POST /api/watches/parse-intent` — NIM LLM → live intent `{ kind: "live", topic, rank }` (HN "top N") or store intent `{ kind: "store", product_name, target_price, condition, field }`
- `POST /api/watches` — create watch (body `source: "store" | "live"`) + first real scrape
- `POST /api/watches/:id/scrape` — trigger scrape (auto-heals on break)
- `POST /api/watches/:id/heal` — manual heal
- `GET /api/logs` — SSE terminal log stream
- `GET /api/watches/stream` — SSE alert stream
- `GET /api/store/stream` — SSE store state stream
- `POST /api/store/admin` — redesign | set_price | set_stock | set_bot_detection
- `GET /api/products/active` — store state (JSON)
- `POST /api/watches/quick` — select a featured product + create a watch (the Watch buttons)
- `GET /api/store/html` — store HTML representation (scrape target)
- `GET /api/heal-ledger` — the Scar Log

The scheduler (`lib/scheduler.ts`) ticks every ~20s and scrapes due watches, so
breaks and alerts also happen live with nobody clicking.
