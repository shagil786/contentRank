import { NextRequest, NextResponse } from "next/server";
import { fetchOpenGraph } from "@/lib/outrank/og";
import { assertSafeRemoteHttpUrl } from "@/server/infrastructure/safe-remote-url";

export const dynamic = "force-dynamic";

// GET /api/og?url=<url>
// Server-side OpenGraph extraction. Used by the AddEntity form to auto-fill
// name/sub/blurb from a pasted link. Never called from the client SDK directly.

// YouTube bot-walls regular fetches, but its public oEmbed endpoint returns
// clean JSON (title + author + thumbnail) with no API key. Same trick covers
// a few other hosts that publish oEmbed for embeds.
const OEMBED_ENDPOINTS: Array<{ test: (u: URL) => boolean; build: (u: URL) => string }> = [
  {
    // youtube.com/watch?v=ID, youtu.be/ID, /shorts/ID
    test: (u) =>
      /(^|\.)youtube\.com$/.test(u.hostname) || u.hostname === "youtu.be",
    build: (u) => {
      const id =
        u.searchParams.get("v") ||
        (u.hostname === "youtu.be" ? u.pathname.slice(1).split("/")[0] : "") ||
        u.pathname.match(/\/(shorts|embed|live)\/([^/?#]+)/i)?.[2] ||
        "";
      return id ? `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json` : "";
    },
  },
  {
    // reddit posts expose oEmbed via their www host
    test: (u) => /(^|\.)reddit\.com$/.test(u.hostname),
    build: (u) => `https://www.reddit.com/oembed?url=${encodeURIComponent(u.toString())}`,
  },
];

async function tryOembed(raw: string): Promise<{ title?: string; authorName?: string; thumbnail?: string } | null> {
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const endpoint = OEMBED_ENDPOINTS.find((e) => e.test(u));
    if (!endpoint) return null;
    const target = endpoint.build(u);
    if (!target) return null;
    await assertSafeRemoteHttpUrl(target);

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(target, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "OUTRANK/1.0 (+https://content-rank.lol)" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    if (!data.title) return null;
    return { title: data.title, authorName: data.author_name, thumbnail: data.thumbnail_url };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!url.trim()) {
    return NextResponse.json({ ok: false, reason: "no_url" }, { status: 400 });
  }
  const result = await fetchOpenGraph(url);

  // OG failed or came back empty → try the host's oEmbed endpoint before
  // giving up. Keeps the same response shape the AddEntity form expects.
  if (!result.ok || !result.title) {
    const oembed = await tryOembed(url);
    if (oembed) {
      return NextResponse.json(
        {
          url: url.startsWith("http") ? url : `https://${url}`,
          ok: true as const,
          title: oembed.title,
          description: oembed.authorName ? `by ${oembed.authorName}` : undefined,
          image: oembed.thumbnail,
          siteName: /(^|\.)youtube\.com$|youtu\.be/.test(url) ? "YouTube" : undefined,
          type: "oembed",
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
