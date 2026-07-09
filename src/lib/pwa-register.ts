// Guarded service-worker registration. Registers only in the real production
// site — never in Lovable preview, iframes, dev, or when ?sw=off is set.
const SW_URL = "/sw.js";

function isRefusedHost(hostname: string) {
  if (hostname.startsWith("id-preview--") || hostname.startsWith("preview--")) return true;
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return true;
  if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com")) return true;
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return true;
  return false;
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) {
      const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
      if (url.endsWith(SW_URL)) await r.unregister();
    }
  } catch {
    /* ignore */
  }
}

export function registerPwa() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const inIframe = window.self !== window.top;
  const url = new URL(window.location.href);
  const disabled = url.searchParams.get("sw") === "off";
  const isProd = import.meta.env.PROD;
  const refused =
    !isProd || inIframe || disabled || isRefusedHost(window.location.hostname);

  if (refused) {
    void unregisterMatching();
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_URL).catch((e) => {
      console.warn("SW registration failed", e);
    });
  });
}
