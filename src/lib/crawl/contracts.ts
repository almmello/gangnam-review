import { z } from "zod";
const kind = z.enum(["home", "directory", "reviews", "clinic"]);
export const sourceSchema = z.object({ url: z.string().url(), kind, discoveredFrom: z.array(z.string()), discoveredAt: z.string() });
export const discoverySchema = z.object({
  id: z.string(), startedAt: z.string(), finishedAt: z.string(), sources: z.array(sourceSchema),
  totalFound: z.number(), omitted: z.number(), warnings: z.array(z.string()), partial: z.boolean(),
});
const reviewSchema = z.object({
  id: z.string(), pageUrl: z.string(), position: z.number(), locator: z.string(), collectedAt: z.string(),
  clinicName: z.string().nullable(), clinicUrl: z.string().nullable(), rating: z.number().nullable(),
  sourceLabel: z.string().nullable(), publishedAt: z.string().nullable(), originalReviewUrl: z.string().nullable(),
  text: z.string(), contentKind: z.enum(["summary", "translation", "published-review"]),
  language: z.string().nullable(), translationLabel: z.string().nullable(), textTruncated: z.boolean(),
});
export const pageSchema = z.object({
  url: z.string(), finalUrl: z.string().nullable(), kind, collectedAt: z.string(),
  status: z.enum(["collected", "no_review_section", "empty_review_section", "extraction_failed", "fetch_failed", "robots_blocked"]),
  httpStatus: z.number().nullable(), title: z.string().nullable(), reviews: z.array(reviewSchema),
  clinics: z.array(z.object({ name: z.string(), url: z.string().nullable(), pageUrl: z.string() })),
  warnings: z.array(z.string()), error: z.string().nullable(), reportedReviewCount: z.number().nullable(),
  truncated: z.boolean(), stopRequested: z.boolean(),
});
export const batchSchema = z.object({ pages: z.array(pageSchema) });
export type Discovery = z.infer<typeof discoverySchema>;
export type DiscoveredSource = z.infer<typeof sourceSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type CollectedPage = z.infer<typeof pageSchema>;
