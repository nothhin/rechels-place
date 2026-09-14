import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rechel's Place",
    short_name: "Rechel's Place",
    description:
      "Book a fully furnished two-bedroom condo at Deca Homes Tower 1, Banilad, Cebu City.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f3ed",
    theme_color: "#4a2d24",
    icons: [
      {
        src: "/images/rechel-s-place/logo.svg",
        sizes: "200x200",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
