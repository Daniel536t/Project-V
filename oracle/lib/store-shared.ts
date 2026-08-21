// Client-safe store constants — imported by BOTH the server store domain
// (lib/store.ts) and the client StorePanel component. Kept dependency-free so
// the browser bundle never pulls in pg/db code.

export const PRODUCT_ID = "iphone-17-pro";
export const PRODUCT_NAME = "iPhone 17 Pro";

// Real product photography (hotlinked CDN — clean studio-style shots).
export const PRODUCT_IMAGES = {
  main: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=1200&q=80",
  gallery: [
    "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1592286927505-1def25115558?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1607936854279-55e8a4c64888?auto=format&fit=crop&w=600&q=80",
  ],
  alt: "iPhone 17 Pro",
};

// Hero image — a single clean iPhone 17 Pro shot. The hero features ONE
// product standing out (the watch and AirPods live in the grid below, not
// mashed into the hero composition).
export const HERO_IMAGES = {
  phone:
    "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=80",
  buds: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=400&q=80",
  watch:
    "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=400&q=80",
};

export interface FeaturedProduct {
  id: string;
  name: string;
  tagline: string;
  price: number;
  image: string;
  colors: string[];
  bullets: string[];
  watchTarget: number;
  tag?: string;
}

// The storefront's featured lineup. Any of these can become the active
// product: clicking "Watch" selects it into the live `products` table, so the
// scraper (and the break/heal demo) target whatever the user is watching.
export const FEATURED_PRODUCTS: FeaturedProduct[] = [
  {
    id: "iphone-17-pro",
    name: "iPhone 17 Pro",
    tagline: "A19 Pro. Titanium. ProMotion 120Hz.",
    price: 999,
    image:
      "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=600&q=80",
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
    image:
      "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=600&q=80",
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
    image:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80",
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
    image:
      "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=600&q=80",
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
    image:
      "https://images.unsplash.com/photo-1600180758890-6b94519a8ba6?auto=format&fit=crop&w=600&q=80",
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
