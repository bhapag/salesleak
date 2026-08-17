"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signup } from "@/server/actions/auth";
import { Field, PrimaryButton, ErrorText, inputClass } from "@/components/ui";

export function SignupForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signup({ companyName, ownerName, email, password });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/onboarding");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Company name" required>
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Shree Balaji Industrial Equipments"
          autoComplete="organization"
          className={inputClass}
          required
        />
      </Field>
      <Field label="Your name" required>
        <input
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="Your full name"
          autoComplete="name"
          className={inputClass}
          required
        />
      </Field>
      <Field label="Email" required>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.in"
          autoComplete="username"
          className={inputClass}
          required
        />
      </Field>
      <Field label="Password" required helper="At least 8 characters">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          minLength={8}
          className={inputClass}
          required
        />
      </Field>
      {error && (
        <div role="alert" aria-live="polite">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
      <PrimaryButton type="submit" loading={pending} className="w-full">
        {pending ? "Creating workspace…" : "Create workspace"}
      </PrimaryButton>
    </form>
  );
}
