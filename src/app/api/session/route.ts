// POST /api/session — create a session (lightweight auth). Returns sessionId.
// Called by the realtime engine on socket connect so boosts can be attributed.
import { NextRequest } from "next/server";
import { jsonResponse, prepareApiContext } from "@/server/infrastructure/api-helpers";
import { container } from "@/server/application/container";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const prepared = await prepareApiContext(req, "general");
  if ("error" in prepared) return prepared.error;
  const { ctx } = prepared;

  let body: { handle?: string; location?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }
  if (ctx.session && (body.handle || body.location)) {
    await container.repos.session.touch(ctx.session, { handle: body.handle, location: body.location });
  }
  return jsonResponse({ sessionId: ctx.session }, 200, { requestId: ctx.requestId, sessionId: ctx.session });
}
