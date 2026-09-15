import type { Metadata } from "next";
import { EB_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "sweetalert2/dist/sweetalert2.min.css";
import GuestMenu from "./GuestMenu";
import BrowserViewPrompt from "./BrowserViewPrompt";
import { propertyLogoSrc } from "@/lib/property";

const bodyFont = Plus_Jakarta_Sans({ variable: "--font-body", subsets: ["latin"] });
const displayFont = EB_Garamond({ variable: "--font-display", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "Rechel's Place | Staycation", template: "%s | Rechel's Place" },
  description: "Stay in Rechel's entire two-bedroom condo in Cagayan de Oro, with 5 beds, 2.5 baths, 100 Mbps Wi-Fi, a 65-inch HDTV, pool access, and keypad self check-in.",
  applicationName: "Rechel's Place",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: propertyLogoSrc, type: "image/png" }],
    apple: [{ url: propertyLogoSrc, type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rechel's Place",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}><body>{children}<GuestMenu /><BrowserViewPrompt /></body></html>;
}
