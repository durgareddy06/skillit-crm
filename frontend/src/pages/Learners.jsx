import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import DataTable from "../components/DataTable";
import ActivityDrawer from "../components/ActivityDrawer";
import { listStudents } from "../api/students";
import { buildSupportTableColumns, SupportActivityButton } from "../config/supportTableColumns.jsx";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../lib/permissions";

export default function Learners() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [activityFor, setActivityFor] = useState(null);

  useEffect(() => {
    listStudents("learners")
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  }, []);

  const canViewDetails = hasPermission(user, "learners", "details");

  return (
    <div className="relative">
      <Topbar title="Learners" subtitle="Skillit Academy | 8639191169" />

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          <DataTable
            columns={buildSupportTableColumns({
              onNameClick: canViewDetails ? (row) => navigate(`/learners/${row.id}`) : undefined,
              nameExtra: (row) => (
                <SupportActivityButton onClick={(e) => {
                  e.stopPropagation();
                  setActivityFor(row);
                }} />
              ),
            })}
            rows={rows}
            onRowClick={canViewDetails ? (row) => navigate(`/learners/${row.id}`) : undefined}
          />
        </div>
      </div>

      <ActivityDrawer open={!!activityFor} student={activityFor} onClose={() => setActivityFor(null)} />
    </div>
  );
}
