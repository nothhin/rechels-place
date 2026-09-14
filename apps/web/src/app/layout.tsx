import type { Metadata } from "next";
import { EB_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "sweetalert2/dist/sweetalert2.min.css";
import GuestMenu from "./GuestMenu";
import BrowserViewPrompt from "./BrowserViewPrompt";

const bodyFont = Plus_Jakarta_Sans({ variable: "--font-body", subsets: ["latin"] });
const displayFont = EB_Garamond({ variable: "--font-display", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "Rechel's Place | Staycation", template: "%s | Rechel's Place" },
  description: "Stay in a fully furnished two-bedroom condo with Wi-Fi, a 55-inch HDTV, kitchen, air conditioning, and smart self check-in at Deca Homes Tower 1, Banilad, Cebu City.",
  applicationName: "Rechel's Place",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rechel's Place",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}><body>{children}<GuestMenu /><BrowserViewPrompt /></body></html>;
}
