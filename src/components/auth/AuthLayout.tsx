import Image from "next/image";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";

/**
 * Shared shell for Login and Signup — a navy brand panel (wordmark, tagline,
 * one restrained gold accent) beside the authentication form. The one place
 * in the product allowed a deliberate first-impression moment; every other
 * screen stays on the plain operational shell.
 */
export function AuthLayout({
  formTitle,
  formDescription,
  children,
  footer,
  extra,
}: {
  formTitle: string;
  formDescription?: string;
  children: ReactNode;
  footer: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <div className="relative flex flex-col items-center justify-center overflow-hidden bg-brand-navy px-6 py-8 md:w-1/2 md:py-16">
        <svg aria-hidden="true" viewBox="0 0 400 400" className="pointer-events-none absolute -right-28 -top-28 h-[380px] w-[380px] opacity-[0.07]">
          <circle cx="200" cy="200" r="180" fill="none" stroke="#F7F5F0" strokeWidth="1" />
          <circle cx="200" cy="200" r="138" fill="none" stroke="#C6A15B" strokeWidth="1" />
          <circle cx="200" cy="200" r="98" fill="none" stroke="#F7F5F0" strokeWidth="1" />
        </svg>
        <svg aria-hidden="true" viewBox="0 0 400 400" className="pointer-events-none absolute -bottom-32 -left-32 h-[340px] w-[340px] opacity-[0.06]">
          <circle cx="200" cy="200" r="160" fill="none" stroke="#C6A15B" strokeWidth="1" />
        </svg>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[36%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(198,161,91,0.16) 0%, rgba(198,161,91,0) 70%)" }}
        />

        <div className="auth-fade-in relative flex w-full max-w-[360px] flex-col items-center text-center">
          <div className="w-full max-w-[190px] overflow-hidden rounded-2xl shadow-modal ring-1 ring-brand-gold/35 md:max-w-[300px]">
            <Image
              src="/brand/salesleak/salesleak-master-dark.png"
              alt="SalesLeak by NobleArc"
              width={1774}
              height={887}
              priority
              sizes="300px"
              className="h-auto w-full"
            />
          </div>

          <div className="metallic-gold mt-4 h-[2px] w-10 rounded-full md:mt-6" />

          <p className="mt-4 text-lg font-semibold tracking-tight text-brand-warm-white md:mt-5 md:text-2xl">
            Catch what your sales process misses.
          </p>
          <p className="mt-3 hidden max-w-[320px] text-sm leading-relaxed text-brand-warm-white/60 md:block">
            Track leads, quotations and follow-ups in one place — and see what needs attention before revenue slips away.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-brand-warm-white px-6 py-10 md:py-16">
        <div className="auth-fade-in w-full max-w-sm" style={{ animationDelay: "70ms" }}>
          <div className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight text-brand-navy">{formTitle}</h1>
            {formDescription && <p className="mt-1.5 text-sm text-slate-500">{formDescription}</p>}
          </div>

          <Card>{children}</Card>

          <p className="mt-5 text-center text-sm text-slate-500">{footer}</p>

          {extra}
        </div>
      </div>
    </div>
  );
}
