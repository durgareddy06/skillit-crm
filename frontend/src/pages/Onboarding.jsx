import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import DataTable from "../components/DataTable";
import ActivityDrawer from "../components/ActivityDrawer";
import { listStudents } from "../api/students";
import { buildSupportTableColumns, SupportActivityButton } from "../config/supportTableColumns.jsx";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../lib/permissions";

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [activityFor, setActivityFor] = useState(null);

  useEffect(() => {
    listStudents("onboarding")
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  }, []);

  const canViewDetails = hasPermission(user, "onboarding", "details");

  return (
    <div>
      <Topbar title="Onboarding" subtitle="Skillit Academy | 8639191169" />
      <DataTable
        columns={buildSupportTableColumns({
          onNameClick: canViewDetails ? (row) => navigate(`/onboarding/${row.id}`) : undefined,
          nameExtra: (row) => (
            <SupportActivityButton onClick={(e) => {
              e.stopPropagation();
              setActivityFor(row);
            }} />
          ),
        })}
        rows={rows}
        onRowClick={canViewDetails ? (row) => navigate(`/onboarding/${row.id}`) : undefined}
      />

      <ActivityDrawer open={!!activityFor} student={activityFor} onClose={() => setActivityFor(null)} />
    </div>
  );
}
