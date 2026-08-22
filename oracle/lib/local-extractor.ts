// local-extractor.ts — the OLD in-process HTML regex extraction, retained ONLY
// as a clearly-labelled fallback when no Bright Data store collector is
// configured. It is never used on the normal path, and when it runs the
// terminal labels the scrape "local fallback".

export function extractBySelector(html: string, selector: string): string | null {
  if (!selector) return null;

  // Attribute selector: [data-test='current-price']
  const attr = selector.match(/\[([a-zA-Z-]+)='([^']+)'\]/);
  if (attr) {
    const [, name, value] = attr;
    const re = new RegExp(`${name}=['"]${escapeRegExp(value)}['"][^>]*>([^<]*)<`, "i");
    const m = html.match(re);
    return m ? decodeHtml(m[1].trim()) : null;
  }

  // Class selector: possibly chained (.product-container .price). Match the
  // LAST class as an exact whitespace-delimited token, so `.price` never
  // accidentally matches `.display-price` — a genuine redesign must break.
  const classes = selector.split(/\s+/).filter((c) => c.startsWith("."));
  if (classes.length === 0) return null;
  const last = classes[classes.length - 1].slice(1);

  const re = new RegExp(`class=['"]([^'"]*)['"][^>]*>([^<]*)<`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1].split(/\s+/).includes(last)) {
      return decodeHtml(m[2].trim());
    }
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}