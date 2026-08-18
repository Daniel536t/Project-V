import { NextResponse } from "next/server";
import { getHealLedger, logHeal } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const rows = await getHealLedger();
    return NextResponse.json({ events: rows });
  } catch (err) {
    return NextResponse.json(
      {
        events: [],
        error:
          "DATABASE_URL is not set — heal ledger is unavailable.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}

interface LogHealBody {
  collector_id?: string;
  era?: number;
  description?: string;
  error_message?: string;
  recovery_steps?: Record<string, unknown>;
  rows_recovered?: number;
}

export async function POST(request: Request) {
  let body: LogHealBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const rows = await logHeal({
      collector_id: body.collector_id ?? null,
      era: body.era ?? null,
      broke_at: new Date(),
      healed_at: new Date(),
      description: body.description ?? null,
      error_message: body.error_message ?? null,
      recovery_steps: body.recovery_steps ?? null,
      rows_recovered: body.rows_recovered ?? null,
    });
    return NextResponse.json({ event: rows[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "DATABASE_URL is not set — could not log heal event.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
