import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyTheme, getInitialTheme } from "./hooks/use-theme";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { installGlobalErrorReporting } from "./lib/error-reporting";

applyTheme(getInitialTheme());
installGlobalErrorReporting();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
