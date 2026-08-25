import { logHistory, onLog, onLogClear, type LogEvent } from "@/lib/stream";
import { ensureScheduler } from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  ensureScheduler();

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: LogEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* stream closed */
        }
      };

      // Replay recent history so a fresh terminal is never blank.
      for (const event of logHistory()) send(event);

      const unsubscribe = onLog(send);
      // When the server wipes log history (demo reset), tell connected
      // terminals to clear their local view too — otherwise old lines linger.
      const unsubscribeClear = onLogClear(() => {
        try {
          controller.enqueue(encoder.encode(`event: clear\ndata: {}\n\n`));
        } catch {
          /* stream closed */
        }
      });
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* ignore */
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        unsubscribeClear();
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
