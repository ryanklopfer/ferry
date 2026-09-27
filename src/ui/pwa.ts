// Empties Cache Storage for this origin. The service worker does it too on the "sign-out" message, so a worker
// that outlives this page can't be mid-way through storing something when sign-out finishes.
export async function clearAppCaches(): Promise<void> {
  const worker = typeof navigator !== "undefined" ? navigator.serviceWorker?.controller : null;
  if (worker) {
    await new Promise<void>((resolve) => {
      const channel = new MessageChannel();
      const timer = setTimeout(resolve, 2000);
      channel.port1.onmessage = () => {
        clearTimeout(timer);
        resolve();
      };
      worker.postMessage({ type: "sign-out" }, [channel.port2]);
    });
  }
  if (typeof caches !== "undefined") await Promise.all((await caches.keys()).map((name) => caches.delete(name)));
}
