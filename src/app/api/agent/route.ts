import { runAgent } from "@/lib/server/agent";
import { friendlyError } from "@/lib/server/gemini";
import type { AgentEvent, AgentRequest } from "@/lib/types";

export const maxDuration = 300;

/** Streams agent events as NDJSON so the studio can render slides as they're written. */
export async function POST(request: Request) {
  const body = (await request.json()) as AgentRequest;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (ev: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
        } catch {
          /* client went away */
        }
      };
      try {
        await runAgent(body, emit, request.signal);
      } catch (e) {
        if (!request.signal.aborted) emit({ type: "error", text: friendlyError(e) });
      }
      emit({ type: "done" });
      try {
        controller.close();
      } catch {}
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
