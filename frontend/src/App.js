import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import Overview from "@/pages/Overview";
import Tpms from "@/pages/Tpms";
import TpmDetail from "@/pages/TpmDetail";
import Pods from "@/pages/Pods";
import PodDetail from "@/pages/PodDetail";
import Users from "@/pages/Users";
import UserDetail from "@/pages/UserDetail";
import Audit from "@/pages/Audit";
import DataHealth from "@/pages/DataHealth";

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading…
      </div>
    );
  if (user === false) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/overview" replace />} />
          <Route path="/overview" element={<Protected><Overview /></Protected>} />
          <Route path="/tpms" element={<Protected><Tpms /></Protected>} />
          <Route path="/tpms/:name" element={<Protected><TpmDetail /></Protected>} />
          <Route path="/pods" element={<Protected><Pods /></Protected>} />
          <Route path="/pods/:name" element={<Protected><PodDetail /></Protected>} />
          <Route path="/users" element={<Protected><Users /></Protected>} />
          <Route path="/users/:email" element={<Protected><UserDetail /></Protected>} />
          <Route path="/audit" element={<Protected><Audit /></Protected>} />
          <Route path="/data-health" element={<Protected><DataHealth /></Protected>} />
          <Route path="*" element={<Navigate to="/overview" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
