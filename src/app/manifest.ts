import type { MetadataRoute } from "next";

// Lets people add Kubbe to their phone's home screen, where it opens like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kubbe",
    short_name: "Kubbe",
    description: "Shower, laundry and cleaning for people who share a home.",
    start_url: "/home",
    display: "standalone",
    background_color: "#f5f4ef",
    theme_color: "#f5f4ef",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
