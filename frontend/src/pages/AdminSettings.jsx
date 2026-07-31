import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Plus, Search, SlidersHorizontal, Columns } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Topbar from "../components/Topbar";
import UsersTab from "../components/admin/UsersTab";
import TeamsTab from "../components/admin/TeamsTab";
import RolesTab from "../components/admin/RolesTab";
import ArchiveTab from "../components/admin/ArchiveTab";
import ArchivedUserDetails from "../components/admin/ArchivedUserDetails";
import * as adminApi from "../api/admin";
import { SETTINGS_HOME_ICON } from "../config/settingsWorkspace";

export default function AdminSettings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = searchParams.get("section") || "users";
  const validSections = ["users", "teams", "roles", "archive", "archive-details"];
  const normalizedSection = validSections.includes(activeSection) ? activeSection : "users";
  const [search, setSearch] = useState("");
  const [isEditingRole, setIsEditingRole] = useState(false);

  const [users, setUsers] = useState([]);
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const usersRef = useRef(null);
  const teamsRef = useRef(null);
  const rolesRef = useRef(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [u, au, t, r] = await Promise.all([
        adminApi.listUsers(),
        adminApi.listArchivedUsers(),
        adminApi.listTeams(),
        adminApi.listRoles(),
      ]);
      setUsers(u);
      setArchivedUsers(au);
      setTeams(t);
      setRoles(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setSearch("");
  }, [normalizedSection]);

  useEffect(() => {
    if (activeSection !== normalizedSection) {
      setSearchParams({ section: normalizedSection }, { replace: true });
    }
  }, [activeSection, normalizedSection, setSearchParams]);

  const activeSectionLabel = useMemo(
    () => {
      if (normalizedSection === "users") return "Manage Users";
      if (normalizedSection === "teams") return "Manage Teams";
      if (normalizedSection === "roles") return "Manage Roles";
      if (normalizedSection === "archive") return "Archive";
      return "Settings";
    },
    [normalizedSection]
  );

  const handleAdd = () => {
    if (normalizedSection === "users") usersRef.current?.openCreate();
    if (normalizedSection === "teams") teamsRef.current?.openCreate();
    if (normalizedSection === "roles") rolesRef.current?.openCreate();
  };

  const showToolbar = !isEditingRole && normalizedSection !== "archive-details";

  return (
    <div className="animate-fadeIn">
      {!isEditingRole && (
        <Topbar
          title="Settings"
          subtitle="Centralized workspace for users, teams, and roles"
          right={(
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
              title="Go home"
            >
              <SETTINGS_HOME_ICON className="h-4 w-4" />
              Home
            </button>
          )}
        />
      )}

      <div className="min-w-0">
        <section>
          {showToolbar && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-xl font-display font-bold text-slate-800">{activeSectionLabel}</h2>
                  <p className="text-sm text-slate-500">
                    {normalizedSection === "users"
                      ? "Create and manage application users."
                      : normalizedSection === "teams"
                        ? "Manage reporting groups and their members."
                        : normalizedSection === "roles"
                          ? "Manage role permissions."
                          : "View archived users and reference historical records."
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Name, Email"
                    className="w-48 rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-skillit"
                  />
                </div>
                <button className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50">
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
                <button className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50">
                  <Columns className="h-4 w-4" />
                </button>
                {normalizedSection !== "archive" && (
                  <button
                    type="button"
                    onClick={handleAdd}
                    className="grid h-9 w-9 place-items-center rounded-full bg-skillit text-white shadow-pop hover:bg-skillit-dark"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {normalizedSection === "users" && (
            <UsersTab ref={usersRef} users={users} loading={loading} search={search} onRefresh={refresh} />
          )}
          {normalizedSection === "teams" && (
            <TeamsTab
              ref={teamsRef}
              teams={teams}
              users={users}
              loading={loading}
              search={search}
              onRefresh={refresh}
            />
          )}
          {normalizedSection === "roles" && (
            <RolesTab
              ref={rolesRef}
              roles={roles}
              loading={loading}
              search={search}
              onRefresh={refresh}
              onEditingChange={setIsEditingRole}
            />
          )}
          {normalizedSection === "archive" && (
            <ArchiveTab
              users={archivedUsers}
              loading={loading}
              search={search}
              onRefresh={refresh}
              onViewDetails={(userId) => setSearchParams({ section: "archive-details", userId })}
            />
          )}
          {normalizedSection === "archive-details" && (
            <ArchivedUserDetails
              userId={searchParams.get("userId")}
              onBack={() => setSearchParams({ section: "archive" })}
            />
          )}
        </section>
      </div>
    </div>
  );
}
