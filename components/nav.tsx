"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard", short: "Home", icon: "◈" },
  { href: "/profile", label: "My Profile", short: "Profile", icon: "☺" },
  { href: "/jobs", label: "Jobs & Matches", short: "Jobs", icon: "✦" },
  { href: "/pipeline", label: "Pipeline", short: "Pipeline", icon: "⬢" },
  { href: "/contacts", label: "People", short: "People", icon: "✉" },
  { href: "/settings", label: "Settings", short: "Setup", icon: "⚙" },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-ink-200/70 bg-white/90 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {links.map((l) => {
        const active =
          l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${
              active ? "text-indigo-600" : "text-ink-400"
            }`}
          >
            <span className="text-lg leading-none">{l.icon}</span>
            {l.short}
          </Link>
        );
      })}
    </nav>
  );
}

export function Nav() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-ink-200/60 px-4 py-8 md:flex">
      <Link href="/" className="mb-10 flex items-center gap-2.5 px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/icon-192.png`}
          alt=""
          className="h-9 w-9 rounded-xl shadow-md shadow-indigo-500/30"
        />
        <span className="text-lg font-extrabold tracking-tight text-ink-900">
          JobFind
        </span>
      </Link>
      <nav className="flex flex-col gap-1">
        {links.map((l) => {
          const active =
            l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-white text-indigo-700 shadow-card"
                  : "text-ink-500 hover:bg-white/60 hover:text-ink-800"
              }`}
            >
              <span
                className={`text-base ${active ? "text-indigo-500" : "text-ink-400"}`}
              >
                {l.icon}
              </span>
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-fuchsia-50 p-4">
        <p className="text-xs font-semibold text-indigo-900">
          Every application is a rep.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">
          You only need one yes — keep the pipeline moving.
        </p>
      </div>
    </aside>
  );
}
