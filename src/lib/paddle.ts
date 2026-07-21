// Paddle.js loader. The client token is a Vite env var swapped at build time.
import { publicClientConfig } from "@/config/public-client-config";

const clientToken = publicClientConfig.paymentsClientToken;

export interface PaddleEvent {
  name?: string;
  data?: unknown;
}

export type PaddleEventCallback = (event: PaddleEvent) => void;

interface PaddleWindowApi {
  Environment: { set: (environment: "sandbox" | "production") => void };
  Initialize: (options: { token: string; eventCallback?: PaddleEventCallback }) => void;
  Update: (options: { eventCallback: PaddleEventCallback }) => void;
  Checkout: {
    open: (options: Record<string, unknown>) => void;
  };
}

declare global {
  interface Window {
    Paddle: PaddleWindowApi;
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

function updateEventCallback(eventCallback?: PaddleEventCallback) {
  if (eventCallback) window.Paddle.Update({ eventCallback });
}

export async function initializePaddle(eventCallback?: PaddleEventCallback): Promise<void> {
  if (paddleInitialized) {
    updateEventCallback(eventCallback);
    return;
  }
  if (paddleLoading) {
    await paddleLoading;
    updateEventCallback(eventCallback);
    return;
  }
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
        window.Paddle.Initialize({ token: clientToken, eventCallback });
        paddleInitialized = true;
        resolve();
      } catch (error) {
        paddleLoading = null;
        reject(error);
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
    script.addEventListener("error", () => {
      paddleLoading = null;
      reject(new Error("Failed to load Paddle.js"));
    }, { once: true });
  });

  return paddleLoading;
}
