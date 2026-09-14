import type { MetadataRoute } from "next";
import { propertyLogoSrc } from "@/lib/property";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rechel's Place",
    short_name: "Rechel's Place",
    description:
      "Book Rechel's entire two-bedroom condo in Cagayan de Oro for up to 6 guests.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f3ed",
    theme_color: "#4a2d24",
    icons: [
      {
        src: propertyLogoSrc,
        sizes: "1280x1280",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
