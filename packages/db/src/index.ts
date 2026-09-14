import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export function createDatabase(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    // Route handlers run in transient serverless instances. Keep each instance
    // to one pooled connection and use Supabase's transaction-pooler URL.
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

  return {
    db: drizzle(client, { schema }),
    // Serverless responses must not wait indefinitely for a pooled socket to
    // drain. Supabase's transaction pooler safely releases it after shutdown.
    close: () => client.end({ timeout: 1 }),
  };
}

export async function checkDatabaseConnection(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 5,
    prepare: false,
  });

  try {
    await client`select 1 as ok`;
  } finally {
    await client.end({ timeout: 1 });
  }
}

export * from "./schema";
export * from "./availability";
