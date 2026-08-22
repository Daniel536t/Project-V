// Client-safe store constants — imported by BOTH the server store domain
// (lib/store.ts) and the client StorePanel component. Kept dependency-free so
// the browser bundle never pulls in pg/db code.
//
// SINGLE SOURCE OF TRUTH for product names, prices, and priceLabels. Every
// demo string (suggestion card, parser fallback, terminal flavor, admin slider
// bounds) derives from here — never hardcode a price or product name in a
// component.

export const PRODUCT_ID = "iphone-17-pro";
export const PRODUCT_NAME = "iPhone 17 Pro";

// Local product photography — served from /public/products so the demo renders
// 100% complete with the network OFFLINE. Never hotlink at demo time.
export const PRODUCT_IMAGES = {
  main: "/products/iphone-17-pro.png",
  gallery: [
    "/products/iphone-17-pro.png",
    "/products/airpods-pro.png",
    "/products/macbook-air.png",
    "/products/watch-s9.png",
  ],
  alt: "iPhone 17 Pro",
};

// The hero composes three devices (AirPods left, iPhone center, Watch right)
// from the same local product shots — deliberately SEPARATE and well-organized,
// not a mashed-together collage.
export const HERO_IMAGES = {
  phone: "/products/hero-phone.png",
  buds: "/products/airpods-pro.png",
  watch: "/products/watch-s9.png",
};

export interface FeaturedProduct {
  id: string;
  name: string;
  tagline: string;
  price: number;
  priceLabel: string;
  image: string;
  colors: string[];
  bullets: string[];
  watchTarget: number;
  tag?: string;
}

/** Suggested watch threshold: round(price − 100) to the nearest $50. */
export function suggestedWatchTarget(price: number): number {
  return Math.max(10, Math.round((price - 100) / 50) * 50);
}

// The storefront's featured lineup. Any of these can become the active
// product: selecting it points the store (and the scraper) at that product.
export const FEATURED_PRODUCTS: FeaturedProduct[] = [
  {
    id: "iphone-17-pro",
    name: "iPhone 17 Pro",
    tagline: "A19 Pro. Titanium. ProMotion 120Hz.",
    price: 999,
    priceLabel: "From $999",
    image: "/products/iphone-17-pro.png",
    colors: ["#b8b2a6", "#3a4a63", "#2c2c2e", "#9ad2c9"],
    bullets: [
      "A19 Pro chip — the fastest smartphone chip ever.",
      "Grade-5 titanium design with a 120Hz ProMotion display.",
      "48MP Fusion camera system with 5x telephoto.",
      "USB-C fast charging and all-day battery life.",
    ],
    watchTarget: 949,
    tag: "New",
  },
  {
    id: "airpods-pro-2",
    name: "AirPods Pro (2nd gen)",
    tagline: "Adaptive Audio. Pro-level noise cancellation.",
    price: 249,
    priceLabel: "$249",
    image: "/products/airpods-pro.png",
    colors: ["#f5f5f7"],
    bullets: [
      "Adaptive Audio and active noise cancellation.",
      "Personalized Spatial Audio with dynamic head tracking.",
      "Up to 6 hours listening time (30 with the case).",
      "Sweat and water resistant.",
    ],
    watchTarget: 229,
  },
  {
    id: "macbook-air-15",
    name: 'MacBook Air 15"',
    tagline: "Impressively big. Impossibly thin.",
    price: 1299,
    priceLabel: "From $1,299",
    image: "/products/macbook-air.png",
    colors: ["#1d1d1f", "#e8e2d6", "#5a5a5e"],
    bullets: [
      '15.3" Liquid Retina display.',
      "M3 chip for fast, efficient performance.",
      "Up to 18 hours of battery life.",
      "Silent, fanless design.",
    ],
    watchTarget: 1199,
  },
  {
    id: "apple-watch-s9",
    name: "Apple Watch Series 9",
    tagline: "Smarter. Brighter. Mightier.",
    price: 399,
    priceLabel: "From $399",
    image: "/products/watch-s9.png",
    colors: ["#1d1d1f", "#e8e2d6", "#f0c0c6"],
    bullets: [
      "S9 SiP with a brighter display.",
      "Double Tap gesture control.",
      "Advanced health sensors.",
      "All-day 18-hour battery.",
    ],
    watchTarget: 349,
  },
  {
    id: "airtag-4",
    name: "AirTag (4 pack)",
    tagline: "Lose your knack for losing things.",
    price: 99,
    priceLabel: "$99",
    image: "/products/airtag.png",
    colors: ["#f5f5f7"],
    bullets: [
      "Precision Finding with Ultra Wideband.",
      "Water and dust resistant.",
      "Replaceable battery lasts over a year.",
      "Track with the Find My network.",
    ],
    watchTarget: 79,
  },
];

export function featuredById(id: string): FeaturedProduct | undefined {
  return FEATURED_PRODUCTS.find((f) => f.id === id);
}

/** Match a user's phrasing to a seeded product id (null = no explicit match). */
export function detectProductId(msg: string): string | null {
  const m = msg.toLowerCase();
  if (m.includes("airpods")) return "airpods-pro-2";
  if (m.includes("macbook")) return "macbook-air-15";
  if (m.includes("apple watch") || m.includes("applewatch")) return "apple-watch-s9";
  if (m.includes("airtag")) return "airtag-4";
  if (m.includes("iphone")) return "iphone-17-pro";
  return null;
}

/** Match a user's phrasing to a seeded product name (defaults to the product
 * of record when nothing matches). */
export function detectProductName(msg: string): string {
  const id = detectProductId(msg);
  return id ? featuredById(id)!.name : PRODUCT_NAME;
}
