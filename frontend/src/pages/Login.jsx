import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Radio, Activity, GitCompareArrows, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/overview" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await login(email, password);
    setBusy(false);
    if (res.ok) navigate("/overview");
    else setError(res.error);
  };

  const quickLogin = async (em, pw) => {
    setBusy(true);
    setError("");
    setEmail(em);
    setPassword(pw);
    const res = await login(em, pw);
    setBusy(false);
    if (res.ok) navigate("/overview");
    else setError(res.error);
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-[1.15fr_.85fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[hsl(var(--hero))] p-12 text-white lg:flex xl:p-16">
        <div className="grid-backdrop absolute inset-0 opacity-10" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-teal-300/10 blur-3xl" />
        <div className="relative flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-300/15 ring-1 ring-teal-300/20"><Radio className="h-5 w-5 text-teal-300" /></span>
          <span className="font-heading text-lg font-bold tracking-tight">POD OPS</span>
        </div>
        <div className="relative">
          <div className="text-[11px] font-semibold uppercase tracking-[.18em] text-teal-300">Operations intelligence</div>
          <h2 className="mt-4 max-w-xl font-heading text-5xl font-bold leading-[1.08] tracking-[-.04em]">
            Turn tracker data into clear operating decisions.
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
            See where work is moving, what needs attention, and how every POD contributes—without editing the source sheet.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            <LoginFeature icon={Activity} label="Live pulse" />
            <LoginFeature icon={GitCompareArrows} label="Change history" />
            <LoginFeature icon={ShieldCheck} label="Read only" />
          </div>
        </div>
        <div className="relative text-xs text-slate-400">
          Synced from the Master tracker every 60 seconds
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="panel w-full max-w-md space-y-5 p-6 sm:p-8" data-testid="login-form">
          <div className="lg:hidden flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            <span className="font-heading text-lg font-bold tracking-tight">POD OPS</span>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[.16em] text-primary">Secure workspace</div>
            <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to open the live command center.</p>
          </div>
          {error && (
            <div data-testid="login-error"
                 className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" data-testid="login-email" value={email}
                   onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" data-testid="login-password" value={password}
                   onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" data-testid="login-submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          <div className="relative py-1 text-center">
            <span className="relative z-10 bg-background px-3 text-xs uppercase tracking-wider text-muted-foreground">Quick login</span>
            <span className="absolute left-0 top-1/2 h-px w-full bg-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" disabled={busy}
                    data-testid="quick-login-admin"
                    onClick={() => quickLogin("admin@pod.ops", "PodOps@2026")}
                    className="flex-col items-start gap-0.5 h-auto py-2.5">
              <span className="text-sm font-semibold">Admin</span>
              <span className="text-[11px] font-normal text-muted-foreground">Full access + sync</span>
            </Button>
            <Button type="button" variant="outline" disabled={busy}
                    data-testid="quick-login-viewer"
                    onClick={() => quickLogin("viewer@pod.ops", "Viewer@2026")}
                    className="flex-col items-start gap-0.5 h-auto py-2.5">
              <span className="text-sm font-semibold">Viewer</span>
              <span className="text-[11px] font-normal text-muted-foreground">Read-only</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LoginFeature({ icon: Icon, label }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.05] p-3"><Icon className="h-4 w-4 text-teal-300" /><div className="mt-3 text-xs font-medium text-slate-300">{label}</div></div>;
}
