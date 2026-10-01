/**
 * The browser tab / window title for a page (B-004). Screen readers read it when a page opens, so each page needs its own.
 * Today's heading is a greeting with her name, so the title says "Today" instead. Anything else uses the page's own heading.
 */
export function pageTitle(pathname: string, heading: string | null): string {
  if (pathname === '/') return 'Today – Steady';
  const h = (heading ?? '').replace(/\s+/g, ' ').trim();
  return h ? `${h} – Steady` : 'Steady';
}
