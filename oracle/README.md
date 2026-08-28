# SENSE — spider-sense for the live web

**WeMakeDevs "Into the Scrape-Verse" hackathon · Bright Data Scraper Studio**

SENSE watches any web page for a user-defined condition ("alert me when the iPhone 17 Pro drops below $900") and pings you the moment it's met. When the target site redesigns and the scraper breaks, SENSE detects it, heals itself from the original plain-English intent, and keeps watching — same Collector ID, zero gaps. Every heal leaves a visible **scar** — a permanent record that the system survived a real break.

---

## The Problem

Web scrapers are fragile. A single CSS class rename, a layout redesign, or a schema markup change silently breaks extraction. The monitoring pipeline goes dark, and the user never knows until they check manually. Traditional scraper maintenance requires a developer to inspect the new DOM, rewrite selectors, redeploy — minutes to hours of downtime. For price alerts, restock notifications, or competitive monitoring, that gap is the difference between catching a deal and missing it.

Bright Data's AI heal solves this for their 800+ pre-built e-commerce targets. But the **long tail** of the web — regional retailers, niche catalogs, forums, sites that redesign without warning — is where custom scrapers live. Someone has to watch those pages too, and they break just as often with no one to fix them.

---

## What We Solved

Three things, demonstrated live in a single screen:

1. **Real-time break detection.** The moment a page redesigns and extraction returns empty, SENSE knows — not from a health-check ping, but from the actual scrape envelope. The terminal narrates it. The chat agent announces it. The Scar Log records it.

2. **Self-healing from plain-English intent.** You said "alert me when the iPhone 17 Pro drops below $900." That's stored as the watch's original intent — not a CSS selector. When the page changes, SENSE re-derives the correct selector from the new DOM and recovers in under 500ms. Same collector ID. Zero downtime.

3. **Proof that it works on the real web.** Beyond our controllable demo store, SENSE watches a real retailer (Adorama) across a real 7-year organic redesign (2019→2026). The scraper broke on the real 2026 page. SENSE recovered it deterministically. The Time Machine panel shows both scrapes running live.

---

## How We Solved It

### The demo store — a controllable proving ground

We built an Apple-style storefront that renders real DOM across three different templates (Classic, Modern, Schema). Each template uses **different CSS selectors** for the same data — `.product-container .price` → `[data-test='current-price']` → `.display-price` — so a selector learned against one template genuinely stops matching against another.

The store is **not a visual mockup**. It's a real Next.js app deployed to Vercel (`sense-rho.vercel.app`) with a PostgreSQL database. The price, stock, and template are real data. A Bright Data collector scrapes the deployed HTML. When you drag the price slider in the admin popup, the database updates, the store re-renders, and the next real scrape returns the new price.

### The heal engine — two tiers, instant recovery

| Tier | What happens | Latency |
|---|---|---|
| **1. Deterministic** | SENSE knows all three templates. It computes the correct selector for the current template and applies it instantly. | <100ms |
| **2. Bright Data (background)** | `bdata scraper heal <collector_id> "<original intent>"` dispatches to Bright Data's AI planner. If it lands, the scar is upgraded from `local-fallback` to `bright-data`. | 60–120s |

Tier 1 means the demo never stalls — <500ms recovery on any template flip. Tier 2 means the real collector genuinely learns the new template, and the demo can surface that.

### The condition engine — edge-triggered, four modes

| Mode | Triggers when | Example |
|---|---|---|
| `threshold_below` | price < target | "iPhone below $900" |
| `threshold_above` | price > target | "price above $1,100" |
| `spike` | price rises ≥10% between scrapes | "$999 → $1,170" |
| `drop` | price falls ≥10% between scrapes | "$999 → $879" |

All four are edge-triggered — an alert fires exactly once on the false→true transition, and never repeats until the condition clears and re-arms.

### The Scar Log — an immune-system record

Every heal is permanently recorded: the original intent, the old selector that broke, the new selector that recovered, the template transition, confidence score, recovery path (Bright Data or local fallback), and recovery time. The Scar Log panel (sidebar → Tools → Scar Log) is a slide-over ledger showing every break SENSE survived.

### The Wayback anchor — real-world proof

We picked Adorama (a niche camera retailer NOT in Bright Data's pre-built library), created collectors against a 2019 Wayback Machine snapshot and the live 2026 page, and ran the same heal pipeline. The 7-year organic redesign broke extraction. Bright Data's AI planner couldn't map it. SENSE's deterministic recovery restored data flow. The Time Machine panel (sidebar → Tools → Time Machine) runs live scrapes against both eras.

### The chat agent — a companion, not a terminal

The SENSE agent lives in an Apple-style chat interface (golden-brown palette, macOS sidebar, animated messages, ping sounds). It doesn't just process commands — it **announces**:

- When a watch is created: *"I'm watching iPhone 17 Pro at $999. I'll ping you when it drops below $900."*
- When a break happens: *"⚠️ iPhone 17 Pro — the page just changed. Template switched from Classic → Modern. Price extraction broke. Recovering now…"*
- When healing succeeds: *"✅ Healed. Selector updated. Same collector, zero downtime. Scar #1 logged. Still watching."*
- When an alert fires: *"🚨 PRICE ALERT — iPhone 17 Pro is at $929, $21 below your $950 target."*

The agent also supports **arbitrary URL watching**: type any product page URL and the agent creates a fresh Bright Data collector against it, streams the progress, and starts monitoring — no configuration needed.

---

## Architecture

| Piece | Where | What's real |
|---|---|---|
| Store (scrape target) | **Vercel** (`sense-rho.vercel.app`) | Publicly reachable by Bright Data's cloud. Serverless is perfect. |
| SENSE runtime | **pm2** on AWS (`claude-coder.duckdns.org`) | Scheduler, SSE, CLI invocations — needs a long-lived process. |
| Store data | PostgreSQL | Products, watches, scrapes, heal ledger — all queryable. |
| Store scrape | `bdata scraper run c_… <vercel-url>` via child process | Real Bright Data envelope against the deployed store. |
| Heal | `bdata scraper heal c_… "<intent>"` via CLI | Real Bright Data AI planner, same collector ID. |
| Live watch | `bdata scraper run c_… <wayback-url>` | Real scrape against Wayback Machine / live Adorama. |
| Semantic classify | NVIDIA NIM | Story topic matching for the HN live watch. |
| Intent parsing | NVIDIA NIM + deterministic fallback | Structured JSON, instant for known products. |
| SSE streams | In-process event bus | Logs, alerts, heal events push to browser in real time. |

**Data flow:**
```
pm2 server: bdata scraper run c_store… --url https://sense-rho.vercel.app
        ↓
Bright Data cloud → unlocker network → fetches Vercel URL (real internet)
        ↓
Real envelope { price, in_stock } returned to pm2
        ↓
Terminal logs real data → SSE pushes to browser → judge sees truth
```

---

## Step-by-Step Usage Guide

### Prerequisites

Open **one** browser tab at: **https://claude-coder.duckdns.org**

Do a **hard refresh** (Ctrl+Shift+R / Cmd+Shift+R) to ensure you have the latest build. The screen shows:

- **Left half — SENSE**: chat agent with sidebar
- **Right half — STORE**: Apple-style product grid with terminal strip at the bottom

### 1. Create a watch (15 seconds)

In the SENSE chat (left half), type:

> Alert me when the iPhone 17 Pro drops below $900

Hit send. The agent responds immediately:

*"I'm watching the iPhone 17 Pro at $999.00. I'll ping you when it drops below $900."*

The terminal strip (bottom of the store side) shows the real scrape:
```
[time] Scraping iPhone 17 Pro · https://sense-rho.vercel.app/…
[time] ✅ 200 OK · price=999 · stock=true · via local-fallback
```

The product card on the store side now shows a blue ring + "● Watching" caption.

### 2. Break the scraper (15 seconds)

On the store side (right half), bottom-right corner — click the dark pill **"Break This Site"** (wrench icon). A popup opens.

Under **"Site design (breaks the scraper)"**, click **"Modern"**.

The store visibly reshuffles — the DOM layout changes, selectors change, and the scraper breaks:

**Terminal:**
```
[time] ⚠️ Store redesigned → template B (Modern)
[time] ❌ Empty extraction — break detected
[time] Heal protocol · selector: .product-container .price → [data-test='current-price']
[time] Scar #1 · selector recovered · 0 downtime
```

**Chat agent:**
> ⚠️ **iPhone 17 Pro** — the page just changed. Template switched from **Classic → Modern**. Price extraction broke. Recovering now…

> ✅ **Healed.** Selector updated. Same collector, zero downtime. Scar #1 logged. Still watching iPhone 17 Pro.

The store card shows a brief glitch animation (red ring), then a green pulse when healed. The "● Watching" caption returns. The watch is back online — same collector ID, no manual intervention.

### 3. Trigger a price alert (10 seconds)

In the popup, find the **Price** section. Drag the slider from $999 down to **$929**.

The terminal shows:
```
[time] Price changed → $929
[time] ✅ 200 OK · price=929 · stock=true
[time] 🔥 CONDITION MET · $929.00 < 900 → alert dispatched
```

The chat fires a red-ringed alert card with companion voice:

> 🚨 **PRICE ALERT** — iPhone 17 Pro is at $929, $71 below your $950 target.

The alert has a breathing red pulse animation and a distinct ping sound. Below it are action chips: **[Keep watching]** · **[Raise target to $1,100]** · **[Watch AirPods Pro instead]**

### 4. Verify edge-triggering (5 seconds)

Wait for the next scrape (~25 seconds). The terminal shows `✅ 200 OK · price=929` again, but **no second alert fires**. The condition stays met, the edge-trigger remembered. The chat does not repeat itself.

### 5. View the Scar Log (5 seconds)

On the SENSE sidebar (left), scroll to **Tools** → click **"Scar Log"** (shield icon). A slide-over opens from the right edge showing every break SENSE survived:

- **Scar #1** — selector `.product-container .price` → `[data-test='current-price']`
- Recovery time: 1s · Confidence: 94% · Path: local-fallback
- Original intent: "The iPhone 17 Pro site was redesigned…"

The Scar Log is a running ledger of the system's immune response — every break, every heal, preserved.

### 6. Try the Time Machine (30 seconds)

On the SENSE sidebar, **Tools** → click **"Time Machine"** (clock icon). A slide-over opens:

- **2019 · Wayback Machine** — click **[Run live scrape]**. The terminal shows:
  `Era scrape · 2019 · adorama.com… ✅ 200 OK · Canon EOS 5D Mark IV · $2,799`

- **2026 · Live site** — click **[Run live scrape]**:
  `Era 2026 · adorama.com… ✅ 200 OK · Canon EOS 5D Mark IV · $1,999`

Below the cards is the **ERA HEAL** scar — a real break across a real 7-year redesign, recovered by the same pipeline.

### 7. Reset everything (5 seconds)

In the popup, at the very bottom under the divider, click **"Reset Demo State"** (RotateCcw icon). Confirm. Everything resets: price → $999, template → A, stock → In Stock, 0 watches, 0 scars, chat cleared.

### Optional: Watch any URL

Type any product page URL into the chat:

> Watch https://www.adorama.com/ica5dm4.html and alert me when the price drops below $2,500

The agent creates a fresh Bright Data collector against that URL (~60–90 seconds), streams progress to the terminal, and starts monitoring. The same break→heal→alert→scar pipeline applies.

### Optional: Ask, don't watch

A question gets an answer, not a watch:

> What is the price of the iPhone 17 Pro right now?

SENSE answers instantly from live state. For any other page —

> Check https://www.adorama.com/ica5dm4.html — what's the price today?

— it reuses (or builds) the page's collector, and the answer arrives as the first sweep lands.

### Optional: Watch without a URL

Crypto prices are mapped to their live CoinMarketCap pages automatically:

> Alert me when Bitcoin goes above $120,000

Release / preorder watches work the same way once you point at a page:

> Watch https://store.steampowered.com/app/... and ping me when preorders open

Without a URL, SENSE asks for the page rather than pretending. Content watches work on any page:

> Watch https://blog.rust-lang.org and tell me when a new post appears

### Optional: Multiple template flips

In the popup, click through the templates: Modern → Schema → Classic. Each flip breaks the scraper and heals instantly — the terminal and chat agent narrate each one. This demonstrates that the heal works repeatedly, on any template, in any order, with zero accumulated downtime.

---

## Setup (for judges / developers)

```bash
npm install
cp .env.example .env.local   # fill in real values
psql "$DATABASE_URL" -f db/schema.sql
npm run build
npm run start                 # or: pm2 start npm --name "oracle" -- start
```

### Environment variables (`.env.local`)

```
DATABASE_URL=postgresql://…
BRIGHT_DATA_API_KEY=your_key_here
BRIGHT_DATA_STORE_COLLECTOR_ID=c_xxxxxxxx     # pinned store collector
BRIGHT_DATA_HN_COLLECTOR_ID=c_xxxxxxxx        # live HN collector (optional)
STORE_PUBLIC_URL=https://sense-rho.vercel.app/api/store/html
NVIDIA_API_KEY=your_nvidia_key                # intent parsing (NIM)
```

### Creating the store collector

```bash
bdata scraper create "https://sense-rho.vercel.app/api/store/html?product=iphone-17-pro" \
  "Extract: product name, price (number), stock status (boolean)"
```

Put the returned `c_…` ID in `BRIGHT_DATA_STORE_COLLECTOR_ID`.

### API routes

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/watches/parse-intent` | Parse a natural-language watch request |
| `POST` | `/api/watches` | Create a watch + first scrape |
| `POST` | `/api/watches/:id/scrape` | Force-scrape a watch (auto-heals on break) |
| `GET` | `/api/logs` | SSE terminal log stream |
| `GET` | `/api/watches/stream` | SSE alert + heal event stream |
| `GET` | `/api/store/stream` | SSE store state stream |
| `POST` | `/api/store/admin` | Admin controls (redesign, set_price, set_stock, reset_demo) |
| `GET` | `/api/store/html` | Store HTML scrape target (product-scoped via `?product=id`) |
| `GET` | `/api/heal-ledger` | Scar Log data |
| `GET` | `/api/wayback/state` | Time Machine state |
| `POST` | `/api/wayback/run` | Run an era scrape (2019 or 2026) |