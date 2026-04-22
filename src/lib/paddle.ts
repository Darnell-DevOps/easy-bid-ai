// Paddle.js loader. The client token is a Vite env var swapped at build time.

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

declare global {
  interface Window {
    Paddle: any;
  }
}

let paddleInitialized = false;
let paddleLoading: Promise<void> | null = null;

export function isPaymentsConfigured() {
  return !!clientToken;
}

export function isTestMode() {
  return !!clientToken?.startsWith("test_");
}

export async function initializePaddle(): Promise<void> {
  if (paddleInitialized) return;
  if (paddleLoading) return paddleLoading;
  if (!clientToken) {
    throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
  }

  paddleLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://cdn.paddle.com/paddle/v2/paddle.js"]',
    );
    const onReady = () => {
      try {
        const environment = clientToken.startsWith("test_") ? "sandbox" : "production";
        window.Paddle.Environment.set(environment);
        window.Paddle.Initialize({ token: clientToken });
        paddleInitialized = true;
        resolve();
      } catch (e) {
        reject(e);
      }
    };

    if (existing && window.Paddle) {
      onReady();
      return;
    }
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", onReady, { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load Paddle.js")), { once: true });
  });

  return paddleLoading;
}
