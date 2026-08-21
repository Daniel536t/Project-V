# SENSE — spider-sense for the live web

**WeMakeDevs "Into the Scrape-Verse" hackathon · Bright Data Scraper Studio**

SENSE watches a page for a user-defined condition ("alert me when this drops below $120") and pings the moment it's met. When the target site redesigns, SENSE detects the break, heals its own scraper from the original plain-English intent, and keeps watching — same Collector ID, zero gaps. Every heal leaves a visible **scar**.

The demo is a single screen, split in two:

- **LEFT — SENSE**: an AI chat. You tell it what to watch; it confirms with the live price.
- **RIGHT — STORE**: a premium product page for the Nike Dunk Low "Panda". A floating **"⚙ Break This Site"** button opens demo controls: redesign the page, move the price, toggle stock, toggle bot detection.
- **BOTTOM — TERMINAL**: the live collector log — every scrape, break, heal, and alert streams here via SSE.

**The rule above all rules: no simulations.** The store's price lives in a real `products` table in PostgreSQL. The store UI fetches it from `/api/products/nike-dunk-panda` and subscribes to `/api/store/stream` (SSE). The scraper fetches the store's rendered HTML (`/api/store/html`) and extracts the price with a real CSS selector. When the price changes in the popup, the database changes, the store UI updates, and the next real scrape returns the new price.

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
NVIDIA_API_KEY=your_nvidia_key          # intent parsing (NIM)
NVIDIA_API_KEY_2=your_backup_key        # fallback key
OPENROUTER_API_KEY=your_key_here        # optional fallback
```

### Real Bright Data heal (production path)

Create a collector against the live store page once:

```bash
bdata scraper create "https://claude-coder.duckdns.org/api/store/html" \
  "Extract the product price and stock status. Return JSON: price (number), in_stock (boolean)."
```

Put the returned `c_…` ID in `BRIGHT_DATA_STORE_COLLECTOR_ID`. When it's set:

- every watch carries that **real** collector ID (same ID across heals),
- heals genuinely run `bdata scraper heal <collector_id> "<original intent>"`
  via the CLI (`--auto-approve`), and the CLI's output is surfaced in the
  terminal + scar log,
- if the CLI fails or times out, the heal falls back to deterministic
  re-derivation so the demo never stalls (same semantic action).

The scrape loop itself is fully real against the store's rendered HTML; the
collector is what the store's page would be scraped by in production.

---

## The 90-second demo script

1. **In SENSE chat, type:**
   `Watch the Nike Dunk Low 'Panda' and alert me when it drops below $120`
   → SENSE parses intent (NVIDIA NIM), creates a watch with a real collector ID
   (`c_…` visible on the card), runs the first real scrape: **"Currently $139."**

2. **Click ⚙ Break This Site → Redesign.**
   The store's DOM completely changes (template A→B). The watch's selector no
   longer exists in the markup. The terminal narrates:
   `❌ Empty extraction — break detected` → `Heal protocol · intent: "…"`
   → `✅ Healed · price now at .pricing-section [data-test='current-price']`
   → `Scar #1 · zero downtime downstream`. Status: **Healed**, scar count 1.

3. **Drag the price slider to $119.**
   The store UI updates live (SSE). The next scrape returns $119.
   `CONDITION MET: $119 < 120 → alert dispatched`. The chat fires the alert
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
- `GET /api/products/nike-dunk-panda` — store state (JSON)
- `GET /api/store/html` — store HTML representation (scrape target)
- `GET /api/ledger` — the Scar Log

The scheduler (`lib/scheduler.ts`) ticks every ~20s and scrapes due watches, so
breaks and alerts also happen live with nobody clicking.
