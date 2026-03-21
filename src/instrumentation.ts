/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Used to launch the built-in job scheduler (replaces n8n).
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run in Node.js runtime (not Edge), and only in production or when
  // explicitly enabled in development via ENABLE_SCHEDULER=true
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production" && process.env.ENABLE_SCHEDULER !== "true") return;

  const { startScheduler } = await import("@/lib/scheduler");
  startScheduler();
}
