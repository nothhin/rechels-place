"use client";

import { useActionState } from "react";
import { registerBootstrapAdmin } from "./actions";
import styles from "../login/login.module.css";

export function RegisterForm({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState(registerBootstrapAdmin, undefined);
  return <form action={action} className={styles.form}>
    <label>
      <span>Owner email</span>
      <input name="email" type="email" defaultValue={email ?? ""} readOnly={Boolean(email)} placeholder="owner@example.com" autoComplete="username" required />
    </label>
    <label>
      <span>Create password</span>
      <input name="password" type="password" minLength={8} maxLength={72} autoComplete="new-password" required />
    </label>
    <label>
      <span>Confirm password</span>
      <input name="confirmPassword" type="password" minLength={8} maxLength={72} autoComplete="new-password" required />
    </label>
    <label>
      <span>One-time setup code</span>
      <input name="setupSecret" type="password" maxLength={256} autoComplete="one-time-code" required />
    </label>
    {state?.message ? <p className={styles.error} role="alert">{state.message}</p> : null}
    <button disabled={pending} type="submit">{pending ? "Creating secure access…" : "Create owner admin account"}</button>
  </form>;
}
