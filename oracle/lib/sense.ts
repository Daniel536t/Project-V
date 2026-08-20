// SENSE core domain logic: the demo "live web" + the watch/scrape/heal model.
//
// The demo target page (/demo/target) is OUR controllable fake product page.
// A "scrape" is simulated server-side: each template renders the price/stock
// under a different DOM path, so a watch's CSS selector goes stale when the
// template changes — exactly like a real site redesign breaking a scraper.
// Healing = re-deriving the selector from the current template (the same way
// Bright Data's `bdata scraper heal` re-derives from the original intent).
import {
  createWatch,
  getWatch,
  logHeal,
  updateWatch,
  type WatchRow,
} from "./db";

export type DemoTemplate = 0 | 1 | 2;

export interface DemoProduct {
  name: string;
  price: number;
  inStock: boolean;
}

export interface DemoState {
  product: DemoProduct;
  template: DemoTemplate;
  botDetection: boolean;
  hits: number;
}

const DEFAULT_DEMO: DemoState = {
  product: { name: "PlayStation 5 (Disc Edition)", price: 899, inStock: true },
  template: 0,
  botDetection: false,
  hits: 0,
};

let demo: DemoState = JSON.parse(JSON.stringify(DEFAULT_DEMO));

export function getDemoState(): DemoState {
  return demo;
}

export type DemoStatePatch = Partial<Omit<DemoState, "product">> & {
  product?: Partial<DemoProduct>;
};

export function setDemoState(patch: DemoStatePatch): DemoState {
  demo = {
    ...demo,
    ...patch,
    product: { ...demo.product, ...(patch.product ?? {}) },
  };
  return demo;
}

export function resetDemo(): DemoState {
  demo = JSON.parse(JSON.stringify(DEFAULT_DEMO));
  return demo;
}

// Each template renders price/stock under a different selector.
export const DEMO_TEMPLATES: Record<
  DemoTemplate,
  { name: string; price: string; stock: string }
> = {
  0: { name: "Classic", price: ".price", stock: ".stock" },
  1: {
    name: "Redesign A",
    price: ".product-meta .current-price",
    stock: ".product-meta .stock-status",
  },
  2: {
    name: "Redesign B",
    price: "[data-test='price-value']",
    stock: "[data-test='availability']",
  },
};

export function selectorFor(template: DemoTemplate, field: string): string {
  const t = DEMO_TEMPLATES[template];
  return field === "stock" ? t.stock : t.price;
}

export function valueFor(field: string): string {
  if (field === "stock") {
    return demo.product.inStock ? "in-stock" : "out-of-stock";
  }
  return String(demo.product.price);
}

export function generateWatchId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 4; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `W-${id}`;
}

export interface ScrapeResult {
  value: string | null;
  broke: boolean;
  reason?: "bot-detection" | "selector-stale";
}

export function simulateScrape(
  watch: Pick<WatchRow, "selector" | "field">,
): ScrapeResult {
  if (demo.botDetection) {
    return { value: null, broke: true, reason: "bot-detection" };
  }
  const expected = selectorFor(demo.template, watch.field);
  if (watch.selector !== expected) {
    return { value: null, broke: true, reason: "selector-stale" };
  }
  demo.hits += 1;
  return { value: valueFor(watch.field), broke: false };
}

export function evaluateCondition(
  value: string,
  field: string,
  operator: string,
  target: string | null,
): boolean {
  if (field === "stock") {
    const inStock = value === "in-stock";
    if (operator === "out_of_stock") return !inStock;
    return inStock; // "in_stock"
  }
  const n = parseFloat(value);
  if (Number.isNaN(n)) return false;
  if (operator === "changed") return true;
  const t = target == null ? NaN : parseFloat(target);
  if (Number.isNaN(t)) return false;
  switch (operator) {
    case "<":
      return n < t;
    case "<=":
      return n <= t;
    case ">":
      return n > t;
    case ">=":
      return n >= t;
    case "==":
      return n === t;
    default:
      return false;
  }
}

export interface RunResult {
  watch: WatchRow;
  events: string[];
  alerted: boolean;
  healed: boolean;
  value: string | null;
}

/** Run one scrape pass on a watch, auto-healing if it breaks. */
export async function runScrapePass(watchId: string): Promise<RunResult> {
  let watch = await getWatch(watchId);
  if (!watch) throw new Error(`Watch ${watchId} not found`);
  const events: string[] = [];
  let healed = false;

  let res = simulateScrape(watch);
  if (res.broke) {
    events.push(
      res.reason === "bot-detection"
        ? `Blocked by bot detection — extraction returned empty.`
        : `Extraction returned empty — selector ${watch.selector ?? "(none)"} no longer matches.`,
    );
    const oldSelector = watch.selector;
    const newSelector = selectorFor(demo.template, watch.field);
    const scarCount = (watch.scar_count ?? 0) + 1;
    await updateWatch(watchId, {
      selector: newSelector,
      scar_count: scarCount,
      status: "healing",
    });
    await logHeal({
      collector_id: watchId,
      era: null,
      broke_at: new Date(),
      healed_at: new Date(),
      description: `Watch ${watchId} broke (${res.reason}) and auto-healed.`,
      error_message: `Selector "${oldSelector ?? "(none)"}" no longer matched ${watch.url}`,
      recovery_steps: {
        intent: watch.intent,
        selector_before: oldSelector,
        selector_after: newSelector,
        template: demo.template,
      },
      rows_recovered: 1,
    });
    healed = true;
    events.push(`Healed from intent → selector "${newSelector}" (scar #${scarCount}).`);
    watch = (await getWatch(watchId))!;
    res = simulateScrape(watch);
  }

  if (res.broke || res.value == null) {
    await updateWatch(watchId, { status: "broken", last_value: null });
    return {
      watch: (await getWatch(watchId))!,
      events,
      alerted: false,
      healed,
      value: null,
    };
  }

  const alerted = evaluateCondition(res.value, watch.field, watch.operator, watch.target);
  await updateWatch(watchId, {
    status: alerted ? "alerted" : healed ? "healed" : "watching",
    last_value: res.value,
  });
  if (alerted) {
    events.push(`Condition met — ${res.value} ${watch.operator} ${watch.target ?? ""} → ALERT.`);
  } else {
    events.push(`Scrape ok — ${watch.field} = ${res.value}.`);
  }
  return {
    watch: (await getWatch(watchId))!,
    events,
    alerted,
    healed,
    value: res.value,
  };
}

export async function createWatchFromIntent(input: {
  label: string;
  url: string;
  intent: string;
  field: string;
  operator: string;
  target: string | null;
}): Promise<WatchRow> {
  const selector = selectorFor(demo.template, input.field);
  return createWatch({
    id: generateWatchId(),
    label: input.label,
    url: input.url,
    intent: input.intent,
    field: input.field,
    operator: input.operator,
    target: input.target,
    selector,
  });
}
