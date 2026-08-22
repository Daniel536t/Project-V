// Wayback anchor watch — the era crossing.
// Two pinned collectors (one per era) plus one era-heal collector that was
// created against the 2019 snapshot and healed to work on the live 2026 page.
// Healing mutates a collector's saved template, so a single collector can't
// serve two eras. Two pinned collectors = both eras scrape instantly, forever,
// with no re-heal cost per demo.

export const WAYBACK_CONFIG = {
  retailer: 'adorama.com',
  productName: 'Canon EOS 5D Mark IV',
  eraFrom: 2019,
  eraTo: 2026,
  eraFromUrl:
    'http://web.archive.org/web/20190602193555/https://www.adorama.com/ica5dm4.html',
  eraToUrl: 'https://www.adorama.com/ica5dm4.html',
  // Pinned collectors — one per era (never recreated)
  eraFromCollectorId: process.env.WAYBACK_2019_COLLECTOR_ID ?? 'c_mt50b3j82jy9sv1bcv',
  eraToCollectorId: process.env.WAYBACK_2026_COLLECTOR_ID ?? 'c_mt508xfx2ku0qj6fky',
  // Era heal collector — created against 2019, healed to work on 2026
  eraHealCollectorId: process.env.WAYBACK_ERA_HEAL_COLLECTOR_ID ?? 'c_mt50c1ep2ivw4paj8z',
} as const;

export interface WaybackEraResult {
  era: number;
  collectorId: string;
  productName: string | null;
  price: number | null;
  inStock: boolean | null;
  raw: unknown;
  timestamp: number; // ms since epoch
}
