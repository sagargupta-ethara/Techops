import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Radio } from "lucide-react";
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

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-card p-12 lg:flex">
        <div className="grid-backdrop absolute inset-0 opacity-40" />
        <div className="relative flex items-center gap-2">
          <Radio className="h-6 w-6 text-primary" />
          <span className="font-heading text-lg font-bold tracking-tight">POD OPS</span>
        </div>
        <div className="relative">
          <h2 className="font-heading text-4xl font-extrabold leading-tight tracking-tight">
            Live POD Operations<br />Command Center
          </h2>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            Leadership-only view of the live Master tracker — TPM to POD to user, with daily
            history and explainable detected changes. Synced every 60 seconds.
          </p>
        </div>
        <div className="relative text-xs font-mono uppercase tracking-wider text-muted-foreground">
          Read-only · Never writes to the sheet
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" data-testid="login-form">
          <div className="lg:hidden flex items-center gap-2">
            <Radio className="h-6 w-6 text-primary" />
            <span className="font-heading text-lg font-bold tracking-tight">POD OPS</span>
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Leadership access only.</p>
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
        </form>
      </div>
    </div>
  );
}
