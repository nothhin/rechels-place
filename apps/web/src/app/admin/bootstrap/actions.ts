"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getAdminBootstrapConfig,
  matchesAdminBootstrapSecret,
} from "@/lib/server/admin-bootstrap-config";

export type BootstrapActionState = {
  status: "idle" | "error";
  message?: string;
};

const registrationSchema = z
  .object({
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
    setupSecret: z.string().min(1).max(256),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

async function findAuthUserByEmail(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user || data.users.length < 1000) return user ?? null;
  }
  throw new Error("The account directory is too large to search safely.");
}

function invalidSetup(): BootstrapActionState {
  return {
    status: "error",
    message: "Owner setup is unavailable or the setup details are not valid.",
  };
}

export async function registerBootstrapAdmin(
  _state: BootstrapActionState | undefined,
  formData: FormData,
): Promise<BootstrapActionState> {
  const config = getAdminBootstrapConfig();
  if (!config.enabled || !config.email || !config.secret) return invalidSetup();

  const parsed = registrationSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    setupSecret: formData.get("setupSecret"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Check the registration details.",
    };
  }

  const email = parsed.data.email.toLowerCase();
  if (email !== config.email || !matchesAdminBootstrapSecret(parsed.data.setupSecret, config.secret)) {
    return invalidSetup();
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return {
      status: "error",
      message: "Owner setup is temporarily unavailable. Check the server configuration.",
    };
  }

  const { data: existingStaff, error: staffLookupError } = await admin
    .from("staff_users")
    .select("id, identity_provider_subject, role, status")
    .eq("email", email)
    .maybeSingle();
  if (staffLookupError) {
    console.error("[admin-bootstrap] staff lookup failed", { code: staffLookupError.code });
    return { status: "error", message: "Owner setup could not verify the staff profile." };
  }

  let userId: string;
  let createdAuthUser = false;
  if (existingStaff?.identity_provider_subject) {
    const { data: authUser, error: authLookupError } = await admin.auth.admin.getUserById(
      existingStaff.identity_provider_subject,
    );
    const linkedUser = !authLookupError && authUser.user && authUser.user.email?.toLowerCase() === email
      ? authUser.user
      : await findAuthUserByEmail(admin, email).catch(() => null);
    if (!linkedUser) {
      return {
        status: "error",
        message: "This staff profile is not linked to a valid Supabase account. Ask the administrator to repair it first.",
      };
    }
    userId = linkedUser.id;
  } else {
    const existingAuthUser = await findAuthUserByEmail(admin, email).catch((error: unknown) => {
      console.error("[admin-bootstrap] auth lookup failed", { message: error instanceof Error ? error.message : "unknown" });
      return null;
    });
    if (existingAuthUser) {
      userId = existingAuthUser.id;
    } else {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password: parsed.data.password,
        email_confirm: true,
      });
      if (createError || !created.user) {
        console.error("[admin-bootstrap] auth user creation failed", { code: createError?.code ?? "unknown" });
        return { status: "error", message: "The owner account could not be created. Check the email and try again." };
      }
      userId = created.user.id;
      createdAuthUser = true;
    }
  }

  const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
    password: parsed.data.password,
    email_confirm: true,
  });
  if (passwordError) {
    console.error("[admin-bootstrap] password setup failed", { code: passwordError.code });
    if (createdAuthUser) await admin.auth.admin.deleteUser(userId);
    return { status: "error", message: "The owner password could not be saved. Please try again." };
  }

  let staffId = existingStaff?.id as string | undefined;
  const staffMutation = existingStaff
    ? await admin
      .from("staff_users")
      .update({ identity_provider_subject: userId, email, role: "admin", status: "active", updated_at: new Date().toISOString() })
      .eq("id", existingStaff.id)
    : await admin
      .from("staff_users")
      .insert({ identity_provider_subject: userId, email, role: "admin", status: "active" })
      .select("id")
      .single();

  if (staffMutation.error) {
    console.error("[admin-bootstrap] staff profile mutation failed", { code: staffMutation.error.code });
    if (createdAuthUser) await admin.auth.admin.deleteUser(userId);
    return { status: "error", message: "The owner account was not linked to the admin workspace. Please try again." };
  }
  staffId = staffId ?? (staffMutation.data?.id as string | undefined);

  if (staffId) {
    const { error: auditError } = await admin.from("audit_log").insert({
      actor_type: "system",
      action: "staff.owner_bootstrap_completed",
      entity_type: "staff_user",
      entity_id: staffId,
      request_id: crypto.randomUUID(),
      redacted_metadata: { email },
    });
    if (auditError) console.error("[admin-bootstrap] audit log failed", { code: auditError.code });
  }

  redirect("/admin/login?registered=1");
}
