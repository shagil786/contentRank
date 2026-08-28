import Link from "next/link";

export function LegalPage({
  eyebrow,
  title,
  updated = "August 27, 2026",
  children,
}: {
  eyebrow: string;
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-paper text-ink px-5 py-8 sm:px-10 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="font-mono text-[10px] tracking-widest text-signal hover:underline">
          ← BACK TO OUTRANK
        </Link>
        <div className="mt-10 border-b border-rule pb-7">
          <div className="font-mono text-[10px] tracking-widest text-signal">{eyebrow}</div>
          <h1 className="mt-3 font-display text-4xl leading-none tracking-tighter2 sm:text-6xl">{title}</h1>
          <p className="mt-4 font-mono text-[10px] tracking-widest text-muted-foreground">LAST UPDATED · {updated.toUpperCase()}</p>
        </div>
        <article className="legal-copy py-8 text-sm leading-7 sm:text-base">{children}</article>
        <div className="border-t border-rule py-6 font-mono text-[10px] tracking-widest text-muted-foreground">
          QUESTIONS · <a className="text-signal hover:underline" href="mailto:shagil@content-rank.lol">SHAGIL@CONTENT-RANK.LOL</a>
        </div>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs font-semibold tracking-widest">{title.toUpperCase()}</h2>
      <div className="space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}
