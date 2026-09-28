import { Routes, Route, Navigate } from "react-router-dom";
import { AppHeader } from "./components/layout/AppHeader";
import Home from "./pages/Home/Home";
import { HistoryPage } from "./pages/HistoryPage/HistoryPage";
import { StudyPage } from "./pages/StudyPage/StudyPage";

export function App() {
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:id" element={<StudyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}