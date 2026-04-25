import { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/shell/Sidebar";
import TopBar from "../components/shell/TopBar";
import CommandPalette from "../components/shell/CommandPalette";
import Footer from "../components/shared/Footer";

const PIN_KEY = "rmx_sidebar_pinned";

export default function AppShell({ children }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(() => {
    try { return localStorage.getItem(PIN_KEY) === "true"; } catch { return false; }
  });
  const [sidebarHoverOpen, setSidebarHoverOpen] = useState(false);

  // Listen for sidebar pin state changes (Sidebar writes to localStorage)
  useEffect(() => {
    const handler = () => {
      try {
        setSidebarPinned(localStorage.getItem(PIN_KEY) === "true");
      } catch {}
    };
    window.addEventListener("storage", handler);

    // Also poll on interval since storage event doesn't fire in same tab
    const interval = setInterval(() => {
      try {
        const pinVal = localStorage.getItem(PIN_KEY) === "true";
        setSidebarPinned((prev) => (prev !== pinVal ? pinVal : prev));
      } catch {}
    }, 300);

    return () => {
      window.removeEventListener("storage", handler);
      clearInterval(interval);
    };
  }, []);

  // Global Ctrl+K / Cmd+K handler
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const closeCmd = useCallback(() => setCmdOpen(false), []);
  const isSidebarExpanded = sidebarPinned || sidebarHoverOpen;

  return (
    <div className="bg-canvas dark:bg-canvas-dark text-ink dark:text-ink-dark font-body min-h-screen">
      <Sidebar
        pinned={sidebarPinned}
        onPinnedChange={setSidebarPinned}
        onHoverChange={setSidebarHoverOpen}
      />
      <TopBar
        onOpenCommandPalette={() => setCmdOpen(true)}
        sidebarExpanded={isSidebarExpanded}
      />
      <CommandPalette open={cmdOpen} onClose={closeCmd} />

      {/* Main content — offset by sidebar + topbar */}
      <main
        className="transition-all duration-300 min-h-screen"
        style={{
          marginRight: isSidebarExpanded ? "240px" : "64px",
          paddingTop: "56px",
        }}
      >
        <div className="w-full max-w-content mx-auto px-4 sm:px-6 py-6">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
