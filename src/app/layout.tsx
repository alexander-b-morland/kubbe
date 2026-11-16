import type { Metadata, Viewport } from "next";
import { Archivo, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

// Body and interface text.
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-schibsted",
});

// Times and headlines. The width axis is needed for the condensed cut.
const archivo = Archivo({
  subsets: ["latin"],
  display: "swap",
  axes: ["wdth"],
  variable: "--font-archivo",
});

export const metadata: Metadata = {
  title: "Kubbe",
  description:
    "Book the shower and the washing machine, and share the cleaning, with the people you live with.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f4ef",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${schibsted.variable} ${archivo.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
