import api from "./axios";

// Users
export const listUsers = () => api.get("/admin/users").then((r) => r.data.users);
export const createUser = (payload) => api.post("/admin/users", payload).then((r) => r.data.user);
export const updateUser = (id, payload) => api.patch(`/admin/users/${id}`, payload).then((r) => r.data.user);
export const deleteUser = (id) => api.delete(`/admin/users/${id}`).then((r) => r.data);
export const resetPassword = (id, password) =>
  api.post(`/admin/users/${id}/reset-password`, { password }).then((r) => r.data);
export const resetLoginAttempts = (id) =>
  api.post(`/admin/users/${id}/reset-login-attempts`).then((r) => r.data.user);

// Teams
export const listTeams = () => api.get("/admin/teams").then((r) => r.data.teams);
export const createTeam = (payload) => api.post("/admin/teams", payload).then((r) => r.data.team);
export const updateTeam = (id, payload) => api.patch(`/admin/teams/${id}`, payload).then((r) => r.data.team);
export const assignUsersToTeam = (id, userIds) =>
  api.post(`/admin/teams/${id}/assign-users`, { userIds }).then((r) => r.data.team);
export const deleteTeam = (id) => api.delete(`/admin/teams/${id}`).then((r) => r.data);

// Roles
export const listRoles = () => api.get("/admin/roles").then((r) => r.data.roles);
export const getRole = (id) => api.get(`/admin/roles/${id}`).then((r) => r.data.role);
export const createRole = (payload) => api.post("/admin/roles", payload).then((r) => r.data.role);
export const updateRole = (id, payload) => api.patch(`/admin/roles/${id}`, payload).then((r) => r.data.role);
export const deleteRole = (id) => api.delete(`/admin/roles/${id}`).then((r) => r.data);

// Modules — the database-driven registry of assignable modules.
export const listModules = () => api.get("/admin/modules").then((r) => r.data.modules);
export const createModule = (payload) => api.post("/admin/modules", payload).then((r) => r.data.module);
export const updateModule = (id, payload) => api.patch(`/admin/modules/${id}`, payload).then((r) => r.data.module);
export const deleteModule = (id) => api.delete(`/admin/modules/${id}`).then((r) => r.data);
