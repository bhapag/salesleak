"use client";

import { useState, useTransition } from "react";
import { createTeamUser, updateUserRole, setUserActive } from "@/server/actions/users";
import { Card, Field, PrimaryButton, SecondaryButton, ErrorText, inputClass, selectClass } from "@/components/ui";
import { labelize } from "@/lib/format";

type TeamUser = { id: string; name: string; email: string; role: "OWNER" | "SALES_MANAGER" | "SALESPERSON"; isActive: boolean };

const ROLES = ["OWNER", "SALES_MANAGER", "SALESPERSON"] as const;

export function ManageTeamCard({ users, currentUserId }: { users: TeamUser[]; currentUserId: string }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("SALESPERSON");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createTeamUser({ name, email, password, role });
      if (result.error) {
        setError(result.error);
        return;
      }
      setName("");
      setEmail("");
      setPassword("");
      setRole("SALESPERSON");
      setShowForm(false);
    });
  }

  function handleRoleChange(userId: string, newRole: (typeof ROLES)[number]) {
    setError(null);
    startTransition(async () => {
      try {
        await updateUserRole(userId, newRole);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleToggleActive(userId: string, isActive: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await setUserActive(userId, !isActive);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Card title="Manage Team" description="Owner-only: add team members, change roles, activate or deactivate accounts.">
      <ul className="flex flex-col divide-y divide-slate-100">
        {users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className={`text-sm ${u.isActive ? "text-slate-900" : "text-slate-400 line-through"}`}>{u.name}</p>
              <p className="text-xs text-slate-400">{u.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <select
                value={u.role}
                onChange={(e) => handleRoleChange(u.id, e.target.value as (typeof ROLES)[number])}
                disabled={pending}
                className={`${selectClass} py-1.5 text-xs`}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {labelize(r)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleToggleActive(u.id, u.isActive)}
                disabled={pending || u.id === currentUserId}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors duration-(--dur-micro) disabled:cursor-not-allowed disabled:opacity-40 ${
                  u.isActive ? "border-slate-200 text-slate-600 hover:bg-slate-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                {u.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {!showForm && <ErrorText>{error}</ErrorText>}

      {showForm ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Name">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Temporary password">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Role">
              <select value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])} className={selectClass}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {labelize(r)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <PrimaryButton onClick={handleCreate} disabled={pending}>
              {pending ? "Adding…" : "Add user"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowForm(false)} disabled={pending}>
              Cancel
            </SecondaryButton>
          </div>
        </div>
      ) : (
        <SecondaryButton className="mt-4" onClick={() => setShowForm(true)}>
          + Add team member
        </SecondaryButton>
      )}
    </Card>
  );
}
