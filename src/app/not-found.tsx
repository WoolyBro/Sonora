import Link from "next/link";

import { btn } from "@/components/ui/styles";
import { Doodle } from "@/components/ui/Doodle";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <Doodle name="cloud" float className="mb-4 h-16 w-20 text-[var(--atmo-ink)]" />
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted">404</p>
      <h1 className="font-display mt-4 text-5xl">This room is quiet.</h1>
      <p className="mt-4 text-muted">The page you were looking for isn&rsquo;t here.</p>
      <Link href="/" className={`${btn.primary} mt-8`}>
        Back home
      </Link>
    </div>
  );
}
