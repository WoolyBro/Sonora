"use client";

import { ArrowRight, Compass, Disc3, House, Sparkles, User } from "lucide-react";
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
    <header data-site-header="" className="sticky top-0 z-30">
      {/* soft frosted band that fades out downwards, so the page shows through */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -bottom-4 bg-[color-mix(in_oklab,var(--bg)_45%,transparent)] backdrop-blur-md [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
      />
      <a href="#main" className="sr-only rounded-full bg-ink px-4 py-2 text-bg focus:not-sr-only focus:absolute focus:left-4 focus:top-4">
        Skip to content
      </a>
      <div className="relative mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6 md:h-[72px]">
        <Link href="/" className="tap relative flex items-center gap-2" aria-label="Sonora home">
          <BrandMark className="h-6 w-6" />
          <span className="font-headline text-[24px] leading-none">Sonora</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {NAV.filter((n) => !("mobileOnly" in n)).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(pathname, n.href) ? "page" : undefined}
              className={cn(
                "tap relative text-[15px] font-medium transition",
                isActive(pathname, n.href) ? "text-ink underline decoration-2 underline-offset-[6px]" : "text-ink/75 hover:text-ink",
              )}
            >
              {n.label}
            </Link>
          ))}
          <Link href="/experience" className="tap group relative inline-flex items-center gap-1 text-[15px] font-semibold text-ink">
            Discover your sound
            <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </nav>
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
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-[var(--atmo-ink)]" : undefined} />
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
