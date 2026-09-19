import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { propertyLogoSrc } from "@/lib/property";
import { getAdminBootstrapConfig } from "@/lib/server/admin-bootstrap-config";
import { RegisterForm } from "./RegisterForm";
import styles from "../login/login.module.css";

export const metadata: Metadata = {
  title: "Owner setup | Rechel's Place",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default function AdminBootstrapPage() {
  const config = getAdminBootstrapConfig();
  if (!config.enabled) redirect("/admin/login");

  return <main className={styles.shell}>
    <section className={styles.card}>
      <Link href="/" className={styles.brand}><Image src={propertyLogoSrc} alt="Rechel’s Place" width={58} height={58} /><div><strong>Rechel’s Place</strong><small>Cagayan de Oro · Entire condo</small></div></Link>
      <div className={styles.copy}><p>ONE-TIME OWNER SETUP</p><h1>Create access.</h1><span>This temporary setup creates the property owner’s admin account. Enter the email she wants to use. It is available only while the protected setup setting is enabled.</span></div>
      <RegisterForm email={config.email} />
      <p className={styles.warning}>After the account is created, disable the owner setup setting in Vercel and redeploy. Normal sign-in will remain available.</p>
      <Link className={styles.backLink} href="/admin/login">Back to staff sign in</Link>
    </section>
  </main>;
}
