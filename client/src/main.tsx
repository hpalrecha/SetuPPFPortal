import { createRoot } from "react-dom/client";
import App from "./App";
import { installSessionGuards } from "./lib/session";
import "./index.css";

// Before anything renders, so no request can slip past the 401 guard.
installSessionGuards();

createRoot(document.getElementById("root")!).render(<App />);
