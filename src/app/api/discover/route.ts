import { discover } from "@/lib/crawl/discovery";
import { headers, sameOrigin } from "@/lib/crawl/http";
export const runtime = "nodejs";
export const maxDuration = 180;
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Cross-site requests are not allowed." }, { status: 403, headers });
  try { return Response.json(await discover(request.signal), { headers }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Discovery could not be completed." }, { status: 502, headers }); }
}
