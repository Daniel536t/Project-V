# SENSE — 90-Second Demo Script

## Pre-demo checklist
- [ ] pm2 online, 0 restarts
- [ ] Store: Template A, iPhone 17 Pro $999, in stock, 0 watches, 0 scars
- [ ] Vercel store URL loads from phone hotspot (public)
- [ ] Terminal expanded, logs clear
- [ ] Bright Data CLI authenticated

## The script

### Beat 1: The Setup (0:00–0:10)
**[Action]** Point at the split screen — SENSE on left, store on right
**[Voice]** "This is SENSE — a self-healing web scraper. Left side: the AI agent. Right side: the store it watches. The terminal shows real Bright Data scrapes."

### Beat 2: Create a Watch (0:10–0:20)
**[Action]** Type in chat: "Alert me when the iPhone 17 Pro drops below $950"
**[Terminal]** `Watch W-XXXX created · collector c_mt5qg63q1qa9ashdl5 · targeting iPhone 17 Pro`
**[Terminal]** `200 OK · price=999 · stock=true · via brightdata-collector`
**[Voice]** "SENSE creates a real Bright Data collector. Same collector ID across everything."

### Beat 3: Break the Site (0:20–0:35)
**[Action]** Open popup → click "Modern" template
**[Terminal]** `Store redesigned → template B (Modern)`
**[Terminal]** `Empty extraction — break detected`
**[Terminal]** `Heal protocol · description: "The site was redesigned…"`
**[Voice]** "The store redesigned. The scraper broke. SENSE detected it instantly."

### Beat 4: Heal (0:35–0:55)
**[Terminal]** `Bright Data heal dispatched · attempt 1/2 · collector c_mt5qg63q1qa9ashdl5`
**[Terminal]** `⏳ Template refreshing… (attempt 1/4)`
**[Terminal]** `✅ Heal landed · same collector returned $999`
**[Terminal]** `Scar #1 · healed in 45s · 1 heal attempt(s) · zero downtime downstream`
**[Voice]** "SENSE dispatched Bright Data's AI heal with a DOM-diff description. Verified the collector recovered. Same ID. Real recovery."

### Beat 5: Price Alert (0:55–1:10)
**[Action]** Drag price slider to $929
**[Terminal]** `CONDITION MET · $929.00 < 950 → alert dispatched`
**[Action]** Show alert message in chat with shiver animation
**[Voice]** "Price dropped below target. Edge-triggered alert — fires once, not on every scrape."

### Beat 6: Time Machine (1:10–1:25)
**[Action]** Open sidebar → click "Time Machine"
**[Action]** Click "Run live scrape" on 2019 card
**[Terminal]** `Era scrape · 2019 · adorama.com · collector c_mt50b3j82jy9sv1bcv…`
**[Terminal]** `✅ 200 OK · Canon EOS 5D Mark IV · price=$2,799 · via brightdata-collector`
**[Action]** Click "Run live scrape" on 2026 card
**[Terminal]** `Era scrape · 2026 · adorama.com · collector c_mt508xfx2ku0qj6fky…`
**[Terminal]** `✅ 200 OK · Canon EOS 5D Mark IV · price=$1,999 · via brightdata-collector`
**[Voice]** "Our store lets you break things yourself. But this same pipeline watches the real internet. Here's a collector that survived a retailer's actual 7-year redesign."

### Beat 7: The Closer (1:25–1:30)
**[Action]** Point at the Era Heal scar entry
**[Voice]** "Bright Data's AI couldn't map the organic redesign. SENSE's deterministic recovery restored data flow. Same collector ID. Zero downtime."
**[Voice]** "Same collector. Real breaks. Real recovery. It doesn't just scrape — it survives."
