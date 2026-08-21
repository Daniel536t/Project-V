// Client-safe product constants — imported by BOTH the server store domain
// (lib/store.ts) and the client StorePanel component. Kept dependency-free so
// the browser bundle never pulls in pg/db code.

export const PRODUCT_ID = "nike-dunk-panda";
export const PRODUCT_NAME = "Nike Dunk Low 'Panda'";

// Real product photography (hotlinked CDN images — sneaker studio shots).
export const PRODUCT_IMAGES = {
  main: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80",
  gallery: [
    "https://images.unsplash.com/photo-1595341888016-a392ef81b7de?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80",
    "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=600&q=80",
  ],
  alt: "Nike Dunk Low 'Panda' sneaker",
};
