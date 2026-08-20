import { NextResponse } from "next/server";
import { handleAgentMessage } from "@/lib/agent";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const message = body?.message;
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  try {
    const reply = await handleAgentMessage(message);
    return NextResponse.json(reply);
  } catch (e) {
    return NextResponse.json(
      {
        message: "Sorry — I hit a snag. Try again?",
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
