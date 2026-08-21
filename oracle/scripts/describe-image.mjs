// Describe an uploaded vision image using NVIDIA NIM's vision model.
//
// Usage:
//   node --env-file=.env.local scripts/describe-image.mjs           # latest upload
//   node --env-file=.env.local scripts/describe-image.mjs vision-123.png
//
// Prints a UI/design blueprint (layout, sections, colors, typography) so the
// agent can rebuild the interface from the description.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const NIM_BASE = "https://integrate.api.nvidia.com/v1";
const MODEL = process.env.VISION_MODEL || "meta/muse-glimmer-30b";

const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

async function latestImage() {
  const files = await readdir(UPLOAD_DIR).catch(() => []);
  const imgs = files.filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f));
  if (imgs.length === 0) return null;
  imgs.sort((a, b) => {
    const ta = parseInt(a.match(/(\d+)/)?.[1] ?? "0", 10);
    const tb = parseInt(b.match(/(\d+)/)?.[1] ?? "0", 10);
    return tb - ta;
  });
  return imgs[0];
}

async function main() {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) {
    console.error("NVIDIA_API_KEY is not set — run with --env-file=.env.local");
    process.exit(1);
  }

  const requested = process.argv[2];
  const name = requested ?? (await latestImage());
  if (!name) {
    console.error("No image in uploads/ — upload one first via /upload.");
    process.exit(1);
  }

  const filePath = path.join(UPLOAD_DIR, name);
  const buf = await readFile(filePath);
  const ext = (name.split(".").pop() || "png").toLowerCase();
  const mime = MIME[ext] ?? "image/png";
  const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;

  const prompt =
    "Describe this image as a precise UI/design blueprint for a developer to rebuild it. " +
    "Cover: overall layout (columns/proportions/stacking), every section top-to-bottom with its purpose, " +
    "color palette (exact hex codes when identifiable), typography (font sizes/weights/styles), spacing, " +
    "and any notable visual details, imagery, or implied motion. Be concrete and structural — no fluff.";

  console.error(`\u2192 Describing ${name} (${buf.length} bytes) with ${MODEL}\u2026\n`);

  const res = await fetch(`${NIM_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: prompt },
          ],
        },
      ],
      max_tokens: 2048,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    console.error(`NIM ${res.status}: ${(await res.text()).slice(0, 500)}`);
    process.exit(1);
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  const text = (msg?.content || msg?.reasoning_content || "").trim();
  if (!text) {
    console.error("Empty response:", JSON.stringify(data).slice(0, 500));
    process.exit(1);
  }
  console.log(text);
}

main();
