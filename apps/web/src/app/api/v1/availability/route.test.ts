import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/v1/availability", () => {
  it("returns field-safe validation errors", async () => {
    const response = await GET(new Request("http://localhost/api/v1/availability?checkIn=2026-08-12&checkOut=2026-08-10&guests=0"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_AVAILABILITY_SEARCH");
    expect(body.requestId).toEqual(expect.any(String));
  });

  it("fails closed when the database is not configured", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      const response = await GET(new Request("http://localhost/api/v1/availability?checkIn=2026-08-10&checkOut=2026-08-12&guests=2"));
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.error.code).toBe("SERVICE_NOT_CONFIGURED");
    } finally {
      if (previousDatabaseUrl) process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });
});
