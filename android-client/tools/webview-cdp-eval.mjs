const DEFAULT_PORT = 9222;
const RESPONSE_TIMEOUT_MS = 5_000;

const expression = process.argv[2];
const port = Number(process.argv[3] ?? DEFAULT_PORT);

if (!expression) {
  console.error("Usage: node webview-cdp-eval.mjs <expression> [forwarded-port]");
  process.exit(1);
}

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error("Forwarded port must be an integer between 1 and 65535.");
  process.exit(1);
}

const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => {
  if (!response.ok) {
    throw new Error(`Could not list WebView targets: HTTP ${response.status}`);
  }
  return response.json();
});

const pages = targets.filter(
  (target) => target.type === "page" && typeof target.webSocketDebuggerUrl === "string",
);

if (pages.length !== 1) {
  throw new Error(`Expected exactly one debuggable WebView page, found ${pages.length}.`);
}

const result = await evaluate(pages[0].webSocketDebuggerUrl, expression);
console.log(JSON.stringify(result));

function evaluate(webSocketUrl, source) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(webSocketUrl);
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error(`WebView evaluation timed out after ${RESPONSE_TIMEOUT_MS}ms.`));
    }, RESPONSE_TIMEOUT_MS);

    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: {
            expression: source,
            returnByValue: true,
            awaitPromise: true,
          },
        }),
      );
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== 1) return;

      clearTimeout(timeout);
      socket.close();

      if (message.error) {
        reject(new Error(message.error.message ?? "WebView evaluation failed."));
        return;
      }

      if (message.result?.exceptionDetails) {
        reject(new Error(message.result.exceptionDetails.text ?? "WebView expression threw."));
        return;
      }

      resolve({
        type: message.result?.result?.type ?? "undefined",
        value: message.result?.result?.value ?? null,
      });
    });

    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("Could not connect to the WebView debugging socket."));
    });
  });
}
