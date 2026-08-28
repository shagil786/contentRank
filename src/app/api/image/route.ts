import { NextRequest, NextResponse } from "next/server";
import { assertSafeRemoteHttpUrl } from "@/server/infrastructure/safe-remote-url";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) return NextResponse.json({ ok: false, reason: "missing_url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_url" }, { status: 400 });
  }

  try {
    target = await assertSafeRemoteHttpUrl(target);
  } catch {
    return NextResponse.json({ ok: false, reason: "blocked_url" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(target, {
      signal: controller.signal,
      headers: { Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" },
      // Do not follow redirects automatically: a public URL could redirect to
      // localhost or another private address after the initial validation.
      redirect: "manual",
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return NextResponse.json({ ok: false, reason: "redirect_not_allowed" }, { status: 502 });
    }
    if (!upstream.ok) return NextResponse.json({ ok: false, reason: "upstream_failed" }, { status: 502 });

    const contentType = upstream.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() || "";
    if (!contentType.startsWith("image/")) return NextResponse.json({ ok: false, reason: "not_an_image" }, { status: 415 });

    const length = Number(upstream.headers.get("content-length") || 0);
    if (length > MAX_IMAGE_BYTES) return NextResponse.json({ ok: false, reason: "image_too_large" }, { status: 413 });

    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_IMAGE_BYTES) return NextResponse.json({ ok: false, reason: "image_too_large" }, { status: 413 });

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "fetch_failed" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
