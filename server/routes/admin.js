import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  listUsers, listArchivedUsers, createUser, updateUser, deleteUser, restoreUser, resetPassword, resetLoginAttempts, getUserHistoricalData,
} from "../controllers/adminUserController.js";
import {
  listTeams, createTeam, updateTeam, assignUsers, deleteTeam, transferTeamMembers,
} from "../controllers/adminTeamController.js";
import {
  listRoles, getRole, createRole, updateRole, deleteRole, transferRoleUsers,
} from "../controllers/adminRoleController.js";
import {
  listModules, createModule, updateModule, deleteModule,
} from "../controllers/adminModuleController.js";

const router = Router();

// GET /modules is accessible by any authenticated user because frontend components
// (like StudentDetail, StudentPunchOrderPage, SupportDetailPage) load module config/fields.
router.get("/modules", requireAuth, listModules);

// Every other route here is admin-only.
router.use(requireAuth, requireRole("admin"));

// Users
router.get("/users", listUsers);
router.get("/users/archived", listArchivedUsers);
router.get("/users/:id/historical-data", getUserHistoricalData);
router.post("/users", createUser);
router.patch("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.post("/users/:id/restore", restoreUser);
router.post("/users/:id/reset-password", resetPassword);
router.post("/users/:id/reset-login-attempts", resetLoginAttempts);

// Teams
router.get("/teams", listTeams);
router.post("/teams", createTeam);
router.patch("/teams/:id", updateTeam);
router.post("/teams/:id/assign-users", assignUsers);
router.post("/teams/:id/transfer-members", transferTeamMembers);
router.delete("/teams/:id", deleteTeam);

// Roles
router.get("/roles", listRoles);
router.get("/roles/:id", getRole);
router.post("/roles", createRole);
router.patch("/roles/:id", updateRole);
router.post("/roles/:id/transfer-users", transferRoleUsers);
router.delete("/roles/:id", deleteRole);

// Modules — the database-driven registry that Roles reference by key.
router.post("/modules", createModule);
router.patch("/modules/:id", updateModule);
router.delete("/modules/:id", deleteModule);

export default router;
