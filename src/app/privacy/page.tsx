import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy & your data",
  description: "How Sonora handles what you write and what it stores.",
};

const SECTIONS = [
  {
    h: "What happens to what you write",
    p: [
      "When you check in, your text is used once to estimate how you feel, and then discarded. Sonora does not log it, store it, or use it to train anything.",
      "Depending on how this deployment is set up, the text is read either by a language model through Anthropic's API (sent over an encrypted connection from Sonora's server; Sonora does not store it), or by Sonora's own model running entirely inside your browser, in which case it never leaves your device. The check-in screen always tells you which one will be used, and you can choose \"on this device only\" in your library settings.",
      "Sonora screens for phrases about self-harm so it can show support resources. That check runs on the same text and is not stored either.",
    ],
  },
  {
    h: "What Sonora stores",
    p: [
      "As a guest: favourites, playlists, listening history and preferences are saved in your browser's local storage. Nothing is sent to a server.",
      "With an account: the same items are stored in Sonora's database (Supabase), protected so that only your account can read or change them.",
      "The mood journal is off by default. If you turn it on, each entry stores the mood, any secondary moods, the intensity, which analyser was used and the time. Your words are only saved if you tick \"include what I wrote\" for that entry.",
    ],
  },
  {
    h: "What Sonora never does",
    p: [
      "Sell, share or expose your mood information. Infer diagnoses, health conditions or other sensitive attributes. Present music as treatment. Sonora is a listening experience, not a mental-health service.",
    ],
  },
  {
    h: "Your controls",
    p: [
      "You can delete single mood entries, all mood entries, all of your data, or your whole account from your library page at any time. Signing out clears the copy kept in your browser.",
    ],
  },
  {
    h: "If you're struggling",
    p: [
      "Please reach out to someone you trust, or find a free, confidential helpline in your country at findahelpline.com. If you are in immediate danger, call your local emergency number.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 md:pt-12">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted">Privacy</p>
      <h1 className="font-display mt-4 text-[clamp(2.4rem,6vw,4rem)] leading-[1.02]">Your feelings are yours.</h1>
      <p className="mt-5 text-lg text-muted">A plain-language account of how Sonora treats what you tell it.</p>
      <div className="mt-12 space-y-10">
        {SECTIONS.map((s) => (
          <section key={s.h}>
            <h2 className="text-xl font-semibold">{s.h}</h2>
            {s.p.map((para) => (
              <p key={para.slice(0, 32)} className="mt-3 leading-relaxed text-muted">
                {para}
              </p>
            ))}
          </section>
        ))}
      </div>
      <p className="mt-12 text-sm text-faint">
        Manage your data from <Link href="/profile#data" className="text-ink underline underline-offset-4">your library</Link>.
      </p>
    </article>
  );
}
