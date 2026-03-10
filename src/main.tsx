
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { getFirebaseAppCheck } from "./lib/firebase";
  import "./styles/index.css";

  getFirebaseAppCheck();
  createRoot(document.getElementById("root")!).render(<App />);
  
