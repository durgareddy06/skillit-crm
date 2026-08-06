import mongoose from "mongoose";
import User from "../models/User.js";
import Team from "../models/Team.js";
import { userHasPermission } from "./permissions.js";
import {
  isCustomerSupportDesignation,
  isMisExecutiveDesignation,
  isSdeDesignation,
  isManagerDesignation,
  isSrManagerDesignation
} from "./userHierarchy.js";

const normalize = (value = "") => String(value).trim().toLowerCase().replace(/[\s._-]+/g, "");

function isAdmin(user) {
  return normalize(user?.role || "") === "admin";
}

export function mergeFilters(a = {}, b = {}) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length === 0) return b;
  if (bKeys.length === 0) return a;
  return { $and: [a, b] };
}

/**
 * Resolves the set of User IDs that the given user is authorized to access based on the hierarchy.
 * Returns null if the user has unrestricted access (Admin, CS, MIS, or has readAll permission).
 * Otherwise, resolves the user's recursive subordinate hierarchy from the Team collection.
 * 
 * @param {object} user - The logged-in user object from req.user
 * @returns {Promise<string[]|null>} Array of accessible user IDs, or null if unrestricted
 */
export async function getAccessibleUserIds(user) {
  if (!user) return [];
  
  // 1. Unrestricted Roles and Permissions
  if (isAdmin(user)) return null;
  if (isCustomerSupportDesignation(user.designation || user.role)) return null;
  if (isMisExecutiveDesignation(user.designation || user.role)) return null;
  
  // All other roles (SDE, Manager, Sr. Manager, AGM, VP, or any custom roles) 
  // must ALWAYS be scoped hierarchically and can never get unrestricted access (null) 
  // via readAll permission. Since CS and MIS are handled above, all other roles
  // are treated as hierarchical.
  const userId = String(user.id || user._id || "");
  if (!userId) return [];

  // Check if the user has any active team assignments (either as manager or member)
  const hasTeamAssignment = await Team.exists({
    $or: [
      { manager: userId },
      { members: userId }
    ],
    status: "Active"
  });

  if (!hasTeamAssignment) {
    // If no team assignments exist, return empty array to ensure zero records are visible
    return [];
  }

  // 2. Resolve hierarchical visibility recursively
  const accessibleIds = new Set([userId]);
  const queue = [userId];
  const visited = new Set([userId]);

  while (queue.length > 0) {
    const currentId = queue.shift();
    
    // Find active teams led by the current user ID
    const teams = await Team.find({ manager: currentId, status: "Active" }).select("members").lean();
    for (const team of teams) {
      for (const member of team.members || []) {
        const memberIdStr = String(member);
        if (!visited.has(memberIdStr)) {
          visited.add(memberIdStr);
          accessibleIds.add(memberIdStr);
          queue.push(memberIdStr); // Add to queue to traverse their subordinates recursively
        }
      }
    }
  }

  return [...accessibleIds];
}

/**
 * Builds the MongoDB query filter for scoping student records based on the user's accessible user IDs.
 * 
 * @param {object} user - The logged-in user object
 * @returns {Promise<object>} MongoDB query filter object
 */
export async function buildVisibilityFilter(user) {
  const accessibleIds = await getAccessibleUserIds(user);
  if (accessibleIds === null) return {};

  const userIdStr = String(user.id || user._id || "");
  const userIdObj = mongoose.isValidObjectId(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : null;

  // Resolve if the user manages any active team. If not, they are a leaf (SDE).
  const isLeaf = userIdObj ? !(await Team.exists({ manager: userIdObj, status: "Active" })) : true;

  if (isLeaf) {
    // SDE / Leaf node can only see their own sales.
    return {
      $or: [
        ...(userIdObj ? [{ createdById: userIdObj }] : []),
        { createdBy: user.name }
      ]
    };
  }

  // Managers, Senior Managers, AGMs, VPs, etc. (Hierarchical non-leaf roles):
  // They should see:
  // 1. Sales they created themselves.
  // 2. Sales where they were in the reporting chain at the time of creation.
  return {
    $or: [
      ...(userIdObj ? [
        { createdById: userIdObj },
        { reportedToId: userIdObj },
        { reportingHierarchyIds: userIdObj }
      ] : []),
      { createdBy: user.name },
      { reportedTo: user.name }
    ]
  };
}

/**
 * Scopes an existing query filter with the user's visibility query filter.
 * 
 * @param {object} queryFilter - Existing MongoDB filter object
 * @param {object} user - The logged-in user object
 * @returns {Promise<object>} Merged filter object
 */
export async function applyRoleScope(queryFilter, user) {
  const visibilityFilter = await buildVisibilityFilter(user);
  return mergeFilters(queryFilter, visibilityFilter);
}

/**
 * Validates if the user is authorized to read, modify or delete a specific student record.
 * 
 * @param {object} user - The logged-in user object
 * @param {object} student - The student document from the database
 * @returns {Promise<boolean>} True if authorized, false otherwise
 */
export async function canAccessStudentHelper(user, student) {
  if (!user) return false;
  if (!student) return true;

  const accessibleIds = await getAccessibleUserIds(user);
  if (accessibleIds === null) return true;

  const userIdStr = String(user.id || user._id || "");
  const userIdObj = mongoose.isValidObjectId(userIdStr) ? new mongoose.Types.ObjectId(userIdStr) : null;

  // 1. Check if user is the creator of the record
  if (student.createdById && String(student.createdById) === userIdStr) {
    return true;
  }
  if (student.createdBy && student.createdBy === user.name) {
    return true;
  }

  // Check if user is a leaf (SDE). SDEs can only see their own sales.
  const isLeaf = userIdObj ? !(await Team.exists({ manager: userIdObj, status: "Active" })) : true;
  if (isLeaf) {
    return false;
  }

  // 2. For managers/hierarchical supervisors, check if they are in the reporting hierarchy at the time of creation
  if (student.reportedToId && String(student.reportedToId) === userIdStr) {
    return true;
  }
  if (student.reportedTo && student.reportedTo === user.name) {
    return true;
  }
  if (Array.isArray(student.reportingHierarchyIds)) {
    const hasInHierarchy = student.reportingHierarchyIds.some(
      (hId) => String(hId) === userIdStr
    );
    if (hasInHierarchy) {
      return true;
    }
  }

  return false;
}
