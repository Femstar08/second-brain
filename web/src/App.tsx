import { Routes, Route, Navigate } from "react-router-dom";
import { NavRail } from "@/components/layout/NavRail";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { useConfig } from "@/hooks/useConfig";
import Chat from "@/pages/Chat";
import Docs from "@/pages/Docs";
import Onboarding from "@/pages/Onboarding";
import Settings from "@/pages/Settings";

export default function App() {
  const { config, loading } = useConfig();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center animate-pulse">
            <span className="text-primary font-bold">...</span>
          </div>
          <p className="text-sm font-mono-tight">Loading System...</p>
        </div>
      </div>
    );
  }

  if (config && !config.onboarded) {
    return <Onboarding />;
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <NavRail />
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <HeaderBar />
        <main className="flex-1 overflow-x-hidden overflow-y-auto relative p-4 md:p-6 pb-24 md:pb-6">
          <div className="max-w-[1600px] mx-auto w-full h-full fade-in">
            <Routes>
              <Route path="/" element={<Chat />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}
