import { describe, expect, it } from "vitest";
import {
  getAdminBootstrapConfig,
  matchesAdminBootstrapSecret,
} from "./admin-bootstrap-config";

describe("admin bootstrap configuration", () => {
  it("requires the explicit flag and a long secret, while normalizing an optional email restriction", () => {
    expect(getAdminBootstrapConfig({
      ADMIN_BOOTSTRAP_ENABLED: "true",
      ADMIN_BOOTSTRAP_EMAIL: " Rechel@Gmail.com ",
      ADMIN_BOOTSTRAP_SECRET: "a".repeat(32),
    })).toEqual({
      enabled: true,
      email: "rechel@gmail.com",
      secret: "a".repeat(32),
    });
  });

  it("allows the owner to choose an email when no restriction is configured", () => {
    expect(getAdminBootstrapConfig({
      ADMIN_BOOTSTRAP_ENABLED: "true",
      ADMIN_BOOTSTRAP_SECRET: "a".repeat(32),
    })).toEqual({
      enabled: true,
      email: null,
      secret: "a".repeat(32),
    });
  });

  it("stays disabled when setup is incomplete or explicitly off", () => {
    expect(getAdminBootstrapConfig({
      ADMIN_BOOTSTRAP_ENABLED: "false",
      ADMIN_BOOTSTRAP_EMAIL: "rechel@gmail.com",
      ADMIN_BOOTSTRAP_SECRET: "a".repeat(32),
    }).enabled).toBe(false);
    expect(getAdminBootstrapConfig({
      ADMIN_BOOTSTRAP_ENABLED: "true",
      ADMIN_BOOTSTRAP_EMAIL: "rechel@gmail.com",
      ADMIN_BOOTSTRAP_SECRET: "short",
    }).enabled).toBe(false);
  });

  it("compares setup secrets without accepting a different value", () => {
    const secret = "a".repeat(32);
    expect(matchesAdminBootstrapSecret(secret, secret)).toBe(true);
    expect(matchesAdminBootstrapSecret(`${secret}x`, secret)).toBe(false);
    expect(matchesAdminBootstrapSecret("b".repeat(32), secret)).toBe(false);
  });
});
