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
type NodeProcessLike = { on?: (event: string, listener: (arg: unknown) => void) => void; versions?: { node?: string } };
const nodeProcess = (globalThis as { process?: NodeProcessLike }).process;
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

  // Root-cause fix: Node's http server throws "Error: aborted" (from
  // abortIncoming in node:_http_server) when the client socket closes
  // mid-request and the IncomingMessage has no 'error' listener. Attach a
  // noop listener to every request/response so the abort is absorbed at the
  // source instead of becoming an uncaught exception.
  if (nodeProcess.versions?.node) {
    import("node:http")
      .then((http) => {
        type Handler = (...args: unknown[]) => boolean;
        const proto = http.Server.prototype as unknown as {
          emit: Handler;
          __abortPatched?: boolean;
        };
        if (proto.__abortPatched) return;
        proto.__abortPatched = true;
        const origEmit = proto.emit;
        proto.emit = function (this: unknown, event: string, ...args: unknown[]) {
          if (event === "request") {
            const [req, res] = args as [
              { on?: (e: string, l: () => void) => void } | undefined,
              { on?: (e: string, l: () => void) => void } | undefined,
            ];
            req?.on?.("error", () => {});
            res?.on?.("error", () => {});
          }
          return origEmit.call(this, event, ...args);
        };
      })
      .catch(() => {});
  }
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
