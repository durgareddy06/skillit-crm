import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Topbar from "../components/Topbar";
import DataTable from "../components/DataTable";
import { listStudents } from "../api/students";
import { buildSupportTableColumns } from "../config/supportTableColumns.jsx";

export default function Onboarding() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    listStudents("approved")
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  }, []);

  return (
    <div>
      <Topbar title="Onboarding" subtitle="Skillit Academy | 8639191169" />
      <DataTable
        columns={buildSupportTableColumns({ navigate, detailPath: "/onboarding" })}
        rows={rows}
        onRowClick={(row) => navigate(`/onboarding/${row.id}`)}
      />
    </div>
  );
}
