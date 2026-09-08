import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

const TITLE = "Terms of Service";
const DESCRIPTION = "SalesLeak's Terms of Service — currently being finalized.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: `${TITLE} | SalesLeak`, description: DESCRIPTION, siteName: "SalesLeak by NobleArc", type: "website" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-brand-warm-white">
      <div className="border-b border-slate-200 bg-brand-navy">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6 sm:px-8">
          <Link href="/welcome" className="flex items-center gap-2">
            <Image src="/brand/salesleak/salesleak-icon-master.png" alt="SalesLeak" width={26} height={26} className="shrink-0 rounded-[7px]" />
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold tracking-tight text-brand-warm-white">SalesLeak</span>
              <span className="text-[10px] text-brand-warm-white/45">
                by <span className="text-brand-gold">NobleArc</span>
              </span>
            </div>
          </Link>
          <Link href="/welcome" className="text-sm font-medium text-brand-warm-white/80 transition-colors duration-(--dur-micro) hover:text-brand-warm-white">
            ← Back
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-6 py-16 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Terms of Service</h1>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-medium text-amber-800">This page isn&apos;t published yet.</p>
          <p className="mt-2 text-sm leading-relaxed text-amber-700">
            SalesLeak&apos;s Terms of Service are still being finalized and haven&apos;t been reviewed and published. Nothing
            on this page should be treated as a binding agreement — there isn&apos;t one here yet. We&apos;d rather tell you
            that plainly than publish something that only looks like a real terms document.
          </p>
        </div>

        <p className="mt-8 text-sm leading-relaxed text-slate-600">
          If you have a question about using SalesLeak — including anything you&apos;d normally expect a terms of service
          to cover — reach out and we&apos;ll answer directly:
        </p>
        <p className="mt-3">
          <a href="mailto:salesleak.support@gmail.com" className="text-sm font-medium text-brand-navy underline underline-offset-2">
            salesleak.support@gmail.com
          </a>
        </p>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-6 py-8 text-center sm:px-8">
          <p className="text-xs text-slate-400">
            SalesLeak is a product of <span className="text-[#B08A45]">NobleArc</span> Technologies.
          </p>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <Link href="/privacy" className="hover:text-slate-600 hover:underline">
              Privacy Policy
            </Link>
            <span aria-hidden="true">·</span>
            <a href="mailto:salesleak.support@gmail.com" className="hover:text-slate-600 hover:underline">
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
