import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

// Saves an uploaded image to /uploads so the vision model (and the agent) can
// read it. Used by the /upload page to send a design screenshot to Buffy.
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("image") as File | null;

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "expected an 'image' file" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ error: "empty file" }, { status: 400 });
  }
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: "image too large (max 15 MB)" }, { status: 413 });
  }

  const ext = (file.name.split(".").pop() || "png")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const safeExt = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext) ? ext : "png";

  const dir = path.join(process.cwd(), "uploads");
  await mkdir(dir, { recursive: true });
  const name = `vision-${Date.now()}.${safeExt}`;
  await writeFile(path.join(dir, name), bytes);

  return NextResponse.json({ ok: true, file: name, bytes: bytes.length });
}
