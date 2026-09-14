import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Cookie Notice | Rechel's Place", description: "Rechel's Place's essential-cookie and tracking notice." };

export default function CookiesPage() {
  return <main className="legal-shell">
    <header className="legal-header"><Link href="/">Rechel’s Place</Link><Link href="/#availability">Back to availability</Link></header>
    <article className="legal-content">
      <p className="eyebrow">Website storage and tracking</p><h1>Cookie Notice</h1><p className="legal-updated">Effective and last updated: August 10, 2026</p>
      <section><h2>Our current use of cookies</h2><p>The public Rechel’s Place booking site does not currently use advertising, analytics, or marketing cookies. Only essential cookies or similar storage may be used when necessary for secure operation, such as protecting and maintaining staff or administrator login sessions.</p></section>
      <section><h2>Remembering your booking on this device</h2><p>After you submit a booking request, the site stores the private booking-page address in your browser’s local storage so you can return to it after closing the app or browser. This information stays on that device and is not used for advertising. Anyone using the same browser profile could open the saved private page, so use the booking-reference lookup or clear site data when using a shared device.</p></section>
      <section><h2>Why there is no cookie banner</h2><p>Because optional tracking technologies are not currently enabled, the site does not show an opt-in cookie banner. Essential technology cannot be switched off through a consent banner when it is strictly needed to provide a requested or secure service. You can still configure your browser to block or delete cookies, but doing so may prevent protected features from working correctly.</p></section>
      <section className="legal-callout"><h2>Before analytics or marketing is added</h2><p>Rechel’s Place must revisit consent before enabling analytics, Meta Pixel, advertising, personalization, or any other optional tracking integration. Before those tools load, Rechel’s Place will inventory the cookies and processors involved, update this notice and the <Link href="/privacy">Privacy Notice</Link>, determine the appropriate legal basis, obtain opt-in consent where required, and provide a way to withdraw that consent.</p></section>
      <section><h2>Contact us</h2><p>Questions about this notice or the website’s data use may be sent through the contact details in our <Link href="/privacy">Privacy Notice</Link>.</p></section>
    </article>
  </main>;
}
