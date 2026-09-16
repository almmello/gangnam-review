import "server-only";
import { z } from "zod";
import { headers, readSmallJson, sameOrigin } from "../crawl/http";
import { AnalysisError } from "./provider";
export const keySchema = z.string().trim().min(20).max(1024).regex(/^[\x21-\x7e]+$/).optional();
export async function readAnalysisRequest(request: Request) {
  if (!request.headers.get("origin") || !sameOrigin(request)) throw new AnalysisError("A same-origin browser request is required.", 403);
  return readSmallJson(request, 180000);
}
export function failure(error: unknown) { return Response.json({ error: error instanceof AnalysisError ? error.message : "Invalid analysis request.", ...(error instanceof AnalysisError && error.code ? { code: error.code } : {}) }, { status: error instanceof AnalysisError ? error.status : 400, headers }); }
