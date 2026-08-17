export function Card({ title, description, children, className = "" }: { title?: string; description?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-card ${className}`}>
      {title && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Field({
  label,
  helper,
  error,
  required,
  children,
}: {
  label: string;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500">
        {label}
        {required && <RequiredMark />}
      </span>
      {children}
      {error ? <ErrorText>{error}</ErrorText> : helper ? <HelperText>{helper}</HelperText> : null}
    </label>
  );
}

export function RequiredMark() {
  return (
    <span className="ml-0.5 text-red-500" aria-hidden="true">
      *
    </span>
  );
}

export function HelperText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-xs text-slate-400">{children}</p>;
}

export const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-(--dur-micro) focus:border-brand-navy focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export const inputErrorClass =
  "w-full rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-slate-900 placeholder:text-red-300 transition-colors duration-(--dur-micro) focus:border-red-400 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export const inputSuccessClass =
  "w-full rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-(--dur-micro) focus:border-emerald-400 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export const selectClass = inputClass;

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M18 10a8 8 0 0 0-8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all duration-(--dur-micro) active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean };

export function PrimaryButton({ children, className = "", loading = false, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`${buttonBase} bg-brand-navy text-brand-warm-white hover:bg-brand-navy-hover ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", loading = false, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`${buttonBase} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

export function GhostButton({ children, className = "", loading = false, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`${buttonBase} bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

export function DangerButton({ children, className = "", loading = false, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`${buttonBase} bg-red-600 text-white hover:bg-red-700 ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
}

export function IconButton({ children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors duration-(--dur-micro) hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-xs font-medium text-red-600">{children}</p>;
}

/** KPI/metric number typography foundation — tabular-nums so digits in a
 * grid line up, brand navy instead of generic dark gray. Not yet applied
 * to any page; adopted screen-by-screen in later implementation groups. */
export const metricClass = "font-semibold text-brand-navy tabular-nums";
