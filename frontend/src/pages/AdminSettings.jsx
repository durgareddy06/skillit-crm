import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, SlidersHorizontal, Columns, Plus } from "lucide-react";
import Topbar from "../components/Topbar";
import UsersTab from "../components/admin/UsersTab";
import TeamsTab from "../components/admin/TeamsTab";
import RolesTab from "../components/admin/RolesTab";
import * as adminApi from "../api/admin";

const TABS = [
  { key: "users", label: "Users" },
  { key: "teams", label: "Manage Teams" },
  { key: "roles", label: "Manage Roles" },
];

export default function AdminSettings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("users");
  const [search, setSearch] = useState("");
  const [isEditingRole, setIsEditingRole] = useState(false);

  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const usersRef = useRef(null);
  const teamsRef = useRef(null);
  const rolesRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [u, t, r] = await Promise.all([
        adminApi.listUsers(),
        adminApi.listTeams(),
        adminApi.listRoles(),
      ]);
      setUsers(u);
      setTeams(t);
      setRoles(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAdd = () => {
    if (activeTab === "users") usersRef.current?.openCreate();
    if (activeTab === "teams") teamsRef.current?.openCreate();
    if (activeTab === "roles") rolesRef.current?.openCreate();
  };

  return (
    <div>
      {!isEditingRole && <Topbar title="Settings" subtitle="Users, teams, and role permissions" />}

      {!isEditingRole && (
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="h-9 w-9 rounded-full grid place-items-center text-slate-500 hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <nav className="flex items-center gap-6">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setActiveTab(t.key); setSearch(""); }}
                  className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                    activeTab === t.key ? "text-skillit border-skillit" : "text-slate-500 border-transparent hover:text-slate-700"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, Email"
                className="pl-9 pr-3 py-2 rounded-full border border-slate-200 bg-white text-sm w-48 outline-none focus:border-skillit"
              />
            </div>
            <button className="h-9 w-9 rounded-full border border-slate-200 grid place-items-center text-slate-500 hover:bg-slate-50">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <button className="h-9 w-9 rounded-full border border-slate-200 grid place-items-center text-slate-500 hover:bg-slate-50">
              <Columns className="h-4 w-4" />
            </button>
            <button onClick={handleAdd} className="h-9 w-9 rounded-full bg-skillit text-white grid place-items-center hover:bg-skillit-dark shadow-pop">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <UsersTab ref={usersRef} users={users} loading={loading} search={search} onRefresh={refresh} />
      )}
      {activeTab === "teams" && (
        <TeamsTab ref={teamsRef} teams={teams} users={users} loading={loading} search={search} onRefresh={refresh} />
      )}
      {activeTab === "roles" && (
        <RolesTab
          ref={rolesRef}
          roles={roles}
          loading={loading}
          search={search}
          onRefresh={refresh}
          onEditingChange={setIsEditingRole}
        />
      )}
    </div>
  );
}
