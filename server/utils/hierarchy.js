import mongoose from "mongoose";
import Team from "../models/Team.js";
import User from "../models/User.js";
import {
  normalizeDesignation,
  isSdeDesignation,
  isManagerDesignation,
  isSrManagerDesignation,
  isMisExecutiveDesignation,
  isCustomerSupportDesignation,
} from "./userHierarchy.js";

// ---------------------------------------------------------------------------
// Team-derived hierarchy.
//
// Reporting relationships live ONLY in Manage Teams (Team.manager +
// Team.members). Nothing here is hardcoded per-role: a user's place in the
// hierarchy is resolved entirely from the Team collection, every time, so it
// can never go stale and never needs manual "reporting manager" assignment.
//
// Shape enforced (matches the product's Admin -> Sr.Manager -> Manager -> SDE
// hierarchy without needing a schema change):
//   - A Team's `manager` is that team's direct lead.
//   - A Senior Manager's own team's `members` are the Managers who report to
//     them; each of those Managers, in turn, leads their own team of SDEs.
//   - A Manager's own team's `members` are the SDEs who report to them.
// ---------------------------------------------------------------------------

const toId = (value) => (value ? String(value?._id || value) : null);

function isAdmin(user) {
  return normalizeDesignation(user?.role) === "admin";
}

// The team a user belongs to as a MEMBER (i.e. the team whose manager is
// this user's direct reporting line). A user should only ever be a member of
// one team at a time in this product's UX, so we take the first match.
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
// membership — this replaces the old manually-assigned User.reportingManager
// field as the single source of truth.
export async function getReportingManagerId(userId) {
  const team = await getOwnTeam(userId);
  return team?.manager ? toId(team.manager) : null;
}

// All team ids a user is authorized to operate within, per the hierarchy
// rule for their designation:
//  - Admin: every team (unrestricted — callers should treat null as "no
//    filter needed" rather than iterating every team id).
//  - Senior Manager: the teams they personally lead, plus every team led by
//    a Manager who is a member of one of those teams (the "teams under
//    them").
//  - Manager: only the team(s) they personally lead.
//  - SDE: none — SDEs never manage a team, only their own records.
export async function getManagedTeamIds(user) {
  if (!user || isAdmin(user)) return null; // null == unrestricted

  const designation = user.designation || user.role;
  const userId = user.id || user._id;

  if (isSdeDesignation(designation) || isMisExecutiveDesignation(designation) || isCustomerSupportDesignation(designation)) return [];

  const ledTeams = await getLedTeams(userId);
  const ledTeamIds = ledTeams.map((t) => toId(t._id));

  if (isSrManagerDesignation(designation)) {
    // Every user who is a member of a team this Senior Manager leads is a
    // direct report (typically Managers). Pull every team THOSE users lead,
    // union with the Senior Manager's own team(s).
    const directReportIds = ledTeams.flatMap((t) => (t.members || []).map(toId));
    const subTeams = directReportIds.length
      ? await Team.find({ manager: { $in: directReportIds } }).select("_id").lean()
      : [];
    return [...new Set([...ledTeamIds, ...subTeams.map((t) => toId(t._id))])];
  }

  if (isManagerDesignation(designation)) {
    return ledTeamIds;
  }

  // Unknown/other designations (Tech, MIS Executive, Relationship Manager,
  // Customer Support Executive, etc.) do not carry hierarchy-wide record
  // access — they only ever see what Read/Update/Delete flags on their own
  // module rows allow, scoped to their own records.
  return [];
}

// All user ids "under" this user per the hierarchy (their own reports plus,
// for Senior Manager, their reports' reports). Includes the user themself
// only when explicitly asked via `includeSelf`.
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
  return [...ids];
}

// Mongo filter to scope Student queries to what this user is allowed to see,
// per the hierarchy. Applied server-side, always — the frontend never
// decides this.
export async function getOwnershipFilter(user) {
  if (!user) return { _id: null }; // no user => no access
  if (isAdmin(user)) return {};

  const userId = String(user.id || user._id || "");
  const designation = user.designation || user.role;
  if (
    isSrManagerDesignation(designation) ||
    isMisExecutiveDesignation(designation) ||
    isCustomerSupportDesignation(designation)
  ) {
    // Senior Managers, MIS Executives, and Customer Support Executives see the full student dataset, like Admin. Their team
    // assignment still matters for reporting/transfer rules (if any), but not for
    // student visibility.
    return {};
  }
  const isLeadership = isManagerDesignation(designation) || isSrManagerDesignation(designation);

  if (!isLeadership) {
    // SDE (and any other non-leadership designation): own records only.
    // createdById is authoritative; createdBy (name) is kept only as a
    // best-effort fallback for legacy rows created before this field existed.
    return {
      $or: [
        { createdById: mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : userId },
        { $and: [{ createdById: null }, { createdBy: user.name }] },
      ],
    };
  }

  const managedUserIds = await getManagedUserIds(user, { includeSelf: true });
  if (!managedUserIds || managedUserIds.length === 0) {
    // Manager/Sr.Manager with no team configured yet in Manage Teams sees
    // nothing until Admin sets up their team — never falls back to "see all".
    return { _id: null };
  }

  const managedUsers = await User.find({
    _id: { $in: managedUserIds.filter((id) => mongoose.isValidObjectId(id)) },
  })
    .select("name")
    .lean();
  const managedNames = [...new Set(managedUsers.map((u) => u.name).filter(Boolean))];
  const objectIds = managedUserIds
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const idMatch = objectIds.length > 0 ? { createdById: { $in: objectIds } } : null;
  const nameMatch = managedNames.length > 0 ? { $and: [{ createdById: null }, { createdBy: { $in: managedNames } }] } : null;
  if (idMatch && nameMatch) return { $or: [idMatch, nameMatch] };
  if (idMatch) return idMatch;
  if (nameMatch) return nameMatch;
  return { _id: null };
}

// Used by Lead Transfer: can `actor` reassign a lead to `targetUserId`?
//  - Admin: anyone.
//  - Senior Manager: any SDE within the teams under them.
//  - Manager: any SDE within their own team only.
//  - SDE: never (SDEs cannot transfer leads).
export async function canAssignToUser(actor, targetUserId) {
  if (!actor || !targetUserId) return false;
  if (isAdmin(actor)) return true;

  const designation = actor.designation || actor.role;
  if (isSrManagerDesignation(designation)) {
    const targetUser = await User.findById(targetUserId).select("designation status").lean();
    return Boolean(targetUser && targetUser.status === "Active" && isSdeDesignation(targetUser.designation));
  }

  if (!isManagerDesignation(designation)) return false;

  const managedUserIds = await getManagedUserIds(actor, { includeSelf: false });
  if (!managedUserIds || !managedUserIds.includes(String(targetUserId))) return false;

  const targetUser = await User.findById(targetUserId).select("designation status").lean();
  return Boolean(targetUser && targetUser.status === "Active" && isSdeDesignation(targetUser.designation));
}

// Can `actor` act on a record currently owned by `ownerUserId`? Used to gate
// per-record write actions (edit/enroll/cancel/etc.) beyond the list filter.
export async function canAccessOwner(actor, ownerUserId, ownerName) {
  if (!actor) return false;
  if (isAdmin(actor)) return true;

  const designation = actor.designation || actor.role;
  if (
    isSrManagerDesignation(designation) ||
    isMisExecutiveDesignation(designation) ||
    isCustomerSupportDesignation(designation)
  ) return true;
  const actorId = String(actor.id || actor._id || "");
  const isLeadership = isManagerDesignation(designation) || isSrManagerDesignation(designation);

  if (!isLeadership) {
    if (ownerUserId) return String(ownerUserId) === actorId;
    // Legacy record with no owner id recorded — fall back to name match.
    return Boolean(ownerName) && ownerName === actor.name;
  }

  const managedUserIds = await getManagedUserIds(actor, { includeSelf: true });
  if (!managedUserIds) return true;
  if (ownerUserId) return managedUserIds.includes(String(ownerUserId));

  if (!ownerName) return false;
  const managedUsers = await User.find({
    _id: { $in: managedUserIds.filter((id) => mongoose.isValidObjectId(id)) },
  })
    .select("name")
    .lean();
  return managedUsers.some((u) => u.name === ownerName);
}
