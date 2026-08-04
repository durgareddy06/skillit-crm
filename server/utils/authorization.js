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
  
  // SDE, Manager, and Sr.Manager must ALWAYS be scoped hierarchically
  // and can never get unrestricted access (null) via readAll permission.
  const roleName = user.designation || user.role;
  const isHierarchical =
    isSdeDesignation(roleName) ||
    isManagerDesignation(roleName) ||
    isSrManagerDesignation(roleName);

  if (!isHierarchical) {
    const hasReadAll = await userHasPermission(user, "student", "readAll");
    if (hasReadAll) return null;
  }

  const userId = String(user.id || user._id || "");
  if (!userId) return [];

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

  const objectIds = accessibleIds
    .filter(id => mongoose.isValidObjectId(id))
    .map(id => new mongoose.Types.ObjectId(id));

  // Retrieve names of all accessible users to support legacy name-based ownership checks
  const users = await User.find({ _id: { $in: objectIds } }).select("name").lean();
  const accessibleNames = users.map(u => u.name).filter(Boolean);

  return {
    $or: [
      { createdById: { $in: objectIds } },
      { createdBy: { $in: accessibleNames } }
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

  // Check matching by createdById
  const createdByIdStr = student.createdById ? String(student.createdById) : null;
  if (createdByIdStr && accessibleIds.includes(createdByIdStr)) {
    return true;
  }

  // Legacy fallback: check createdBy name matching accessible names
  if (student.createdBy) {
    const objectIds = accessibleIds
      .filter(id => mongoose.isValidObjectId(id))
      .map(id => new mongoose.Types.ObjectId(id));
    const users = await User.find({ _id: { $in: objectIds } }).select("name").lean();
    const accessibleNames = users.map(u => u.name).filter(Boolean);
    if (accessibleNames.includes(student.createdBy)) {
      return true;
    }
  }

  return false;
}
