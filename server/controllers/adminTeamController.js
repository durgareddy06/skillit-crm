import mongoose from "mongoose";
import Team from "../models/Team.js";
import User from "../models/User.js";
import { isManagerDesignation, isSdeDesignation } from "../utils/userHierarchy.js";

async function shapeTeam(doc) {
  let managerName = "";
  if (doc.manager && typeof doc.manager === "object") {
    managerName = doc.manager.name || "";
  } else if (doc.manager) {
    const manager = await User.findById(doc.manager).select("name").lean();
    managerName = manager?.name || "";
  }
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    status: doc.status,
    manager: doc.manager?._id ? doc.manager._id : doc.manager || null,
    managerName,
    userCount: Array.isArray(doc.members) ? doc.members.length : 0,
    members: doc.members || [],
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

  const selectedUsers = await User.find({ _id: { $in: ids } }).select("name designation").lean();
  const singleTeamIds = selectedUsers
    .filter((user) => isSdeDesignation(user.designation || user.role) || isManagerDesignation(user.designation || user.role))
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

  const nextMembers = uniqueIds(userIds);
  const conflicts = await findMemberConflicts(team._id, nextMembers);
  if (conflicts.length > 0) {
    return res.status(409).json({
      message: "Some users are already assigned to another team",
      conflicts,
    });
  }

  team.members = nextMembers.map((memberId) => new mongoose.Types.ObjectId(memberId));
  team.updatedBy = req.user?.name || "Admin";
  await team.save();
  res.json({ team: await shapeTeam(team) });
}

export async function deleteTeam(req, res) {
  const { id } = req.params;
  const team = await Team.findByIdAndDelete(id);
  if (!team) return res.status(404).json({ message: "Team not found" });
  res.json({ ok: true });
}
