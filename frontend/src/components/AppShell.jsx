import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  LayoutDashboard, Users2, Boxes, UserCircle2, History, Activity,
  Moon, Sun, LogOut, RefreshCw, Radio,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const NAV = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard, id: "overview" },
  { to: "/tpms", label: "TPMs", icon: Users2, id: "tpms" },
  { to: "/pods", label: "PODs", icon: Boxes, id: "pods" },
  { to: "/users", label: "Users", icon: UserCircle2, id: "users" },
  { to: "/audit", label: "Audit", icon: History, id: "audit" },
  { to: "/data-health", label: "Data Health", icon: Activity, id: "data-health" },
];

const STATE_MAP = { fresh: "fresh", stale: "stale", sync_failed: "sync_failed", unavailable: "unavailable" };

function freshText(h) {
  if (!h) return "";
  const s = h.seconds_since_success;
  if (s == null) return "no sync yet";
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [syncing, setSyncing] = useState(false);

  const { data: health, refetch } = useQuery({
    queryKey: ["data-health-badge"],
    queryFn: () => api.get("/data-health").then((r) => r.data),
    refetchInterval: 20000,
  });

  const doSync = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post("/sync");
      toast.success(`Sync ${data.status}`, {
        description: data.change_count != null ? `${data.change_count} changes` : data.reason,
      });
      refetch();
    } catch (e) {
      toast.error("Sync failed", { description: e.response?.data?.detail || e.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <Radio className="h-5 w-5 text-primary" />
          <div className="leading-tight">
            <div className="font-heading text-sm font-bold tracking-tight">POD OPS</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Command Center
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((n) => (
            <NavLink
              key={n.id} to={n.to} data-testid={`nav-${n.id}`}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`
              }
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="mb-2 px-2 text-xs">
            <div className="font-medium truncate">{user?.name}</div>
            <div className="text-muted-foreground truncate">{user?.email}</div>
            <span className="mt-1 inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide">
              {user?.role}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={logout} data-testid="logout-button"
                  className="w-full justify-start gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-1 flex-col md:pl-60">
        {/* Top context bar */}
        <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <StatusBadge
                state={STATE_MAP[health?.state] || "unavailable"}
                text={`${health?.state === "fresh" ? "Fresh" : health?.state === "stale" ? "Stale" : health?.state === "sync_failed" ? "Sync failed" : "Unavailable"} · ${freshText(health)}`}
                testid="freshness-badge"
              />
              {health?.reporting_date && (
                <span className="hidden text-xs font-mono text-muted-foreground sm:inline">
                  Reporting date {health.reporting_date}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {user?.role === "admin" && (
                <Button variant="outline" size="sm" onClick={doSync} disabled={syncing}
                        data-testid="sync-now-button" className="gap-1.5 text-xs">
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                  Sync now
                </Button>
              )}
              <Button variant="ghost" size="icon" data-testid="theme-toggle-button"
                      aria-label="Toggle theme"
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100" />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 pb-24 md:pb-8">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-card md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.id} to={n.to} data-testid={`mobile-nav-${n.id}`}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            <n.icon className="h-4 w-4" />
            <span className="truncate px-0.5">{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
