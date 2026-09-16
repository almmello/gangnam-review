import { z } from "zod";
import { taskSchema } from "@/lib/analysis/contracts";
import { analyzeTask, resolveKey } from "@/lib/analysis/provider";
import { failure, keySchema, readAnalysisRequest } from "@/lib/analysis/http";
import { headers } from "@/lib/crawl/http";
import { providerSchema, DEFAULT_PROVIDER } from "@/lib/analysis/providers";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    const body = z.object({ task: taskSchema, key: keySchema, provider: providerSchema.default(DEFAULT_PROVIDER) }).strict().parse(await readAnalysisRequest(request));
    const key = resolveKey(body.key, body.provider);
    return Response.json(await analyzeTask(body.task, key, request.signal, body.provider), { headers });
  }
  catch (error) { return failure(error); }
}
