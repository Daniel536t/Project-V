// Client-safe product constants — imported by BOTH the server store domain
// (lib/store.ts) and the client StorePanel component. Kept dependency-free so
// the browser bundle never pulls in pg/db code.

export const PRODUCT_ID = "sony-a7iv";
export const PRODUCT_NAME = "Sony A7 IV (Body Only)";

// Real product photography (hotlinked CDN images — the Sony A7 series body).
export const PRODUCT_IMAGES = {
  main: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
  gallery: [
    "https://images.unsplash.com/photo-1495707902641-75cac588d2e9?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=600&q=80",
  ],
  alt: "Sony A7 IV full-frame mirrorless camera",
};
