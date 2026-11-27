import Link from "next/link";

const LINKS = [
  { href: "/experience", label: "Check in" },
  { href: "/discover", label: "Discover" },
  { href: "/originals", label: "Originals" },
  { href: "/profile", label: "Library" },
  { href: "/privacy", label: "Privacy" },
];

/** Printed-poster footer: yellow stock, a halftone strip and a giant wordmark. */
export function Footer() {
  return (
    <footer data-site-footer="" className="relative z-10 mt-24 overflow-hidden bg-[#fff546] pb-[calc(var(--nav-h)+var(--player-h))] text-[#3d3b08]">
      <div className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link className="tap relative text-[15px] font-medium hover:underline hover:underline-offset-4" href={l.href}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className="font-serif text-[15px]">© Sonora · Made for listening</p>
        </div>

        <p className="font-serif mt-5 max-w-2xl text-sm leading-relaxed">
          Sonora is a music experience, not a medical or mental-health service. If you&rsquo;re struggling, please reach out to
          someone you trust or find a local helpline at{" "}
          <a className="tap relative underline underline-offset-2" href="https://findahelpline.com" target="_blank" rel="noreferrer">
            findahelpline.com
          </a>
          .
        </p>

        <div className="halftone halftone--yellow mt-6 h-40 sm:h-56">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative texture */}
          <img src="/artwork/mine-vast-silence.jpg" alt="" loading="lazy" className="object-[center_80%]" />
        </div>

        <p
          aria-hidden="true"
          className="font-headline mt-2 select-none text-center text-[clamp(5rem,27vw,24rem)] leading-[0.8] tracking-[-0.06em] text-[#66640f]"
        >
          Sonora
        </p>
      </div>
    </footer>
  );
}
