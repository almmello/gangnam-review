import { z } from "zod";
export const providerSchema = z.enum(["deepseek"]);
export type ProviderId = z.infer<typeof providerSchema>;
export const DEFAULT_PROVIDER: ProviderId = "deepseek";
// Public configuration only. Credentials and provider routing live on the server.
export const PROVIDERS = {
  deepseek: { label: "DeepSeek", model: "deepseek-flash", keyUrl: "https://platform.deepseek.com/api_keys", docsUrl: "https://api-docs.deepseek.com/" },
} as const;
