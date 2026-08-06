import mongoose from "mongoose";
import Team from "../models/Team.js";
import User from "../models/User.js";
import UserTransferHistory from "../models/UserTransferHistory.js";
import { isSdeDesignation } from "../utils/userHierarchy.js";

async function logUserTeamChange(userId, toTeamId, actorUser) {
  const fromTeam = await Team.findOne({ members: userId }).lean();
  const fromTeamId = fromTeam?._id || null;
  const targetTeamId = toTeamId || null;
  
  if (String(fromTeamId) === String(targetTeamId)) {
    return;
  }
  
  let toTeam = null;
  if (targetTeamId) {
    toTeam = await Team.findById(targetTeamId).lean();
  }
  
  let fromManagerName = "";
  if (fromTeam?.manager) {
    const mgr = await User.findById(fromTeam.manager).select("name").lean();
    fromManagerName = mgr?.name || "";
  }
  
  let toManagerName = "";
  if (toTeam?.manager) {
    const mgr = await User.findById(toTeam.manager).select("name").lean();
    toManagerName = mgr?.name || "";
  }
  
  await UserTransferHistory.create({
    userId,
    fromTeamId,
    fromTeamName: fromTeam?.name || "No Team",
    toTeamId: targetTeamId,
    toTeamName: toTeam?.name || "No Team",
    fromManagerId: fromTeam?.manager || null,
    fromManagerName,
    toManagerId: toTeam?.manager || null,
    toManagerName,
    transferredBy: actorUser?.name || "Admin",
    transferredById: actorUser?.id || actorUser?._id || null,
    transferredAt: new Date(),
  });
}

async function shapeTeam(doc) {
  let managerName = "";
  if (doc.manager && typeof doc.manager === "object") {
    managerName = doc.manager.name || "";
  } else if (doc.manager) {
    const manager = await User.findById(doc.manager).select("name").lean();
    managerName = manager?.name || "";
  }

  const membersRaw = Array.isArray(doc.members) ? doc.members : [];
  const existingUsers = await User.find({
    _id: { $in: membersRaw },
    status: { $ne: "Archived" },
  }).select("_id").lean();
  const validMemberIds = existingUsers.map((u) => u._id.toString());

  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    status: doc.status,
    manager: doc.manager?._id ? doc.manager._id : doc.manager || null,
    managerName,
    userCount: validMemberIds.length,
    members: validMemberIds,
    createdBy: doc.createdBy,
    updatedBy: doc.updatedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

const toId = (value) => (value ? String(value?._id || value) : null);
const uniqueIds = (values = []) => [...new Set((Array.isArray(values) ? values : []).map(toId).filter(Boolean))];

async function findMemberConflicts(teamId, userIds) {
  const ids = uniqueIds(userIds);
  if (ids.length === 0) return [];

  const selectedUsers = await User.find({ _id: { $in: ids } }).select("name designation role").lean();
  const singleTeamIds = selectedUsers
    .filter((user) => isSdeDesignation(user.designation || user.role))
    .map((user) => toId(user._id));
  const singleTeamIdSet = new Set(singleTeamIds);

  if (singleTeamIds.length === 0) return [];

  const blockedTeams = await Team.find({
    _id: { $ne: teamId },
    members: { $in: singleTeamIds },
  })
    .select("name members")
    .lean();

  if (blockedTeams.length === 0) return [];

  const userById = new Map(selectedUsers.map((user) => [toId(user._id), user]));
  const conflicts = new Map();

  for (const team of blockedTeams) {
    for (const memberId of team.members || []) {
      const id = toId(memberId);
      if (!id || !singleTeamIdSet.has(id)) continue;
      if (!conflicts.has(id)) {
        const user = userById.get(id) || {};
        conflicts.set(id, {
          id,
          name: user.name || "",
          designation: user.designation || "",
          teamNames: new Set(),
        });
      }
      conflicts.get(id).teamNames.add(team.name || "");
    }
  }

  return [...conflicts.values()].map((entry) => ({
    id: entry.id,
    name: entry.name,
    designation: entry.designation,
    teamNames: [...entry.teamNames].filter(Boolean),
  }));
}

export async function listTeams(req, res) {
  const teams = await Team.find()
    .sort({ createdAt: -1 })
    .populate("manager", "name")
    .lean();
  res.json({ teams: await Promise.all(teams.map(shapeTeam)) });
}

export async function createTeam(req, res) {
  const { name, manager } = req.body || {};
  if (!name) return res.status(400).json({ message: "Team name is required" });

  const team = await Team.create({
    name,
    manager: manager || null,
    createdBy: req.user?.name || "Admin",
    updatedBy: req.user?.name || "Admin",
  });
  res.status(201).json({ team: await shapeTeam(team) });
}

export async function updateTeam(req, res) {
  const { id } = req.params;
  const team = await Team.findById(id);
  if (!team) return res.status(404).json({ message: "Team not found" });

  const { name, description, manager, status } = req.body || {};
  if (name !== undefined) team.name = name;
  if (description !== undefined) team.description = description;
  if (manager !== undefined) team.manager = manager || null;
  if (status !== undefined) team.status = status;
  team.updatedBy = req.user?.name || "Admin";

  await team.save();
  res.json({ team: await shapeTeam(team) });
}

export async function assignUsers(req, res) {
  const { id } = req.params;
  const { userIds } = req.body || {};
  const team = await Team.findById(id);
  if (!team) return res.status(404).json({ message: "Team not found" });

  let nextMembers = uniqueIds(userIds);
  if (team.manager) {
    nextMembers = nextMembers.filter((mId) => String(mId) !== String(team.manager));
  }
  const conflicts = await findMemberConflicts(team._id, nextMembers);
  if (conflicts.length > 0) {
    return res.status(409).json({
      message: "Some users are already assigned to another team",
      conflicts,
    });
  }

  const previousMembers = (team.members || []).map((m) => String(m));
  const newMembers = nextMembers.map((m) => String(m));

  const removedUsers = previousMembers.filter((m) => !newMembers.includes(m));
  const addedUsers = newMembers.filter((m) => !previousMembers.includes(m));

  for (const userId of removedUsers) {
    await logUserTeamChange(userId, null, req.user);
  }
  for (const userId of addedUsers) {
    await logUserTeamChange(userId, team._id, req.user);
  }

  team.members = nextMembers.map((memberId) => new mongoose.Types.ObjectId(memberId));
  team.updatedBy = req.user?.name || "Admin";
  await team.save();
  res.json({ team: await shapeTeam(team) });
}

export async function deleteTeam(req, res) {
  const { id } = req.params;
  const team = await Team.findById(id);
  if (!team) return res.status(404).json({ message: "Team not found" });

  const validMemberCount = await User.countDocuments({
    _id: { $in: team.members || [] },
    status: { $ne: "Archived" },
  });
  if (validMemberCount > 0) {
    return res.status(400).json({
      message: "This team cannot be deleted because it still has assigned members.",
    });
  }

  await Team.findByIdAndDelete(id);
  res.json({ ok: true });
}

export async function transferTeamMembers(req, res) {
  const { id } = req.params;
  const { toTeamId } = req.body || {};

  const fromTeam = await Team.findById(id);
  if (!fromTeam) return res.status(404).json({ message: "Source team not found" });

  const toTeam = await Team.findById(toTeamId);
  if (!toTeam) return res.status(404).json({ message: "Destination team not found" });

  if (String(id) === String(toTeamId)) {
    return res.status(400).json({ message: "Source and destination teams must be different" });
  }

  const memberIds = fromTeam.members || [];
  if (memberIds.length > 0) {
    for (const userId of memberIds) {
      await logUserTeamChange(userId, toTeamId, req.user);
    }

    // 1. Add members to the destination team
    const existingMembers = new Set((toTeam.members || []).map((m) => String(m)));
    for (const mId of memberIds) {
      existingMembers.add(String(mId));
    }
    toTeam.members = Array.from(existingMembers).map((m) => new mongoose.Types.ObjectId(m));
    toTeam.updatedBy = req.user?.name || "Admin";
    await toTeam.save();

    // 2. Empty the source team
    fromTeam.members = [];
    fromTeam.updatedBy = req.user?.name || "Admin";
    await fromTeam.save();

    // 3. Update the department string for all transferred users to the destination team's name
    await User.updateMany(
      { _id: { $in: memberIds } },
      { $set: { department: toTeam.name } }
    );
  }

  res.json({ ok: true, message: `Successfully transferred ${memberIds.length} member(s)` });
}
