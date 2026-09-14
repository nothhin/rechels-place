"use client";

import { useActionState, useEffect } from "react";
import { signIn } from "../actions";
import { showError } from "@/lib/sweetalert";
import styles from "./login.module.css";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined);
  useEffect(() => { if (state?.error) void showError(state.error); }, [state?.error]);
  return <form action={action} className={styles.form}>
    <label><span>Email address</span><input name="email" type="email" autoComplete="username" required /></label>
    <label><span>Password</span><input name="password" type="password" autoComplete="current-password" minLength={8} required /></label>
    {state?.error ? <p className={styles.error} role="alert">{state.error}</p> : null}
    <button disabled={pending} type="submit">{pending ? "Signing in…" : "Sign in securely"}</button>
  </form>;
}
