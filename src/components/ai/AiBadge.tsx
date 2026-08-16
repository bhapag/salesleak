// Deliberately quiet — no gradients, no robot iconography. A small, muted
// pill so AI-assisted content is always visually distinguishable from the
// deterministic data around it, without competing for attention.
export function AiBadge({ mocked }: { mocked?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
      <span aria-hidden>✦</span> AI{mocked ? " · Dev Mode" : ""}
    </span>
  );
}
