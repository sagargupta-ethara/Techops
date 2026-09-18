import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  LayoutDashboard, Users2, Boxes, UserCircle2, History, Activity,
  Moon, Sun, LogOut, RefreshCw, Radio, Menu, X, PackageCheck, ChartNoAxesCombined,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const NAV = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard, id: "overview" },
  { to: "/pods", label: "POD Analytics", icon: Boxes, id: "pods" },
  { to: "/tpms", label: "TPM Analytics", icon: Users2, id: "tpms" },
  { to: "/delivery", label: "Delivery", icon: PackageCheck, id: "delivery" },
  { to: "/daily-progress", label: "Daily Progress", icon: ChartNoAxesCombined, id: "daily-progress" },
  { to: "/users", label: "User Directory", icon: UserCircle2, id: "users" },
  { to: "/audit", label: "Audit Trail", icon: History, id: "audit" },
  { to: "/data-health", label: "Data Health", icon: Activity, id: "data-health" },
];
const MOBILE_NAV = NAV.filter((item) => ["overview", "pods", "delivery", "daily-progress", "users"].includes(item.id));

const STATE_MAP = { fresh: "fresh", stale: "stale", sync_failed: "sync_failed", unavailable: "unavailable" };
const STATE_TEXT = { fresh: "Fresh", stale: "Stale", sync_failed: "Sync failed", unavailable: "Unavailable" };

function freshText(h) {
  if (!h) return "";
  const s = h.seconds_since_success;
  if (s == null) return "no sync yet";
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function SidebarInner({ user, logout, onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[72px] items-center gap-2.5 border-b border-white/10 px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 ring-1 ring-primary/25">
          <Radio className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="leading-tight">
          <div className="font-heading text-sm font-bold tracking-tight text-white">POD OPS</div>
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-400">
            Command Center
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3 thin-scroll">
        {NAV.map((n) => (
          <NavLink
            key={n.id} to={n.to} data-testid={`nav-${n.id}`} onClick={onNavigate}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-r-full before:bg-white/90"
                  : "text-slate-400 hover:bg-white/[.06] hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <n.icon className={`h-4 w-4 shrink-0 ${isActive ? "" : "text-slate-500 group-hover:text-white"}`} />
                <span className="truncate">{n.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="mb-2 rounded-xl border border-white/[.06] bg-white/[.05] px-3 py-3 text-xs">
          <div className="truncate font-medium text-slate-100">{user?.name}</div>
          <div className="mt-0.5 truncate text-slate-400">{user?.email}</div>
            <span className="mt-1.5 inline-block rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-emerald-300">
            {user?.role}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} data-testid="logout-button"
                className="w-full justify-start gap-2 text-slate-400 hover:bg-white/[.06] hover:text-white">
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [syncing, setSyncing] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    <div className="min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 border-r border-white/10 bg-[hsl(var(--shell))] text-slate-300 lg:block">
        <SidebarInner user={user} logout={logout} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close navigation menu" className="absolute inset-0 bg-background/70 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-white/10 bg-[hsl(var(--shell))] text-slate-300 animate-drawer-in">
            <button onClick={() => setMobileOpen(false)} className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center text-muted-foreground" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <SidebarInner user={user} logout={logout} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-h-screen min-w-0 flex-col lg:pl-56">
        <header className="sticky top-0 z-30 h-14 border-b border-border/70 bg-background/90 backdrop-blur-md">
          <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button className="flex min-h-11 min-w-11 items-center justify-center lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </button>
              <StatusBadge
                state={STATE_MAP[health?.state] || "unavailable"}
                text={`${STATE_TEXT[health?.state] || "Unavailable"} · ${freshText(health)}`}
                testid="freshness-badge"
              />
              {health?.reporting_date && (
                <span className="hidden truncate text-xs font-mono text-muted-foreground lg:inline">
                  Reporting date {health.reporting_date}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {user?.role === "admin" && (
                <Button variant="outline" size="sm" onClick={doSync} disabled={syncing}
                        data-testid="sync-now-button" className="h-11 gap-1.5 text-xs lg:h-8">
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Sync now</span>
                </Button>
              )}
              <Button variant="ghost" size="icon" data-testid="theme-toggle-button"
                      aria-label="Toggle theme" className="relative h-11 w-11 lg:h-9 lg:w-9"
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100" />
              </Button>
            </div>
          </div>
        </header>

        <main key={location.pathname} className="page-enter min-w-0 flex-1 pb-24 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur lg:hidden">
        {MOBILE_NAV.map((n) => (
          <NavLink
            key={n.id} to={n.to} data-testid={`mobile-nav-${n.id}`}
            className={({ isActive }) =>
              `flex min-h-11 flex-col items-center justify-center gap-0.5 py-1.5 text-[9px] font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`
            }
          >
            <n.icon className="h-4 w-4" />
            <span className="truncate px-0.5">{n.label.split(" ")[0]}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
