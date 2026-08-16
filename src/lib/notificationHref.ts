/** Pure — safe to import from client components. No DB/server dependencies. */
export function getNotificationHref(entityType: string | null, entityId: string | null): string {
  if (!entityType || !entityId) return "/";
  if (entityType === "Lead") return `/leads/${entityId}`;
  if (entityType === "Quotation") return `/quotations/${entityId}`;
  if (entityType === "Customer") return `/customers/${entityId}`;
  return "/";
}
