/** Poll only visible pages; never overlap requests and refresh immediately on return. */
export function startVisiblePolling(task: (signal: AbortSignal) => Promise<void>, intervalMs = 5_000) {
  let stopped = false;
  let pending = false;
  let controller: AbortController | undefined;
  async function tick() {
    if (stopped || pending || document.visibilityState === "hidden") return;
    pending = true;
    controller = new AbortController();
    const timeout = setTimeout(() => controller?.abort(), 10_000);
    try {
      await task(controller.signal);
    } catch {
      // Keep the last price and retry on the next visible tick.
    } finally {
      clearTimeout(timeout);
      pending = false;
    }
  }
  const timer = setInterval(() => void tick(), intervalMs);
  const onVisibility = () => { if (document.visibilityState === "visible") void tick(); };
  document.addEventListener("visibilitychange", onVisibility);
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
    controller?.abort();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
