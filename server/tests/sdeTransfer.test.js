import "dotenv/config";
import test from "node:test";
import assert from "node:assert";
import mongoose from "mongoose";
import User from "../models/User.js";
import Team from "../models/Team.js";
import Student from "../models/Student.js";
import UserTransferHistory from "../models/UserTransferHistory.js";
import { buildVisibilityFilter } from "../utils/authorization.js";
import { assignUsers, transferTeamMembers } from "../controllers/adminTeamController.js";
import { createStudent } from "../controllers/studentController.js";

test.before(async () => {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/crm";
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri);
  }
  // Clear any existing test data to ensure clean environment
  await User.deleteMany({ phone: { $regex: /^99990/ } });
  await Team.deleteMany({ name: { $regex: /^TestSdeTeam/ } });
  await Student.deleteMany({ customerName: { $regex: /^TestSdeStudent/ } });
  await UserTransferHistory.deleteMany({});
});

test.after(async () => {
  // Final cleanup
  await User.deleteMany({ phone: { $regex: /^99990/ } });
  await Team.deleteMany({ name: { $regex: /^TestSdeTeam/ } });
  await Student.deleteMany({ customerName: { $regex: /^TestSdeStudent/ } });
  await UserTransferHistory.deleteMany({});
  await mongoose.disconnect();
});

test("SDE Team Transfer - Historical Sales Ownership Persistence", async (t) => {
  let manager1Doc, manager2Doc, sdeDoc;
  let team1Doc, team2Doc;

  await t.test("Setup managers, SDE, and initial Team 1 membership", async () => {
    manager1Doc = await User.create({
      name: "TestSde Manager 1",
      phone: "9999011111",
      role: "Manager",
      designation: "Manager",
      passwordHash: "dummy"
    });

    manager2Doc = await User.create({
      name: "TestSde Manager 2",
      phone: "9999022222",
      role: "Manager",
      designation: "Manager",
      passwordHash: "dummy"
    });

    sdeDoc = await User.create({
      name: "TestSde Kavya",
      phone: "9999033333",
      role: "SDE",
      designation: "SDE",
      passwordHash: "dummy"
    });

    // Create Team 1 and add SDE as member
    team1Doc = await Team.create({
      name: "TestSdeTeam 1",
      manager: manager1Doc._id,
      members: [sdeDoc._id],
      status: "Active",
      createdBy: "System",
      updatedBy: "System"
    });

    // Create Team 2 (empty members initially)
    team2Doc = await Team.create({
      name: "TestSdeTeam 2",
      manager: manager2Doc._id,
      members: [],
      status: "Active",
      createdBy: "System",
      updatedBy: "System"
    });

    assert.ok(team1Doc._id);
    assert.ok(team2Doc._id);
  });

  let student1;
  await t.test("Create a sale (Student 1) while SDE is under Manager 1", async () => {
    // Mock request body & user
    const req = {
      body: {
        customerName: "TestSdeStudent 1",
        altContactNumber: "9999999991",
        courseFee: 50000,
        paidAmount: 10000,
      },
      user: {
        id: sdeDoc._id.toString(),
        name: sdeDoc.name,
        role: sdeDoc.role,
        designation: sdeDoc.designation,
      }
    };
    
    let responseData;
    const res = {
      status: (code) => {
        assert.strictEqual(code, 201);
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      }
    };

    await createStudent(req, res);

    assert.ok(responseData);
    student1 = responseData;
    assert.strictEqual(String(student1.createdById), sdeDoc._id.toString());
    assert.strictEqual(String(student1.reportedToId), manager1Doc._id.toString());
    assert.strictEqual(String(student1.teamId), team1Doc._id.toString());
    assert.strictEqual(student1.teamName, team1Doc.name);
    assert.ok(student1.assignmentTimestamp);
  });

  await t.test("Transfer SDE to Team 2 and verify UserTransferHistory is created", async () => {
    // Mock the admin request to assign SDE to Team 2
    const reqAssignTeam2 = {
      params: { id: team2Doc._id.toString() },
      body: { userIds: [sdeDoc._id.toString()] },
      user: { name: "System Admin", id: new mongoose.Types.ObjectId().toString() }
    };
    const resAssignTeam2 = {
      status: () => resAssignTeam2,
      json: () => resAssignTeam2
    };

    // Remove from Team 1
    const reqAssignTeam1 = {
      params: { id: team1Doc._id.toString() },
      body: { userIds: [] },
      user: { name: "System Admin", id: reqAssignTeam2.user.id }
    };
    const resAssignTeam1 = {
      status: () => resAssignTeam1,
      json: () => resAssignTeam1
    };

    // Simulate removing from Team 1 and adding to Team 2
    await assignUsers(reqAssignTeam1, resAssignTeam1);
    await assignUsers(reqAssignTeam2, resAssignTeam2);

    // Verify UserTransferHistory entry
    const histories = await UserTransferHistory.find({ userId: sdeDoc._id }).sort({ transferredAt: 1 }).lean();
    assert.ok(histories.length >= 2);
    
    // First entry: removed from Team 1 to No Team
    const first = histories[0];
    assert.strictEqual(String(first.fromTeamId), team1Doc._id.toString());
    assert.strictEqual(first.toTeamId, null);
    assert.strictEqual(String(first.fromManagerId), manager1Doc._id.toString());
    assert.strictEqual(first.toManagerId, null);

    // Second entry: added to Team 2
    const second = histories[1];
    assert.strictEqual(second.fromTeamId, null);
    assert.strictEqual(String(second.toTeamId), team2Doc._id.toString());
    assert.strictEqual(second.fromManagerId, null);
    assert.strictEqual(String(second.toManagerId), manager2Doc._id.toString());
  });

  let student2;
  await t.test("Create a sale (Student 2) after SDE is transferred under Manager 2", async () => {
    // SDE is now in Team 2
    const req = {
      body: {
        customerName: "TestSdeStudent 2",
        altContactNumber: "9999999992",
        courseFee: 60000,
        paidAmount: 20000,
      },
      user: {
        id: sdeDoc._id.toString(),
        name: sdeDoc.name,
        role: sdeDoc.role,
        designation: sdeDoc.designation,
      }
    };
    
    let responseData;
    const res = {
      status: (code) => {
        assert.strictEqual(code, 201);
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      }
    };

    await createStudent(req, res);

    assert.ok(responseData);
    student2 = responseData;
    assert.strictEqual(String(student2.createdById), sdeDoc._id.toString());
    assert.strictEqual(String(student2.reportedToId), manager2Doc._id.toString());
    assert.strictEqual(String(student2.teamId), team2Doc._id.toString());
    assert.strictEqual(student2.teamName, team2Doc.name);
    assert.ok(student2.assignmentTimestamp);
  });

  await t.test("Verify visibility filters for Manager 1 and Manager 2", async () => {
    const filterManager1 = await buildVisibilityFilter({
      id: manager1Doc._id.toString(),
      name: manager1Doc.name,
      role: manager1Doc.role,
      designation: manager1Doc.designation
    });

    const filterManager2 = await buildVisibilityFilter({
      id: manager2Doc._id.toString(),
      name: manager2Doc.name,
      role: manager2Doc.role,
      designation: manager2Doc.designation
    });

    // Query database with Manager 1's visibility filter
    const studentsForManager1 = await Student.find({
      customerName: { $regex: /^TestSdeStudent/ },
      ...filterManager1
    }).lean();

    // Query database with Manager 2's visibility filter
    const studentsForManager2 = await Student.find({
      customerName: { $regex: /^TestSdeStudent/ },
      ...filterManager2
    }).lean();

    // Manager 1 must see Student 1 (historical sale) but not Student 2
    assert.strictEqual(studentsForManager1.length, 1);
    assert.strictEqual(studentsForManager1[0].customerName, "TestSdeStudent 1");

    // Manager 2 must see Student 2 (new sale) but not Student 1
    assert.strictEqual(studentsForManager2.length, 1);
    assert.strictEqual(studentsForManager2[0].customerName, "TestSdeStudent 2");
  });
});
