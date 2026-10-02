import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

class AppBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="panel">
          <h1>Не удалось открыть смену</h1>
          <p>
            Перезагрузите страницу. Если сохранённый снимок повреждён, можно
            удалить его и открыть демосмену.
          </p>
          <button
            className="button button-primary"
            onClick={() => {
              localStorage.removeItem("allur-twin-v1");
              location.reload();
            }}
          >
            Открыть демосмену
          </button>
        </main>
      );
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppBoundary>
      <App />
    </AppBoundary>
  </React.StrictMode>,
);
