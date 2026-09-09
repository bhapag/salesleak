/**
 * Icons for the Dashboard's KPI tier. Same visual language as the
 * hand-rolled Sidebar icons (20x20 viewbox, stroke 1.6, rounded caps, no
 * fill) — a shared, separate file because these are metric-specific rather
 * than navigation-specific, and Sidebar's icons are private to that file.
 * No icon library dependency; consistent with how the rest of this app
 * avoids adding one for something this contained (see lib/csv.ts).
 */

export function OverdueIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="10" cy="10.5" r="6.5" />
      <path d="M10 7.5v3l2 1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 2.5h5" strokeLinecap="round" />
    </svg>
  );
}

export function NextActionIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M3 5.5h14M3 10h14M3 14.5h9" strokeLinecap="round" />
      <circle cx="16" cy="14.5" r="2.4" fill="currentColor" stroke="none" opacity="0.16" />
      <path d="M16 13.2v1.5l1 .7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UncontactedIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M4 4.5h12a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1v-9a1 1 0 011-1z" strokeLinejoin="round" />
      <path d="M3.3 5.2L10 10.5l6.7-5.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function QuotationOverdueIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M5 3h6l3 3v10.5a.5.5 0 01-.5.5H5a.5.5 0 01-.5-.5V3.5A.5.5 0 015 3z" strokeLinejoin="round" />
      <path d="M7 9h4M7 11.5h4" strokeLinecap="round" />
      <circle cx="14.5" cy="14" r="3" fill="var(--color-brand-warm-white, #fff)" />
      <path d="M14.5 12.6v1.4l.9.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="14.5" cy="14" r="3" />
    </svg>
  );
}

export function TodayWorkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <rect x="3" y="4" width="14" height="12.5" rx="1.5" />
      <path d="M3 7.5h14M7 2.5v3M13 2.5v3" strokeLinecap="round" />
      <circle cx="10" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TeamOverdueIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <circle cx="7" cy="6.5" r="2.3" />
      <path d="M2.5 16c0-2.6 1.9-4.5 4.5-4.5" strokeLinecap="round" />
      <circle cx="14" cy="13.5" r="3.5" />
      <path d="M14 11.8v1.7l1.1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NotificationIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M5 8.5a5 5 0 0110 0c0 3.2 1 4.3 1 4.3H4s1-1.1 1-4.3z" strokeLinejoin="round" />
      <path d="M8.2 15.3a1.9 1.9 0 003.6 0" strokeLinecap="round" />
    </svg>
  );
}

export function OpenQuotationIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M5 3h7l3 3v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" strokeLinejoin="round" />
      <path d="M7 9h6M7 12h6M7 15h3" strokeLinecap="round" />
    </svg>
  );
}

export function WonValueIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M10 2.5l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z" strokeLinejoin="round" />
    </svg>
  );
}

export function AttentionIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M10 3l7.5 13H2.5z" strokeLinejoin="round" />
      <path d="M10 8.3v3M10 14.2h.01" strokeLinecap="round" />
    </svg>
  );
}

export function AllClearIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path d="M10 2.5l6 2.2v4.8c0 4-2.6 6.8-6 8-3.4-1.2-6-4-6-8V4.7z" strokeLinejoin="round" />
      <path d="M7 10l2 2 4-4.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SparkleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M9.5 3l1 3.3L14 7.5l-3.5 1.2-1 3.3-1-3.3L5 7.5l3.5-1.2z" strokeLinejoin="round" />
      <path d="M15.3 12l.55 1.8L17.6 14.3l-1.75.5-.55 1.8-.55-1.8-1.75-.5 1.75-.5z" strokeLinejoin="round" />
    </svg>
  );
}
