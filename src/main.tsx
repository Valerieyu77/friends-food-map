import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { App } from "./App.js";
import { captureInstallPrompt } from "./installTip.js";
import { registerBackgroundScript } from "./push.js";
import { keepBarsInView } from "./viewportShift.js";
import "./styles.css";

captureInstallPrompt();
keepBarsInView();
registerBackgroundScript();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
