import { z } from 'zod';

export const SignalEventDTO = z.object({
  id: z.string(),
  source_item_id: z.string(),
  source_id: z.string(),
  source_type: z.string(),
  source_url: z.string().url(),
  timestamp: z.string(),
  ingested_at: z.string(),
  author: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  content: z.string(),
  tags: z.array(z.string()),
  confidence: z.number(),
});
export type SignalEventDTO = z.infer<typeof SignalEventDTO>;

export const SourceHealthDTO = z.object({
  source_id: z.string(),
  source_type: z.string(),
  enabled: z.boolean(),
  last_fetch_at: z.string().nullable().optional(),
  last_success_at: z.string().nullable().optional(),
  last_error: z.string().nullable().optional(),
  error_count_1h: z.number(),
  throughput_per_min: z.number(),
  status: z.enum(['healthy', 'degraded', 'failed']),
});
export type SourceHealthDTO = z.infer<typeof SourceHealthDTO>;

export const SourceHealthResponse = z.object({ sources: z.array(SourceHealthDTO) });
export type SourceHealthResponse = z.infer<typeof SourceHealthResponse>;

export const SignalsPage = z.object({
  items: z.array(SignalEventDTO),
  next_cursor: z.string().optional(),
});
export type SignalsPage = z.infer<typeof SignalsPage>;

// UserOut.id is a NUMBER — backend User.id is BIGINT, Pydantic/FastAPI serializes as JSON number.
// Checker reviewed 2026-04-21: prior z.string() was a drift from backend truth.
export const UserOut = z.object({ id: z.number(), email: z.string().email() });
export type UserOut = z.infer<typeof UserOut>;
