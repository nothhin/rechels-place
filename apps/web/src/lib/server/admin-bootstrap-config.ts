import { timingSafeEqual } from "node:crypto";

export type AdminBootstrapConfig = {
  enabled: boolean;
  email: string | null;
  secret: string | null;
};

export function getAdminBootstrapConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AdminBootstrapConfig {
  const email = environment.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase() || null;
  const secret = environment.ADMIN_BOOTSTRAP_SECRET?.trim() || null;
  const enabled = environment.ADMIN_BOOTSTRAP_ENABLED?.trim().toLowerCase() === "true";

  return {
    enabled: enabled && Boolean(email) && Boolean(secret && secret.length >= 32),
    email,
    secret,
  };
}

export function matchesAdminBootstrapSecret(candidate: string, expected: string) {
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
}
