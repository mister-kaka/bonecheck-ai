import { Routes, Route, Navigate } from "react-router-dom";
import { AppHeader } from "./components/AppHeader";
import { Home } from "./pages/Home/Home";
import { HistoryPage } from "./pages/HistoryPage/HistoryPage";

export function App() {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
