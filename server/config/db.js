import mongoose from "mongoose";

async function cleanupLegacyRoleIndexes() {
  try {
    await mongoose.connection.collection("roles").dropIndex("slug_1");
    console.log("Removed legacy roles.slug index to allow role creation to persist.");
  } catch (err) {
    if (err?.codeName !== "IndexNotFound") {
      console.warn("Could not remove legacy roles.slug index:", err.message);
    }
  }
}

export async function connectDB() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/skillit-fbcrm";
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(uri);
    console.log(`MongoDB connected → ${uri}`);
    await cleanupLegacyRoleIndexes();
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    console.error("Is MongoDB running locally, or is MONGO_URI set correctly in server/.env?");
    process.exit(1);
  }
}
