/**
 * Powered by Homestead — KNMPlace
 *
 * This footer is required by the Homestead license (MIT with Attribution).
 * It must remain visible on all authenticated pages and may not be removed,
 * hidden, or obscured. See LICENSE for full terms.
 */

export function PoweredByFooter() {
  return (
    <footer
      className="w-full text-center py-4 mt-8"
      style={{ borderTop: "1px solid var(--border)", opacity: 0.5 }}
    >
      <a
        href="https://knmplace.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs theme-text-muted hover:opacity-100 transition-opacity"
        style={{ textDecoration: "none", letterSpacing: "0.04em" }}
      >
        Powered by Homestead &mdash; KNMPlace
      </a>
    </footer>
  );
}
