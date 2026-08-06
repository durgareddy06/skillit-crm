import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import Student from "./models/Student.js";
import Team from "./models/Team.js";
import Counter from "./models/Counter.js";
import Module from "./models/Module.js";
import Role from "./models/Role.js";
import { DEFAULT_MODULE_SEED } from "./utils/permissions.js";
import { ensureDefaultRoles } from "./utils/roles.js";
import { getAncestorManagerIds } from "./utils/hierarchy.js";
import ActivityLog from "./models/ActivityLog.js";

const normalizeName = (value = "") => String(value).trim().toLowerCase().replace(/[\s._-]+/g, "");

const LEGACY_DEMO_STUDENT_IDS = Array.from({ length: 9 }, (_, i) => `STU-${String(i + 1).padStart(4, "0")}`);
const LEGACY_DEMO_UNIQUE_IDS = Array.from({ length: 9 }, (_, i) => String(234567800 + i));

async function removeLegacyDemoStudents() {
  const result = await Student.deleteMany({
    $or: [
      { id: { $in: LEGACY_DEMO_STUDENT_IDS } },
      { uniqueId: { $in: LEGACY_DEMO_UNIQUE_IDS } },
    ],
  });

  if (result.deletedCount > 0) {
    console.log(`Removed ${result.deletedCount} legacy demo student(s).`);
  }
}

async function run() {
  await connectDB();

  console.log("Ensuring the Admin login exists (password: skillit@123)...");
  // Do not wipe existing collections here. Re-running the seed should not
  // destroy admin-created users, roles, or credentials.
  const adminPhone = "9998887766";
  const adminExists = await User.exists({ phone: adminPhone });
  if (!adminExists) {
    const passwordHash = await User.hashPassword("skillit@123");
    await User.create({
      name: "Admin",
      phone: adminPhone,
      role: "admin",
      status: "Active",
      createdBy: "System",
      updatedBy: "System",
      passwordHash,
    });
  }

  const moduleCount = await Module.countDocuments();
  if (moduleCount === 0) {
    console.log("Seeding the module registry (Admin can edit these afterwards via /api/admin/modules)...");
    await Module.insertMany(DEFAULT_MODULE_SEED);
  }

  const ticketCounterExists = await Counter.exists({ _id: "ticketId" });
  if (!ticketCounterExists) {
    console.log("Initializing ticketId counter to start at 8290...");
    await Counter.create({ _id: "ticketId", seq: 8290 });
  }

  // DO NOT delete legacy demo student IDs as they conflict with actual student IDs created under production sequences
  // await removeLegacyDemoStudents();

  console.log("Ensuring the default role list exists...");
  await ensureDefaultRoles();

  console.log("Backfilling roleId for any users still on the legacy name-matching path...");
  const activeRoles = await Role.find({ status: "Active" }).select("name").lean();
  const roleByNormalizedName = new Map(activeRoles.map((r) => [normalizeName(r.name), r._id]));
  const unmigrated = await User.find({
    role: { $ne: "admin" },
    $or: [{ roleId: { $exists: false } }, { roleId: null }],
  }).select("designation role");
  let migrated = 0;
  for (const u of unmigrated) {
    const match = roleByNormalizedName.get(normalizeName(u.designation)) || roleByNormalizedName.get(normalizeName(u.role));
    if (match) {
      u.roleId = match;
      await u.save();
      migrated += 1;
    }
  }
  if (migrated > 0) console.log(`  -> linked ${migrated} user(s) to their Role by matching name.`);
  if (unmigrated.length - migrated > 0) {
    console.log(
      `  -> ${unmigrated.length - migrated} user(s) could not be matched to any existing Role - their designation no longer matches a Role name. Re-assign their Role from Settings -> Users.`
    );
  }

  console.log("Backfilling reportingHierarchyIds for existing students...");
  const studentsToMigrate = await Student.find({
    $or: [
      { reportingHierarchyIds: { $exists: false } },
      { reportingHierarchyIds: null },
      { reportingHierarchyIds: { $size: 0 } },
    ]
  });

  let studentsMigrated = 0;
  for (const student of studentsToMigrate) {
    let hierarchyIds = [];
    if (student.reportedToId) {
      const ancestors = await getAncestorManagerIds(student.reportedToId);
      hierarchyIds = [new mongoose.Types.ObjectId(String(student.reportedToId)), ...ancestors];
    } else if (student.createdById) {
      hierarchyIds = await getAncestorManagerIds(student.createdById);
    }
    
    if (hierarchyIds.length > 0) {
      student.reportingHierarchyIds = hierarchyIds;
      await student.save();
      studentsMigrated += 1;
    }
  }
  if (studentsMigrated > 0) {
    console.log(`  -> backfilled reportingHierarchyIds for ${studentsMigrated} student(s).`);
  }

  console.log("Backfilling teamId, teamName, and assignmentTimestamp for existing students...");
  const studentsToBackfill = await Student.find({
    $or: [
      { teamId: { $exists: false } },
      { teamId: null },
      { assignmentTimestamp: { $exists: false } },
      { assignmentTimestamp: null }
    ]
  });

  let backfilledCount = 0;
  for (const student of studentsToBackfill) {
    let team = null;
    if (student.reportedToId) {
      team = await Team.findOne({ manager: student.reportedToId }).lean();
    }
    if (!team && student.createdById) {
      team = await Team.findOne({ members: student.createdById }).lean();
    }
    
    student.teamId = team?._id || null;
    student.teamName = team?.name || "No Team";
    student.assignmentTimestamp = student.createdAt ? new Date(student.createdAt) : new Date();
    await student.save();
    backfilledCount++;
  }
  if (backfilledCount > 0) {
    console.log(`  -> backfilled teamId/teamName/assignmentTimestamp for ${backfilledCount} student(s).`);
  }

  console.log("Backfilling ActivityLog entries for existing students...");
  const allStudents = await Student.find({}).lean();
  let logCount = 0;
  for (const s of allStudents) {
    const hasLogs = await ActivityLog.exists({ studentId: s._id });
    if (!hasLogs) {
      const logs = [];

      // 1. Student Created
      if (s.createdAt) {
        logs.push({
          studentId: s._id,
          studentUniqueId: s.id,
          userName: s.createdBy || "System",
          userRole: "SDE",
          action: "Student Created",
          details: {
            customerName: s.customerName,
            program: s.program || s.course,
            batch: s.batch,
            saleValue: s.saleValue
          },
          timestamp: s.createdAt ? new Date(s.createdAt) : new Date()
        });
      }

      // 2. Payment Links
      if (Array.isArray(s.paymentLinks)) {
        s.paymentLinks.forEach((link) => {
          logs.push({
            studentId: s._id,
            studentUniqueId: s.id,
            userName: link.generatedBy || s.sdeName || s.createdBy || "System",
            userRole: link.generatedBy ? "User" : "SDE",
            action: "Payment Link Generated",
            details: {
              amount: link.amount,
              linkId: link.linkId,
              url: link.url
            },
            timestamp: link.createdAt ? new Date(link.createdAt) : (s.createdAt ? new Date(s.createdAt) : new Date())
          });
        });
      }

      // 3. Payments
      if (Array.isArray(s.payments)) {
        s.payments.forEach((pay) => {
          logs.push({
            studentId: s._id,
            studentUniqueId: s.id,
            userName: pay.addedBy || s.sdeName || s.createdBy || "System",
            userRole: pay.addedBy ? "User" : "SDE",
            action: "Payment Added",
            details: {
              amount: pay.amount,
              mode: pay.mode || "Payment Link",
              refId: pay.refId
            },
            timestamp: pay.paidDate ? new Date(pay.paidDate) : (s.createdAt ? new Date(s.createdAt) : new Date())
          });
        });
      }

      // 4. Order Punched
      if (s.orderPunched && s.orderPunchedAt) {
        logs.push({
          studentId: s._id,
          studentUniqueId: s.id,
          userName: s.orderPunchedBy || s.sdeName || s.createdBy || "System",
          userRole: s.orderPunchedBy ? "User" : "SDE",
          action: "Order Punched",
          details: {
            course: s.course,
            batch: s.batch,
            saleValue: s.saleValue,
            paidAmount: s.paidAmount,
            outstanding: s.outstanding,
            demoDoneBy: s.demoDoneBy
          },
          timestamp: s.orderPunchedAt ? new Date(s.orderPunchedAt) : (s.createdAt ? new Date(s.createdAt) : new Date())
        });
      }

      // 5. Enrolled
      if (s.status === "Enrolled" && s.enrolledAt) {
        logs.push({
          studentId: s._id,
          studentUniqueId: s.id,
          userName: s.enrolledBy || s.sdeName || s.createdBy || "System",
          userRole: "SDE",
          action: "Student Enrolled",
          details: {
            course: s.course,
            batch: s.batch
          },
          timestamp: s.enrolledAt ? new Date(s.enrolledAt) : (s.createdAt ? new Date(s.createdAt) : new Date())
        });
      }

      // 6. Cancelled
      if (s.status === "Cancelled" && s.cancelledAt) {
        logs.push({
          studentId: s._id,
          studentUniqueId: s.id,
          userName: s.cancelledBy || s.manager || s.reportedTo || "System",
          userRole: s.cancelledBy ? "User" : "Manager",
          action: "Student Registration Cancelled",
          details: {
            remarks: s.internalRemarks
          },
          timestamp: s.cancelledAt ? new Date(s.cancelledAt) : (s.createdAt ? new Date(s.createdAt) : new Date())
        });
      }

      // 7. Dropped
      if (s.dropped && s.droppedAt) {
        logs.push({
          studentId: s._id,
          studentUniqueId: s.id,
          userName: s.droppedBy || s.manager || s.reportedTo || "System",
          userRole: s.droppedBy ? "User" : "Manager",
          action: "Student Dropped",
          details: {
            remarks: s.internalRemarks
          },
          timestamp: s.droppedAt ? new Date(s.droppedAt) : (s.createdAt ? new Date(s.createdAt) : new Date())
        });
      }

      // 8. MIS Approved
      if (s.misStatus === "approved" && s.misApprovedAt) {
        logs.push({
          studentId: s._id,
          studentUniqueId: s.id,
          userName: s.misApprovedBy || s.manager || s.reportedTo || "System",
          userRole: "MIS Executive",
          action: "MIS Approved",
          details: {
            remarks: s.internalRemarks
          },
          timestamp: s.misApprovedAt ? new Date(s.misApprovedAt) : (s.createdAt ? new Date(s.createdAt) : new Date())
        });
      }

      // 9. Onboarding Submitted
      if (s.onboardingSubmitted) {
        logs.push({
          studentId: s._id,
          studentUniqueId: s.id,
          userName: s.onboardingSubmittedBy || s.sdeName || s.createdBy || "System",
          userRole: "Customer Support Executive",
          action: "Onboarding Submitted",
          details: {
            comments: s.onboardingComments,
            onboardingDate: s.onboardingDate,
            verifications: (s.onboardingVerifications || []).map(v => `${v.item}: ${v.verified ? "Verified" : "Not Verified"}`)
          },
          timestamp: s.onboardingSubmittedAt ? new Date(s.onboardingSubmittedAt) : (s.onboardingDate ? new Date(s.onboardingDate) : (s.createdAt ? new Date(s.createdAt) : new Date()))
        });
      }

      // 10. Orientation Completed
      if (s.orientationCompleted) {
        logs.push({
          studentId: s._id,
          studentUniqueId: s.id,
          userName: s.orientationCompletedBy || s.sdeName || s.createdBy || "System",
          userRole: "Customer Support Executive",
          action: "Orientation Completed",
          details: {
            orientationDate: s.orientationDate,
            orientationLink: s.orientationLink,
            recordedLink: s.recordedLink,
            remarks: s.internalRemarks
          },
          timestamp: s.orientationCompletedAt ? new Date(s.orientationCompletedAt) : (s.orientationDate ? new Date(s.orientationDate) : (s.createdAt ? new Date(s.createdAt) : new Date()))
        });
      }

      // 11. Lead Transferred
      if (Array.isArray(s.transferHistory)) {
        s.transferHistory.forEach((t) => {
          logs.push({
            studentId: s._id,
            studentUniqueId: s.id,
            userName: t.transferredBy?.name || "System",
            userRole: "Manager",
            action: "Lead Transferred",
            details: {
              fromUser: t.fromUserId?.name || "Unassigned",
              toUser: t.toUserId?.name || "Unknown"
            },
            timestamp: t.transferredAt ? new Date(t.transferredAt) : (s.createdAt ? new Date(s.createdAt) : new Date())
          });
        });
      }

      // 12. Call Recordings
      if (Array.isArray(s.callRecordings)) {
        s.callRecordings.forEach((rec) => {
          logs.push({
            studentId: s._id,
            studentUniqueId: s.id,
            userName: rec.uploadedBy || "System",
            userRole: "SDE",
            action: "Call Recording Uploaded",
            details: {
              fileName: rec.fileName,
              url: rec.url
            },
            timestamp: rec.uploadedAt ? new Date(rec.uploadedAt) : (s.createdAt ? new Date(s.createdAt) : new Date())
          });
        });
      }

      if (logs.length > 0) {
        await ActivityLog.insertMany(logs);
        logCount += logs.length;
      }
    }
  }
  if (logCount > 0) {
    console.log(`  -> backfilled ${logCount} ActivityLog entries for existing students.`);
  }

  console.log("Done. Log in with phone 9998887766 + password: skillit@123");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
