import postgres from "postgres";
import type { Database } from "./repository.js";

/** Connects to Supabase's Postgres through its transaction pooler, which suits short-lived serverless functions. */
export function createPostgresDatabase(connectionString: string): Database {
  // The pooler cannot keep prepared statements between requests, so they are turned off.
  // Notices such as "table already exists, skipping" are expected on every start, so they are not logged.
  const sql = postgres(connectionString, { prepare: false, max: 1, onnotice: () => undefined });
  return {
    query: async <Row>(text: string, params: unknown[] = []) =>
      (await sql.unsafe(text, params as postgres.ParameterOrJSON<never>[])) as unknown as Row[],
  };
}
