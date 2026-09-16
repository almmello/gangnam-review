import { collect } from "@/lib/crawl/collection";
import { headers, readSmallJson, requestSchema, sameOrigin } from "@/lib/crawl/http";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Cross-site requests are not allowed." }, { status: 403, headers });
  let urls: string[];
  try { urls = requestSchema.parse(await readSmallJson(request)).urls; }
  catch { return Response.json({ error: "Send one or two supported source URLs as JSON." }, { status: 400, headers }); }
  try { return Response.json({ pages: await collect([...new Set(urls)], request.signal) }, { headers }); }
  catch { return Response.json({ error: "Collection could not be completed." }, { status: 502, headers }); }
}
