export interface Product {
  id: string;
  name: string;
  priceLabel: string;   // display string e.g. "From $999"
  price: number;        // numeric, used by the watch engine
  colors: string[];     // swatch hexes
  img: string;          // /public path
}

export const PRODUCTS: Product[] = [
  { id: 'iphone-15-pro', name: 'iPhone 15 Pro',        priceLabel: 'From $999',   price: 999,  colors: ['#3b3f46', '#8a8d91', '#e3e4e6'], img: '/products/iphone-15-pro.png' },
  { id: 'airpods-pro-2', name: 'AirPods Pro (2nd gen)', priceLabel: '$249',        price: 249,  colors: ['#1d1d1f'],                       img: '/products/airpods-pro.png' },
  { id: 'macbook-air-15', name: 'MacBook Air 15"',      priceLabel: 'From $1,299', price: 1299, colors: ['#2e3641', '#8a8d91', '#e3e4e6'], img: '/products/macbook-air.png' },
  { id: 'watch-s9',      name: 'Apple Watch Series 9', priceLabel: 'From $399',   price: 399,  colors: ['#1d1d1f', '#e3e4e6'],           img: '/products/watch-s9.png' },
  { id: 'airtag-4',      name: 'AirTag (4 pack)',      priceLabel: '$99',         price: 99,   colors: [],                                 img: '/products/airtag.png' },
];
