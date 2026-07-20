import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  listUsers, createUser, updateUser, deleteUser, resetPassword, resetLoginAttempts,
} from "../controllers/adminUserController.js";
import {
  listTeams, createTeam, updateTeam, assignUsers, deleteTeam,
} from "../controllers/adminTeamController.js";
import {
  listRoles, getRole, createRole, updateRole, deleteRole,
} from "../controllers/adminRoleController.js";
import {
  listModules, createModule, updateModule, deleteModule,
} from "../controllers/adminModuleController.js";

const router = Router();

// Every route here is admin-only.
router.use(requireAuth, requireRole("admin"));

// Users
router.get("/users", listUsers);
router.post("/users", createUser);
router.patch("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);
router.post("/users/:id/reset-password", resetPassword);
router.post("/users/:id/reset-login-attempts", resetLoginAttempts);

// Teams
router.get("/teams", listTeams);
router.post("/teams", createTeam);
router.patch("/teams/:id", updateTeam);
router.post("/teams/:id/assign-users", assignUsers);
router.delete("/teams/:id", deleteTeam);

// Roles
router.get("/roles", listRoles);
router.get("/roles/:id", getRole);
router.post("/roles", createRole);
router.patch("/roles/:id", updateRole);
router.delete("/roles/:id", deleteRole);

// Modules — the database-driven registry that Roles reference by key.
router.get("/modules", listModules);
router.post("/modules", createModule);
router.patch("/modules/:id", updateModule);
router.delete("/modules/:id", deleteModule);

export default router;
