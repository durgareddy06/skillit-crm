import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import DataTable from "../components/DataTable";
import ActivityDrawer from "../components/ActivityDrawer";
import { listStudents } from "../api/students";
import { buildSupportTableColumns, SupportActivityButton } from "../config/supportTableColumns.jsx";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../lib/permissions";

export default function Orientation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [activityFor, setActivityFor] = useState(null);

  const refresh = () => {
    listStudents("orientation")
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  };

  useEffect(() => {
    refresh();
  }, []);

  const canViewDetails = hasPermission(user, "orientation", "details");

  return (
    <div>
      <Topbar title="Orientation" subtitle="Skillit Academy | 8639191169" />
      <DataTable
        columns={buildSupportTableColumns({
          onNameClick: canViewDetails ? (row) => navigate(`/orientation/${row.id}`) : undefined,
          nameExtra: (row) => (
            <SupportActivityButton onClick={(e) => {
              e.stopPropagation();
              setActivityFor(row);
            }} />
          ),
        })}
        rows={rows}
        onRowClick={canViewDetails ? (row) => navigate(`/orientation/${row.id}`) : undefined}
      />

      <ActivityDrawer open={!!activityFor} student={activityFor} onClose={() => setActivityFor(null)} />
    </div>
  );
}
