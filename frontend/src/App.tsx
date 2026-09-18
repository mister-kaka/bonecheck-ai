import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import HistoryPage from "./pages/HistoryPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}