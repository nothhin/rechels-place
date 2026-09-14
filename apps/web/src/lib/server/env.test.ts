import { describe, expect, it } from "vitest";
import { parseServerEnvironment } from "./env";

describe("parseServerEnvironment", () => {
  it("accepts the required production server configuration", () => {
    const result = parseServerEnvironment({
      DATABASE_URL: "postgresql://runtime:secret@database.example/casa_marga?sslmode=require",
      AUTH_SECRET: "a-secure-auth-secret-with-32-characters",
    });

    expect(result.success).toBe(true);
  });

  it("rejects missing configuration without exposing secret values", () => {
    const result = parseServerEnvironment({});

    expect(result.success).toBe(false);
  });

  it("rejects a non-PostgreSQL database URL", () => {
    const result = parseServerEnvironment({
      DATABASE_URL: "https://database.example/casa-marga",
      AUTH_SECRET: "a-secure-auth-secret-with-32-characters",
    });

    expect(result.success).toBe(false);
  });
});
