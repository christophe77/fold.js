import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { configure } from "foldjs";
import { App } from "./App";
import "./styles.css";

// ?virtual=1 previews the virtual fold used on the iPhone Fold (any large landscape window).
if (new URLSearchParams(location.search).has("virtual")) configure({ virtualFold: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
