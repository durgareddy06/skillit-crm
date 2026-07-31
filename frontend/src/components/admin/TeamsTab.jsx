import React, { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import DataTable from "../DataTable";
import TeamFormModal from "./TeamFormModal";
import Modal from "../Modal";
import Button from "../Button";
import { Field, Select } from "../Field";
import * as adminApi from "../../api/admin";

const TeamsTab = forwardRef(function TeamsTab({ teams, users, loading, search, onRefresh }, ref) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferringTeam, setTransferringTeam] = useState(null);
  const [destTeamId, setDestTeamId] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  useImperativeHandle(ref, () => ({ openCreate: () => { setEditingTeam(null); setModalOpen(true); } }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => t.name?.toLowerCase().includes(q));
  }, [teams, search]);

  const openEdit = (t) => { setEditingTeam(t); setModalOpen(true); };

  const handleSave = async (payload) => {
    if (editingTeam) {
      await adminApi.updateTeam(editingTeam.id, payload);
    } else {
      await adminApi.createTeam(payload);
    }
    onRefresh();
  };

  const handleAssignUsers = async (teamId, userIds) => {
    try {
      await adminApi.assignUsersToTeam(teamId, userIds);
      onRefresh();
    } catch (error) {
      window.alert(error?.response?.data?.message || "Unable to update team members.");
      throw error;
    }
  };

  const handleDelete = async (t) => {
    if (t.userCount > 0) {
      setTransferringTeam(t);
      const otherTeams = teams.filter((team) => team.id !== t.id);
      setDestTeamId(otherTeams[0]?.id || "");
      setTransferModalOpen(true);
      return;
    }

    if (!window.confirm(`Delete team "${t.name}"?`)) return;
    try {
      await adminApi.deleteTeam(t.id);
      onRefresh();
    } catch (error) {
      window.alert(error?.response?.data?.message || "Unable to delete team.");
    }
  };

  const handleTransferAndConfirm = async () => {
    if (!destTeamId) return;
    setTransferLoading(true);
    try {
      await adminApi.transferTeamMembers(transferringTeam.id, destTeamId);
      await adminApi.deleteTeam(transferringTeam.id);
      setTransferModalOpen(false);
      setTransferringTeam(null);
      onRefresh();
    } catch (error) {
      window.alert(error?.response?.data?.message || "Unable to transfer members and delete team.");
    } finally {
      setTransferLoading(false);
    }
  };

  const columns = [
    { key: "name", label: "Name", width: "180px", render: (r) => <span className="text-skillit font-medium cursor-pointer" onClick={() => openEdit(r)}>{r.name}</span> },
    {
      key: "status", label: "Status", width: "120px", cellClassName: "whitespace-nowrap",
      render: (r) => (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${r.status === "Active" ? "text-emerald-600" : "text-slate-400"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${r.status === "Active" ? "bg-emerald-500" : "bg-slate-300"}`} /> {r.status}
        </span>
      ),
    },
    { key: "userCount", label: "User Count", width: "110px" },
    { key: "managerName", label: "Reporting Manager", width: "180px", cellClassName: "whitespace-nowrap" },
    { key: "createdAt", label: "Created At", width: "170px", render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleString() : "-" },
    { key: "updatedAt", label: "Upadated At", width: "170px", render: (r) => r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "-" },
    { key: "createdBy", label: "Created By", width: "130px", cellClassName: "whitespace-nowrap" },
    { key: "updatedBy", label: "Upadated By", width: "130px", cellClassName: "whitespace-nowrap" },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={filtered}
        tableLayout="auto"
        emptyText={loading ? "Loading teams…" : "No teams yet. Use the + button to create one."}
        rowMenu={(r) => [
          { label: "Edit", onClick: () => openEdit(r) },
          { label: "Delete", onClick: () => handleDelete(r) },
        ]}
      />

      <TeamFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onAssignUsers={handleAssignUsers}
        team={editingTeam}
        managers={users}
        allUsers={users}
        teams={teams}
      />

      <Modal
        open={transferModalOpen}
        onClose={() => !transferLoading && setTransferModalOpen(false)}
        title="Transfer Members"
      >
        <div className="space-y-5">
          <p className="text-sm text-slate-600 leading-relaxed">
            This team cannot be deleted because it still has assigned members. Please transfer all team members to another team before deleting this team.
          </p>

          <Field label="Destination Team" required>
            <Select
              value={destTeamId}
              onChange={(e) => setDestTeamId(e.target.value)}
              disabled={transferLoading}
            >
              <option value="" disabled>Select a team...</option>
              {teams
                .filter((team) => team.id !== transferringTeam?.id)
                .map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.userCount || 0} members)
                  </option>
                ))}
            </Select>
          </Field>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setTransferModalOpen(false)}
              disabled={transferLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleTransferAndConfirm}
              loading={transferLoading}
              disabled={!destTeamId}
            >
              Transfer Members
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
});

export default TeamsTab;
