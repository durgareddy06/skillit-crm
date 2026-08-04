import mongoose from "mongoose";
import Team from "../models/Team.js";
import User from "../models/User.js";
import { userHasPermission } from "./permissions.js";
import { isSdeDesignation, isCustomerSupportDesignation, isMisExecutiveDesignation } from "./userHierarchy.js";
import { buildVisibilityFilter, canAccessStudentHelper } from "./authorization.js";

// ---------------------------------------------------------------------------
// Dynamic, recursive hierarchy-based access control.
//
// Reporting relationships live in Manage Teams (Team.manager + Team.members).
// A user's place in the hierarchy is resolved entirely from the Team collection
// recursively, meaning parent managers automatically see all descendants.
// ---------------------------------------------------------------------------

const toId = (value) => (value ? String(value?._id || value) : null);

function isAdmin(user) {
  return String(user?.role || "").trim().toLowerCase().replace(/\s+/g, "") === "admin";
}

// The team a user belongs to as a MEMBER (i.e. the team whose manager is
// this user's direct reporting line). A user should only ever be a member of
// one team at a time, so we take the first match.
export async function getOwnTeam(userId) {
  if (!userId) return null;
  return Team.findOne({ members: userId }).lean();
}

// The team(s) this user leads as manager.
export async function getLedTeams(userId) {
  if (!userId) return [];
  return Team.find({ manager: userId }).lean();
}

// Resolves the id of the user's direct reporting manager purely from Team
// membership.
export async function getReportingManagerId(userId) {
  const team = await getOwnTeam(userId);
  return team?.manager ? toId(team.manager) : null;
}

// Resolves all ancestor manager IDs of a user recursively, climbing up the team hierarchy.
export async function getAncestorManagerIds(userId) {
  if (!userId) return [];
  const ancestors = [];
  const visited = new Set();
  
  let currentId = String(userId);
  visited.add(currentId);
  
  while (true) {
    const managerId = await getReportingManagerId(currentId);
    if (!managerId) break;
    
    const managerIdStr = String(managerId);
    if (visited.has(managerIdStr)) {
      console.warn(`[Hierarchy] Cycle detected in ancestor chain for user ${userId} at ${managerIdStr}`);
      break;
    }
    
    ancestors.push(new mongoose.Types.ObjectId(managerIdStr));
    visited.add(managerIdStr);
    currentId = managerIdStr;
  }
  
  return ancestors;
}

// All team ids a user is authorized to operate within.
// Traverses the team hierarchy recursively to include all sub-teams.
export async function getManagedTeamIds(user) {
  if (!user) return [];
  if (isAdmin(user)) return null; // null == unrestricted

  const userId = String(user.id || user._id);
  const visited = new Set();
  const queue = [userId];
  visited.add(userId);
  const managedTeamIds = new Set();

  while (queue.length > 0) {
    const currentId = queue.shift();
    // Find all teams led by currentId
    const teams = await Team.find({ manager: currentId }).select("_id members").lean();
    for (const team of teams) {
      managedTeamIds.add(String(team._id));
      for (const member of team.members || []) {
        const memberIdStr = String(member);
        if (!visited.has(memberIdStr)) {
          visited.add(memberIdStr);
          queue.push(memberIdStr);
        }
      }
    }
  }

  return [...managedTeamIds];
}

// All user ids "under" this user recursively.
export async function getManagedUserIds(user, { includeSelf = false } = {}) {
  const userId = String(user?.id || user?._id || "");
  if (!user || isAdmin(user)) return null; // null == unrestricted

  const teamIds = await getManagedTeamIds(user);
  const ids = new Set(includeSelf && userId ? [userId] : []);
  if (!teamIds || teamIds.length === 0) return [...ids];

  const teams = await Team.find({ _id: { $in: teamIds } }).select("manager members").lean();
  for (const team of teams) {
    if (team.manager) ids.add(toId(team.manager));
    for (const m of team.members || []) ids.add(toId(m));
  }

  if (!includeSelf && userId) {
    ids.delete(userId);
  }

  return [...ids];
}

// Mongo filter to scope Student queries dynamically.
// If the user has administrative 'readAll' permission, they can see all records.
// Otherwise, they are restricted to their own records and their descendants.
export async function getOwnershipFilter(user) {
  if (!user) return { _id: null }; // no user => no access
  return buildVisibilityFilter(user);
}

// Used by Lead Transfer: can `actor` reassign a lead to `targetUserId`?
// If the actor has administrative 'updateAll' permission or is admin, they can assign to any active user.
// Otherwise, they can only assign to active users in their descendant hierarchy.
export async function canAssignToUser(actor, targetUserId) {
  if (!actor || !targetUserId) return false;
  
  const targetUser = await User.findById(targetUserId).select("designation role status").lean();
  if (!targetUser || targetUser.status !== "Active") {
    return false;
  }

  if (isAdmin(actor)) {
    const ledTeamsCount = await Team.countDocuments({ manager: targetUserId });
    return ledTeamsCount === 0 || String(targetUser.designation || targetUser.role || "").toLowerCase().includes("sde");
  }

  const hasUpdateAll = await userHasPermission(actor, "student", "updateAll");
  if (hasUpdateAll) return true;

  const managedUserIds = await getManagedUserIds(actor, { includeSelf: false });
  return managedUserIds.includes(String(targetUserId));
}

// Dynamic dynamic levels resolver based on reporting managers structure
export async function getDynamicHierarchyLevels() {
  const users = await User.find({ status: "Active" }).select("name role designation").lean();
  const teams = await Team.find().select("manager members").lean();

  const userMap = {};
  for (const u of users) {
    userMap[u._id.toString()] = u;
  }

  const reportingMap = {};
  for (const team of teams) {
    if (!team.manager) continue;
    const mgrId = team.manager.toString();
    for (const member of team.members || []) {
      reportingMap[member.toString()] = mgrId;
    }
  }

  const adj = {};
  const inDegree = {};
  const allDesignations = new Set();

  for (const u of users) {
    const des = u.designation || u.role || "";
    if (des) allDesignations.add(des);
  }

  for (const des of allDesignations) {
    adj[des] = new Set();
    inDegree[des] = 0;
  }

  for (const u of users) {
    const des = u.designation || u.role || "";
    if (!des) continue;

    const mgrId = reportingMap[u._id.toString()];
    if (mgrId && userMap[mgrId]) {
      const mgr = userMap[mgrId];
      const mgrDes = mgr.designation || mgr.role || "";
      if (mgrDes && mgrDes !== des) {
        if (!adj[mgrDes].has(des)) {
          adj[mgrDes].add(des);
          inDegree[des] = (inDegree[des] || 0) + 1;
        }
      }
    }
  }

  const queue = [];
  for (const des of allDesignations) {
    if (!inDegree[des]) {
      queue.push(des);
    }
  }

  const sortedLevels = [];
  while (queue.length > 0) {
    queue.sort();
    const curr = queue.shift();
    sortedLevels.push(curr);

    const neighbors = adj[curr] || [];
    for (const neighbor of neighbors) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Any leftover isolated/cyclic designations
  for (const des of allDesignations) {
    if (!sortedLevels.includes(des)) {
      sortedLevels.push(des);
    }
  }

  return sortedLevels;
}

// Can `actor` act on a record currently owned by `ownerUserId`?
// If the actor has administrative 'readAll' or 'updateAll' permissions, they can access any record.
// Otherwise, they can only access records owned by themselves or their descendants.
export async function canAccessOwner(actor, ownerUserId, ownerName, reportedToId = null, reportingHierarchyIds = []) {
  if (!actor) return false;
  const student = { createdById: ownerUserId, createdBy: ownerName };
  return canAccessStudentHelper(actor, student);
}
