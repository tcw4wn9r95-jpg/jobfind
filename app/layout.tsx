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
    // iOS shows these while the installed app launches. Sizes cover current
    // iPhones; unlisted devices just skip the splash.
    startupImage: [
      { url: `${BP}/splash/splash-1290x2796.png`, media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: `${BP}/splash/splash-1179x2556.png`, media: "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: `${BP}/splash/splash-1284x2778.png`, media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: `${BP}/splash/splash-1170x2532.png`, media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: `${BP}/splash/splash-1125x2436.png`, media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: `${BP}/splash/splash-1242x2688.png`, media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" },
      { url: `${BP}/splash/splash-828x1792.png`, media: "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
      { url: `${BP}/splash/splash-750x1334.png`, media: "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" },
    ],
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
        {/* Branded splash shown only when launched from the home screen (CSS-gated) */}
        <div className="app-splash" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${BP}/icon-192.png`} alt="" width={96} height={96} />
          <span>JobFind</span>
        </div>
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
