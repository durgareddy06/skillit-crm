import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import User from "./models/User.js";
import Student from "./models/Student.js";
import Counter from "./models/Counter.js";
import Module from "./models/Module.js";
import Role from "./models/Role.js";
import { DEFAULT_MODULE_SEED } from "./utils/permissions.js";
import { ensureDefaultRoles } from "./utils/roles.js";
import { getAncestorManagerIds } from "./utils/hierarchy.js";

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

  await removeLegacyDemoStudents();

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

  console.log("Done. Log in with phone 9998887766 + password: skillit@123");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
