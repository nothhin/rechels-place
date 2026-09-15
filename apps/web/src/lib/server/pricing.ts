import "server-only";

import {
  pricingConfigFromPayload,
  parsePricingPayload,
  type PricingHistoryEntry,
  type PricingPayload,
  type RechelsPricingConfig,
} from "@uppadar-hollie/shared/pricing";
import { createPublicSupabaseClient } from "@/lib/supabase/public-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StaffPricing = {
  pricing: RechelsPricingConfig;
  history: PricingHistoryEntry[];
};

async function loadPricing(client: Awaited<ReturnType<typeof createSupabaseServerClient>> | ReturnType<typeof createPublicSupabaseClient>) {
  if (!client) return null;
  const { data, error } = await client.rpc("get_snowaz_public_pricing");
  if (error || !data) {
    console.error("[pricing] public pricing load failed", { code: error?.code ?? "missing-data" });
    return null;
  }
  try {
    return pricingConfigFromPayload(data);
  } catch (error) {
    console.error("[pricing] public pricing payload invalid", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}

export async function getPublicPricing() {
  return loadPricing(createPublicSupabaseClient());
}

export async function getStaffPricing(): Promise<StaffPricing | null> {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("staff_get_snowaz_pricing");
  if (error || !data) {
    console.error("[pricing] staff pricing load failed", { code: error?.code ?? "missing-data" });
    return null;
  }
  try {
    const payload = parsePricingPayload(data) as PricingPayload;
    return {
      pricing: pricingConfigFromPayload(payload),
      history: payload.history,
    };
  } catch (error) {
    console.error("[pricing] staff pricing payload invalid", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}
