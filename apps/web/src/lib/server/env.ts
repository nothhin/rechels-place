import { z } from "zod";

const databaseEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url().refine(
    (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
    "DATABASE_URL must use the postgres or postgresql protocol",
  ),
});

const serverEnvironmentSchema = databaseEnvironmentSchema.extend({
  AUTH_SECRET: z.string().min(32),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function parseServerEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  return serverEnvironmentSchema.safeParse(environment);
}

export function parseDatabaseEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  return databaseEnvironmentSchema.safeParse(environment);
}
