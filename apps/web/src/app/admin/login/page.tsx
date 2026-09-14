import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "Staff sign in | Rechel's Place", robots: { index: false, follow: false } };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className={styles.shell}>
    <section className={styles.card}>
      <Link href="/" className={styles.brand}><Image src="/images/rechel-s-place/logo.svg" alt="Rechel’s Place" width={58} height={58} /><div><strong>Rechel’s Place</strong><small>Staycation · Condo Rental</small></div></Link>
      <div className={styles.copy}><p>STAFF PORTAL</p><h1>Welcome back.</h1><span>Sign in with the staff account issued by the property administrator.</span></div>
      {error === "not-authorized" ? <p className={styles.error}>This account is not an active Rechel’s Place staff account.</p> : null}
      <LoginForm />
      <small className={styles.help}>Access is logged. Contact the property administrator if you need an account or password reset.</small>
    </section>
  </main>;
}
