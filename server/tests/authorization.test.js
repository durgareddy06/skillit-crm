import "dotenv/config";
import test from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import Role from "../models/Role.js";
import Team from "../models/Team.js";
import { getAccessibleUserIds } from "../utils/authorization.js";

// Ensure DB connection before running tests
test.before(async () => {
  // Connect using MONGO_URI from env or fallback
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/crm";
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
  
  // Clear any existing test data to ensure clean environment
  await User.deleteMany({ phone: { $regex: /^99999/ } });
  await Team.deleteMany({ name: { $regex: /^TestTeam/ } });
  await Role.deleteMany({ name: { $regex: /^TestRole/ } });
});

test.after(async () => {
  // Final cleanup
  await User.deleteMany({ phone: { $regex: /^99999/ } });
  await Team.deleteMany({ name: { $regex: /^TestTeam/ } });
  await Role.deleteMany({ name: { $regex: /^TestRole/ } });
  await mongoose.disconnect();
});

test("authorization - getAccessibleUserIds regression tests", async (t) => {
  // Create a role that has readAll permission on student module
  const readAllRole = await Role.create({
    name: "TestRole AGM",
    status: "Active",
    permissions: [
      {
        key: "student",
        label: "Student",
        parentKey: null,
        basic: { create: false, read: true, update: false, delete: false, details: false },
        administrative: { readAll: true, updateAll: false, deleteAll: false },
        special: { email: false, bulkEmail: false, bulkUpdate: false, bulkDelete: false }
      }
    ],
    createdBy: "System",
    updatedBy: "System"
  });

  await t.test("Admin user returns null (unrestricted)", async () => {
    const adminUser = {
      id: new mongoose.Types.ObjectId().toString(),
      role: "admin",
      designation: "Admin"
    };
    const result = await getAccessibleUserIds(adminUser);
    assert.strictEqual(result, null);
  });

  await t.test("Customer Support user returns null (unrestricted)", async () => {
    const csUser = {
      id: new mongoose.Types.ObjectId().toString(),
      role: "Customer Support Executive",
      designation: "Customer Support Executive"
    };
    const result = await getAccessibleUserIds(csUser);
    assert.strictEqual(result, null);
  });

  await t.test("MIS Executive user returns null (unrestricted)", async () => {
    const misUser = {
      id: new mongoose.Types.ObjectId().toString(),
      role: "MIS Executive",
      designation: "MIS Executive"
    };
    const result = await getAccessibleUserIds(misUser);
    assert.strictEqual(result, null);
  });

  await t.test("Custom AGM reporting role with NO subordinates always receives zero student records (only their own ID is returned)", async () => {
    const agmUserDoc = await User.create({
      name: "Test AGM User",
      phone: "9999911111",
      role: "TestRole AGM",
      roleId: readAllRole._id,
      designation: "AGM",
      passwordHash: "dummy"
    });

    const agmUser = {
      id: agmUserDoc._id.toString(),
      role: "TestRole AGM",
      roleId: readAllRole._id.toString(),
      designation: "AGM"
    };

    // Create a team with this AGM as manager, but NO members/SDs
    const testTeam = await Team.create({
      name: "TestTeam AGM Team",
      manager: agmUserDoc._id,
      members: [],
      status: "Active",
      createdBy: "System",
      updatedBy: "System"
    });

    const result = await getAccessibleUserIds(agmUser);
    
    // Ensure they don't get unrestricted access (null) and instead get only their own ID (which means 0 records when queried since no students are assigned to them)
    assert.notStrictEqual(result, null);
    assert.deepStrictEqual(result, [agmUserDoc._id.toString()]);
  });

  await t.test("Manager with subordinates resolves subordinate IDs recursively", async () => {
    const managerDoc = await User.create({
      name: "Test Manager User",
      phone: "9999922222",
      role: "Manager",
      designation: "Manager",
      passwordHash: "dummy"
    });

    const sde1Doc = await User.create({
      name: "Test SDE 1 User",
      phone: "9999933333",
      role: "SDE",
      designation: "SDE",
      passwordHash: "dummy"
    });

    const sde2Doc = await User.create({
      name: "Test SDE 2 User",
      phone: "9999944444",
      role: "SDE",
      designation: "SDE",
      passwordHash: "dummy"
    });

    const managerUser = {
      id: managerDoc._id.toString(),
      role: "Manager",
      designation: "Manager"
    };

    // Create a team with this manager and the two SDEs as members
    const testTeam = await Team.create({
      name: "TestTeam Manager Team",
      manager: managerDoc._id,
      members: [sde1Doc._id, sde2Doc._id],
      status: "Active",
      createdBy: "System",
      updatedBy: "System"
    });

    const result = await getAccessibleUserIds(managerUser);
    
    assert.notStrictEqual(result, null);
    assert.ok(result.includes(managerDoc._id.toString()));
    assert.ok(result.includes(sde1Doc._id.toString()));
    assert.ok(result.includes(sde2Doc._id.toString()));
    assert.strictEqual(result.length, 3);
  });
});
