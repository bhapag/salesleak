import Image from "next/image";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";

/**
 * Shared shell for Login and Signup — one vertical composition on a navy
 * canvas: brand identity, tagline, then the auth card. Not a split layout —
 * everything reads as a single page, not two panels sitting side by side.
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-navy px-6 py-12">
      <svg aria-hidden="true" viewBox="0 0 400 400" className="pointer-events-none absolute -right-28 -top-28 h-[380px] w-[380px] opacity-[0.06]">
        <circle cx="200" cy="200" r="180" fill="none" stroke="#F7F5F0" strokeWidth="1" />
        <circle cx="200" cy="200" r="138" fill="none" stroke="#C6A15B" strokeWidth="1" />
        <circle cx="200" cy="200" r="98" fill="none" stroke="#F7F5F0" strokeWidth="1" />
      </svg>
      <svg aria-hidden="true" viewBox="0 0 400 400" className="pointer-events-none absolute -bottom-32 -left-32 h-[340px] w-[340px] opacity-[0.05]">
        <circle cx="200" cy="200" r="160" fill="none" stroke="#C6A15B" strokeWidth="1" />
      </svg>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[26%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(198,161,91,0.14) 0%, rgba(198,161,91,0) 70%)" }}
      />

      <div className="relative w-full max-w-sm">
        <div className="auth-fade-in flex flex-col items-center text-center">
          <Image
            src="/brand/salesleak/salesleak-master-dark.png"
            alt="SalesLeak by NobleArc"
            width={1774}
            height={887}
            priority
            sizes="240px"
            className="h-auto w-full max-w-[190px] sm:max-w-[230px]"
          />
          <div className="metallic-gold mt-5 h-[2px] w-10 rounded-full" />
          <p className="mt-4 text-lg font-semibold tracking-tight text-brand-warm-white sm:text-xl">Catch what your sales process misses.</p>
          <p className="mt-2 max-w-[300px] text-sm leading-relaxed text-brand-warm-white/55">
            Track leads, quotations and follow-ups in one place — and see what needs attention before revenue slips away.
          </p>
        </div>

        <div className="auth-fade-in mt-8" style={{ animationDelay: "80ms" }}>
          <div className="mb-4 text-center">
            <h1 className="text-lg font-semibold tracking-tight text-brand-warm-white">{formTitle}</h1>
            {formDescription && <p className="mt-1 text-sm text-brand-warm-white/55">{formDescription}</p>}
          </div>

          <Card>{children}</Card>

          <p className="mt-5 text-center text-sm text-brand-warm-white/60">{footer}</p>
        </div>

        {extra && (
          <div className="auth-fade-in mt-6" style={{ animationDelay: "140ms" }}>
            {extra}
          </div>
        )}
      </div>
    </div>
  );
}
