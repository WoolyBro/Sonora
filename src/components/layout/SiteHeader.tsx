"use client";

import { Compass, Disc3, House, Sparkles, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/components/ui/styles";

import { BrandMark } from "./Brand";

export const NAV = [
  { href: "/", label: "Home", icon: House, mobileOnly: true },
  { href: "/experience", label: "Check in", icon: Sparkles },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/originals", label: "Originals", icon: Disc3 },
  { href: "/profile", label: "Library", icon: User },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`) || (href === "/discover" && pathname.startsWith("/collections"));
}

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="relative z-30">
      <a href="#main" className="sr-only rounded-full bg-ink px-4 py-2 text-bg focus:not-sr-only focus:absolute focus:left-4 focus:top-4">
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6 md:h-20">
        <Link href="/" className="flex items-center gap-2.5 rounded-xl" aria-label="Sonora home">
          <BrandMark />
          <span className="font-display text-[22px] tracking-tight">Sonora</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 rounded-full bg-white/[0.03] p-1 ring-1 ring-hairline md:flex">
          {NAV.filter((n) => !("mobileOnly" in n)).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(pathname, n.href) ? "page" : undefined}
              className={cn(
                "rounded-full px-4 py-2 text-sm transition",
                isActive(pathname, n.href) ? "bg-white/10 text-ink" : "text-muted hover:text-ink",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/experience"
          className="hidden rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg transition hover:bg-white md:inline-flex"
        >
          Discover your sound
        </Link>
      </div>
    </header>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="glass fixed inset-x-0 bottom-0 z-50 border-t border-hairline pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {NAV.map((n) => {
          const active = isActive(pathname, n.href);
          const Icon = n.icon;
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-full flex-col items-center justify-center gap-1 text-[11px]", active ? "text-ink" : "text-faint")}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-[var(--atmo-accent)]" : undefined} />
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
