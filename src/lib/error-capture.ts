// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

function isClientDisconnect(error: unknown): boolean {
  if (!error) return false;
  const e = error as { code?: string; name?: string; message?: string; cause?: unknown };
  if (e.code === "ECONNRESET" || e.code === "ECONNABORTED" || e.name === "AbortError") return true;
  if (typeof e.message === "string" && /^aborted$|aborted|ECONNRESET/i.test(e.message)) return true;
  return e.cause ? isClientDisconnect(e.cause) : false;
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => {
    const error = (event as ErrorEvent).error ?? event;
    if (isClientDisconnect(error)) {
      // Client went away mid-request (reload, navigation, HMR) — not an app error.
      (event as ErrorEvent).preventDefault?.();
      return;
    }
    record(error);
  });
  globalThis.addEventListener("unhandledrejection", (event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    if (isClientDisconnect(reason)) {
      (event as PromiseRejectionEvent).preventDefault?.();
      return;
    }
    record(reason);
  });
}

// Dev (Node) only: socket aborts surface as process-level uncaught exceptions
// from node:_http_server and would otherwise blank the preview.
const nodeProcess = (globalThis as { process?: NodeJS.Process }).process;
if (nodeProcess && typeof nodeProcess.on === "function") {
  nodeProcess.on("uncaughtException", (error: unknown) => {
    if (isClientDisconnect(error)) return;
    record(error);
    console.error(error);
  });
  nodeProcess.on("unhandledRejection", (reason: unknown) => {
    if (isClientDisconnect(reason)) return;
    record(reason);
    console.error(reason);
  });
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
