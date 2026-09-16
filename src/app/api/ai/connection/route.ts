import { z } from "zod";
import { headers } from "@/lib/crawl/http";
import { connectionInfo, resolveKey, testConnection } from "@/lib/analysis/provider";
import { failure, keySchema, readAnalysisRequest } from "@/lib/analysis/http";
import { providerSchema, DEFAULT_PROVIDER } from "@/lib/analysis/providers";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export function GET(request: Request) {
  try { const provider = providerSchema.parse(new URL(request.url).searchParams.get("provider") ?? DEFAULT_PROVIDER); return Response.json(connectionInfo(provider), { headers }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try { const body = z.object({ key: keySchema, provider: providerSchema.default(DEFAULT_PROVIDER) }).strict().parse(await readAnalysisRequest(request)); return Response.json(await testConnection(resolveKey(body.key, body.provider), request.signal, body.provider), { headers }); }
  catch (error) { return failure(error); }
}
