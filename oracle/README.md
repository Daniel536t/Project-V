# SENSE — spider-sense for the live web

**WeMakeDevs "Into the Scrape-Verse" hackathon · Bright Data Scraper Studio**

SENSE watches a page for a user-defined condition ("alert me when this drops below $800") and pings the moment it's met. When the target site redesigns, SENSE detects the break, heals its own scraper from the original plain-English intent, and keeps watching — same Collector ID, zero gaps. Every heal leaves a visible **scar**.

The demo is a single screen, split in two:

- **LEFT — SENSE**: an AI chat. You tell it what to watch; it confirms with the live price.
- **RIGHT — STORE**: a premium product page for the Sony A7IV. A floating **"⚙ Break This Site"** button opens demo controls: redesign the page, move the price, toggle stock, toggle bot detection.
- **BOTTOM — TERMINAL**: the live collector log — every scrape, break, heal, and alert streams here via SSE.

**The rule above all rules: no simulations.** The store's price lives in a real `products` table in PostgreSQL. The store UI fetches it from `/api/products/sony-a7iv` and subscribes to `/api/store/stream` (SSE). The scraper fetches the store's rendered HTML (`/api/store/html`) and extracts the price with a real CSS selector. When the price changes in the popup, the database changes, the store UI updates, and the next real scrape returns the new price.

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
NVIDIA_API_KEY=your_nvidia_key          # intent parsing (NIM)
NVIDIA_API_KEY_2=your_backup_key        # fallback key
OPENROUTER_API_KEY=your_key_here        # optional fallback
```

> The demo's scrape loop is fully real against the store's own rendered HTML.
> `lib/brightdata.ts` also exposes the production Bright Data paths (`dca/trigger`,
> `bdata scraper heal` via CLI) — the heal flow here re-derives the selector from
> the original intent, which is exactly what Bright Data's heal does.

---

## The 90-second demo script

1. **In SENSE chat, type:**
   `Watch the Sony A7IV and alert me when it drops below $800`
   → SENSE parses intent (NVIDIA NIM), creates a watch with a real collector ID
   (`c_…` visible on the card), runs the first real scrape: **"Currently $899."**

2. **Click ⚙ Break This Site → Redesign.**
   The store's DOM completely changes (template A→B). The watch's selector no
   longer exists in the markup. The terminal narrates:
   `❌ Empty extraction — break detected` → `Heal protocol · intent: "…"`
   → `✅ Healed · price now at .pricing-section [data-test='current-price']`
   → `Scar #1 · zero downtime downstream`. Status: **Healed**, scar count 1.

3. **Drag the price slider to $799.**
   The store UI updates live (SSE). The next scrape returns $799.
   `CONDITION MET: $799 < 800 → alert dispatched`. The chat fires the alert
   with the signature **tingle** (fast red shiver) — the one animation reserved
   for alerts.

4. **Open the Scar Log** (top bar → 🕸 Scars):
   intent used, old vs new selector, confidence (94%), recovery time. *"The
   ledger isn't a museum. It's an immune-system log."*

5. **Try Bot Detection**: toggle it on → scrapes get 403 → status **Broken**.
   Toggle off → SENSE recovers on the next check.

A judge can do all of it unaided — every control is on screen.

---

## How it works

| Piece | Where | What's real |
|---|---|---|
| Store price | `products` table (Postgres) | One source of truth |
| Store UI | `components/StorePanel.tsx` | Fetches `/api/products` + SSE |
| DOM redesign | `lib/store.ts` (templates A/B/C) | Real markup change, different selectors |
| Scrape | `lib/scraper.ts` | Fetches rendered HTML, extracts by selector |
| Break | selector no longer matches | Empty extraction |
| Heal | `lib/sense.ts` | Re-derives selector from original intent, logs scar |
| Alerts | `lib/stream.ts` + SSE | Condition evaluation → chat tingle |
| Intent parsing | `lib/agent.ts` + NVIDIA NIM | Structured JSON, deterministic fallback |

### API routes

- `POST /api/watches/parse-intent` — NIM LLM → `{ product_name, target_price, condition }`
- `POST /api/watches` — create watch + first real scrape
- `POST /api/watches/:id/scrape` — trigger scrape (auto-heals on break)
- `POST /api/watches/:id/heal` — manual heal
- `GET /api/logs` — SSE terminal log stream
- `GET /api/watches/stream` — SSE alert stream
- `GET /api/store/stream` — SSE store state stream
- `POST /api/store/admin` — redesign | set_price | set_stock | set_bot_detection
- `GET /api/products/sony-a7iv` — store state (JSON)
- `GET /api/store/html` — store HTML representation (scrape target)
- `GET /api/ledger` — the Scar Log

The scheduler (`lib/scheduler.ts`) ticks every ~20s and scrapes due watches, so
breaks and alerts also happen live with nobody clicking.
