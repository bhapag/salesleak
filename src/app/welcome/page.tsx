import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";

const TITLE = "SalesLeak by NobleArc — Catch what your sales process misses";
const DESCRIPTION =
  "See which leads and quotations are at risk before revenue is lost. SalesLeak gives industrial B2B sales teams one place to track enquiries, quotations, and follow-ups — and flags what's about to fall through the cracks.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "SalesLeak by NobleArc", type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
  robots: { index: true, follow: true },
};

const LEAK_POINTS = [
  {
    label: "Missed follow-ups",
    detail: "A quotation goes quiet for three weeks because no one was ever told to check back.",
  },
  {
    label: "Forgotten leads",
    detail: "A WhatsApp enquiry sits in someone's phone, never logged, never assigned, never followed up.",
  },
  {
    label: "Overdue quotations",
    detail: "Pricing goes out, then nothing — no scheduled next step, no reminder, no owner watching it.",
  },
  {
    label: "Missed repeat orders",
    detail: "A customer who reorders every quarter goes eight months without anyone reaching out.",
  },
];

const INVARIANT = [
  { k: "Owner", d: "Someone specific is responsible — never \"the team.\"" },
  { k: "Status", d: "Where it actually stands, not where it was last week." },
  { k: "Next action", d: "The next concrete thing that needs to happen." },
  { k: "Deadline", d: "A date it needs to happen by — so \"soon\" becomes real." },
];

const FUNNEL = ["Enquiry", "Contact", "Requirement", "Quotation", "Follow-up", "Negotiation", "Won / Lost", "Repeat order"];

const CAPABILITIES = [
  {
    title: "See what's at risk, first",
    body: "The dashboard leads with Money at Risk — the revenue tied to leads and quotations that need a human to act right now — not a wall of charts nobody reads.",
    wide: true,
  },
  {
    title: "Every enquiry, one pipeline",
    body: "CSV import, manual entry, live Website Forms, and IndiaMART all feed the same lead pipeline, so nothing arrives into a separate inbox and gets forgotten.",
  },
  {
    title: "Quotations with a memory",
    body: "Line items, totals, and status live next to the lead that produced them — with follow-up dates instead of quotations that just go quiet.",
  },
  {
    title: "Repeat orders, surfaced",
    body: "For customers with a real ordering pattern, SalesLeak estimates when they're due again and flags it — a signal to go check on, not a guarantee.",
  },
  {
    title: "Built for a real sales team",
    body: "Owners see the whole business. Sales Managers see and reassign the team's work. Salespeople work their own queue in My Day. Nobody sees another company's data, ever.",
    wide: true,
  },
];

const FAQ = [
  {
    q: "Is there a free trial?",
    a: "Yes — every new company gets 14 days with full functionality, no credit card required to start.",
  },
  {
    q: "What happens if we don't upgrade after the trial?",
    a: "The workspace becomes read-only. Everyone keeps seeing their data exactly as it was, and export always keeps working — nobody's records are held hostage by a billing lapse.",
  },
  {
    q: "Is IndiaMART actually connected?",
    a: "The connector is real and testable end to end, but it's honestly labeled Test Mode until you point your own IndiaMART seller account's Push API at it — we never claim a live connection you haven't set up yourself.",
  },
  {
    q: "Can we get our data back out?",
    a: "Yes. An Owner can export customers, leads, and quotations as CSV at any time, for your own records or backup.",
  },
  {
    q: "Who can see our sales data?",
    a: "Only people you add to your company workspace. Access is scoped server-side by role and company — not by what the interface happens to show.",
  },
];

export default async function WelcomePage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="min-h-screen bg-brand-warm-white">
      {/* ---------- HERO (navy) ---------- */}
      <div className="relative overflow-hidden bg-brand-navy">
        <svg aria-hidden="true" viewBox="0 0 400 400" className="pointer-events-none absolute -right-24 -top-32 h-[420px] w-[420px] opacity-[0.06]">
          <circle cx="200" cy="200" r="180" fill="none" stroke="#F7F5F0" strokeWidth="1" />
          <circle cx="200" cy="200" r="138" fill="none" stroke="#C6A15B" strokeWidth="1" />
          <circle cx="200" cy="200" r="98" fill="none" stroke="#F7F5F0" strokeWidth="1" />
        </svg>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-[8%] top-[10%] h-[380px] w-[380px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(198,161,91,0.12) 0%, rgba(198,161,91,0) 70%)" }}
        />

        <div className="relative mx-auto flex max-w-6xl flex-col px-6 py-6 sm:px-8">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/brand/salesleak/salesleak-icon-master.png" alt="SalesLeak" width={26} height={26} className="shrink-0 rounded-[7px]" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold tracking-tight text-brand-warm-white">SalesLeak</span>
                <span className="text-[10px] text-brand-warm-white/45">
                  by <span className="text-brand-gold">NobleArc</span>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-sm font-medium text-brand-warm-white/80 transition-colors duration-(--dur-micro) hover:text-brand-warm-white">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-brand-warm-white px-3.5 py-2 text-sm font-medium text-brand-navy transition-colors duration-(--dur-micro) hover:bg-white"
              >
                Get started
              </Link>
            </div>
          </nav>

          <div className="mt-14 grid grid-cols-1 items-center gap-12 pb-20 lg:mt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pb-28">
            <div className="auth-fade-in">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-gold">Sales-leakage prevention for B2B</p>
              <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-tight text-brand-warm-white sm:text-5xl">
                Catch what your sales process misses.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-brand-warm-white/65">{DESCRIPTION}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="rounded-lg bg-brand-warm-white px-5 py-2.5 text-sm font-medium text-brand-navy transition-colors duration-(--dur-micro) hover:bg-white"
                >
                  Start your 14-day trial
                </Link>
                <Link
                  href="#how-it-works"
                  className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-medium text-brand-warm-white transition-colors duration-(--dur-micro) hover:bg-white/5"
                >
                  See how it works
                </Link>
              </div>
              <p className="mt-5 text-xs text-brand-warm-white/40">No credit card required. Read-only, never deleted, if you don&apos;t upgrade.</p>
            </div>

            <div className="auth-fade-in" style={{ animationDelay: "100ms" }}>
              <HeroMockup />
            </div>
          </div>
        </div>
      </div>

      {/* ---------- WHERE REVENUE LEAKS ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">The problem</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Deals don&apos;t usually die on merit. They die from silence.
          </h2>
          <p className="mt-3 text-slate-600 leading-relaxed">
            Enquiries arrive from WhatsApp, phone calls, email, your website, IndiaMART, and referrals — and get lost in
            inboxes, chat threads, and memory. Revenue leaks out one unanswered follow-up at a time.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2">
          {LEAK_POINTS.map((p) => (
            <div key={p.label} className="flex gap-4 border-t-2 border-red-100 pt-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{p.label}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{p.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- THE CORE RULE ---------- */}
      <section className="border-y border-slate-200 bg-white py-20">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">The core rule</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Every active lead should have four things. SalesLeak makes it obvious when one is missing.
            </h2>
          </div>

          <div className="mt-10 flex flex-col divide-y divide-slate-100 sm:flex-row sm:divide-x sm:divide-y-0">
            {INVARIANT.map((item, i) => (
              <div key={item.k} className="flex flex-1 items-start gap-3 py-4 sm:flex-col sm:gap-2 sm:px-6 sm:py-0 first:sm:pl-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-semibold text-brand-warm-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.k}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{item.d}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-2xl text-sm text-slate-500">
            &ldquo;Active&rdquo; means not Won and not Lost. If any of the four is missing, the lead is flagged as needing
            attention — that&apos;s not a polish feature, it&apos;s the whole point.
          </p>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-20 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">How it works</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            The funnel doesn&apos;t stop at Won.
          </h2>
          <p className="mt-3 text-slate-600 leading-relaxed">
            A won deal is a customer relationship, not a closed ticket. Industrial buyers reorder on a cadence —
            SalesLeak keeps watching after the sale.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-y-3 overflow-x-auto">
          {FUNNEL.map((step, i) => (
            <div key={step} className="flex shrink-0 items-center">
              <span
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ${
                  step === "Won / Lost"
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {step}
              </span>
              {i < FUNNEL.length - 1 && <span className="mx-2 h-px w-6 shrink-0 bg-slate-300" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </section>

      {/* ---------- CAPABILITIES ---------- */}
      <section className="border-y border-slate-200 bg-white py-20">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">What you get</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              One workspace for the whole sales process.
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CAPABILITIES.map((c) => (
              <div
                key={c.title}
                className={`rounded-xl border border-slate-200 bg-white p-6 shadow-card ${c.wide ? "sm:col-span-2" : ""}`}
              >
                <p className="text-base font-semibold text-slate-900">{c.title}</p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- TRUST ---------- */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Who it&apos;s for</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Built for industrial B2B — manufacturers, distributors, and traders.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              For businesses where enquiries come in by phone, WhatsApp, email, and trade platforms, and a sales
              team is trying to keep track of it all without a system built for it.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">How your data is handled</p>
            <ul className="mt-4 flex flex-col gap-3">
              {[
                "Every company's data is isolated server-side — never filtered client-side, never shared across workspaces.",
                "Access is scoped by role: Owner, Sales Manager, or Salesperson, enforced on every request.",
                "Real authentication with hashed passwords and database-backed sessions — no shortcuts.",
                "Export your customers, leads, and quotations as CSV at any time. Your data is never held hostage.",
              ].map((line) => (
                <li key={line} className="flex gap-3 text-sm leading-relaxed text-slate-600">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="border-t border-slate-200 bg-white py-20">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Questions</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Before you start</h2>

          <div className="mt-10 grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-2">
            {FAQ.map((item) => (
              <div key={item.q}>
                <p className="text-sm font-semibold text-slate-900">{item.q}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FINAL CTA (navy) ---------- */}
      <div className="bg-brand-navy">
        <div className="mx-auto max-w-6xl px-6 py-16 text-center sm:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-brand-warm-white sm:text-3xl">
            See what your pipeline is missing.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-brand-warm-white/60">
            14 days, full functionality, no credit card required.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-brand-warm-white px-5 py-2.5 text-sm font-medium text-brand-navy transition-colors duration-(--dur-micro) hover:bg-white"
            >
              Start your trial
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-medium text-brand-warm-white transition-colors duration-(--dur-micro) hover:bg-white/5"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>

      {/* ---------- FOOTER ---------- */}
      <footer className="bg-brand-navy">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 border-t border-white/10 px-6 py-8 text-center sm:px-8">
          <p className="text-xs text-brand-warm-white/45">
            SalesLeak is a product of <span className="text-brand-gold">NobleArc</span> Technologies.
          </p>
          <p className="text-[11px] text-brand-warm-white/30">© {new Date().getFullYear()} NobleArc Technologies.</p>
        </div>
      </footer>
    </div>
  );
}

/** A static, restrained recreation of the real Dashboard's Money at Risk
 * card + Attention Required rows — same classes/colors as the actual app,
 * not a generic illustration, so this is honestly "the real UI," just
 * hand-composed with representative numbers instead of a live screenshot. */
function HeroMockup() {
  return (
    <div className="rounded-xl border border-white/10 bg-brand-warm-white p-1 shadow-modal">
      <div className="rounded-lg bg-white">
        <div className="border-b border-red-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wide text-red-700">Money at Risk</span>
          </div>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-red-700">₹2,73,500</p>
          <p className="mt-1 text-xs text-slate-500">Revenue tied to leads and quotations that need action right now.</p>
        </div>
        <ul className="divide-y divide-slate-100">
          {[
            { name: "Vikram Pumps & Fittings", note: "Overdue for a repeat order", amount: "₹2,10,000", tone: "red" },
            { name: "Gate valve order — Bharat Engineering", note: "Overdue by 8 days", amount: "₹1,28,000", tone: "red" },
            { name: "Butterfly valves — Om Sai Chemicals", note: "No next action set", amount: "₹43,200", tone: "amber" },
          ].map((row) => (
            <li key={row.name} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{row.name}</p>
                <p className={`text-xs font-medium ${row.tone === "red" ? "text-red-600" : "text-amber-700"}`}>{row.note}</p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums text-slate-700">{row.amount}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
