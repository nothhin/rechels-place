import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";
import { propertyLogoSrc } from "@/lib/property";
import { getAdminBootstrapConfig } from "@/lib/server/admin-bootstrap-config";

export const metadata: Metadata = { title: "Staff sign in | Rechel's Place", robots: { index: false, follow: false } };

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string; registered?: string }> }) {
  const params = await searchParams;
  const bootstrap = getAdminBootstrapConfig();
  return <main className={styles.shell}>
    <section className={styles.card}>
      <Link href="/" className={styles.brand}><Image src={propertyLogoSrc} alt="Rechel’s Place" width={58} height={58} /><div><strong>Rechel’s Place</strong><small>Cagayan de Oro · Entire condo</small></div></Link>
      <div className={styles.copy}><p>STAFF PORTAL</p><h1>Welcome back.</h1><span>Sign in with the staff account issued by the property administrator.</span></div>
      {params.registered === "1" ? <p className={styles.success} role="status">Owner account created. Sign in with the email and password you just set.</p> : null}
      {params.error === "not-authorized" ? <p className={styles.error}>This account is not an active Rechel’s Place staff account.</p> : null}
      <LoginForm />
      {bootstrap.enabled ? <Link className={styles.bootstrapLink} href="/admin/bootstrap">One-time owner setup</Link> : null}
      <small className={styles.help}>Access is logged. Contact the property administrator if you need an account or password reset.</small>
    </section>
  </main>;
}
