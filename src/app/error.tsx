"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";

import { btn } from "@/components/ui/styles";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-4xl">Something slipped out of tune.</h1>
      <p className="mt-4 text-muted">This part of Sonora hit an error. Your music and library are fine.</p>
      <div className="mt-8 flex gap-3">
        <button type="button" onClick={reset} className={btn.primary}>
          <RotateCcw size={16} /> Try again
        </button>
        <Link href="/" className={btn.secondary}>
          Home
        </Link>
      </div>
    </div>
  );
}
