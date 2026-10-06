import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import AuthModal from "./components/AuthModal";
import ExplorePage from "./pages/ExplorePage";
import AIPlannerPage from "./pages/AIPlannerPage";
import MyTripsPage from "./pages/MyTripsPage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div>
      <Header onOpenAuth={() => setAuthOpen(true)} />
      <Routes>
        <Route path="/" element={<ExplorePage onRequireAuth={() => setAuthOpen(true)} />} />
        <Route path="/plan" element={<AIPlannerPage />} />
        <Route path="/trips" element={<MyTripsPage onRequireAuth={() => setAuthOpen(true)} />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
