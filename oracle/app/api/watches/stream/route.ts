import { onAlert, onHeal, type AlertEvent, type HealEvent } from "@/lib/stream";
import { ensureScheduler } from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SSE stream of alerts + heal events, so the SENSE chat fires the tingle the
// instant a condition is met OR a break/heal recovers (no polling).
export async function GET(req: Request) {
  ensureScheduler();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (type: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* closed */
        }
      };

      const unsubAlert = onAlert((event: AlertEvent) => send("alert", event));
      const unsubHeal = onHeal((event: HealEvent) => send("heal", event));

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* ignore */
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubAlert();
        unsubHeal();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}