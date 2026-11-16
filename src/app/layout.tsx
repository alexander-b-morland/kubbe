import type { Metadata, Viewport } from "next";
import { Archivo, Schibsted_Grotesk } from "next/font/google";
import { Suspense } from "react";
import { KubbeLogo } from "@/components/logo/kubbe-logo";
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
  title: { default: "Kubbe", template: "%s | Kubbe" },
  description:
    "Take back your shower time, your slot with the washing machine, and make your roommates clean up the common areas. All with kubbe.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f4ef",
};

// Shown for the moment it takes to look up who is signed in.
function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading">
      <KubbeLogo label="" className="w-24 opacity-50" />
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${schibsted.variable} ${archivo.variable} antialiased`}
    >
      <body>
        {/*
          Most screens read the session cookie, which only exists at request time.
          With Cache Components that work has to sit inside a Suspense boundary.
        */}
        <Suspense fallback={<Loading />}>{children}</Suspense>
      </body>
    </html>
  );
}
