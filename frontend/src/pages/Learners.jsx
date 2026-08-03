import React, { useEffect, useState } from "react";
import Topbar from "../components/Topbar";
import DataTable from "../components/DataTable";
import ActivityDrawer from "../components/ActivityDrawer";
import { listStudents } from "../api/students";
import { buildSupportTableColumns, SupportActivityButton } from "../config/supportTableColumns.jsx";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../lib/permissions";

export default function Learners() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [activityFor, setActivityFor] = useState(null);

  useEffect(() => {
    listStudents("learners")
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="relative">
      <Topbar title="Learners" subtitle="Skillit Academy | 8639191169" />

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          <DataTable
            columns={buildSupportTableColumns({
              onNameClick: (row) => setActivityFor(row),
              nameExtra: (row) => (
                <SupportActivityButton onClick={(e) => {
                  e.stopPropagation();
                  setActivityFor(row);
                }} />
              ),
            })}
            rows={rows}
            onRowClick={(row) => setActivityFor(row)}
          />
        </div>
      </div>

      <ActivityDrawer open={!!activityFor} student={activityFor} onClose={() => setActivityFor(null)} />
    </div>
  );
}
