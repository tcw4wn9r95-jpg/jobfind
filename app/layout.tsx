import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MobileNav, Nav } from "@/components/nav";

const BP = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "JobFind — your job search, on offense",
  description:
    "Track roles, score matches with Claude, tailor your CV and land the job.",
  manifest: `${BP}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "JobFind",
  },
  icons: {
    icon: `${BP}/icon-192.png`,
    apple: `${BP}/apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f7fb",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen max-w-7xl">
          <Nav />
          <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 md:py-8 md:pb-8 lg:px-10">
            {children}
          </main>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
