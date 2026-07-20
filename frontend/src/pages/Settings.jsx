import React from "react";
import { LogOut } from "lucide-react";
import Topbar from "../components/Topbar";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";
import AdminSettings from "./AdminSettings";

export default function Settings() {
  const { user, logout } = useAuth();

  // Admin gets the full Users / Manage Teams / Manage Roles workspace.
  // Sales, MIS, and Support keep the original simple profile screen below,
  // completely untouched.
  if (user?.role === "admin") return <AdminSettings />;

  return (
    <div>
      <Topbar title="Settings" subtitle="Skillit Academy | 8639191169" />
      <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-6 max-w-lg animate-fadeIn">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-14 w-14 rounded-full bg-skillit text-white grid place-items-center text-xl font-semibold uppercase">
            {user?.name?.[0] || "?"}
          </div>
          <div>
            <p className="font-display font-semibold text-slate-800">{user?.name}</p>
            <p className="text-sm text-slate-400">{user?.phone}</p>
            <span className="inline-block text-xs font-medium text-skillit bg-blue-50 px-2 py-0.5 rounded-full mt-1">
              {user?.role === "admin" ? "Admin" : user?.designation || "Team"}
            </span>
          </div>
        </div>
        <Button variant="danger" onClick={logout}>
          <LogOut className="h-4 w-4" /> Log out
        </Button>
      </div>
    </div>
  );
}
