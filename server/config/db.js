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

async function cleanupLegacyPaymentIndexes() {
  try {
    const collection = mongoose.connection.collection("paymenttransactions");
    const indexes = await collection.indexes();
    for (const index of indexes) {
      const keys = Object.keys(index.key);
      const hasConflictField = keys.includes("orderId") || keys.includes("razorpayPaymentLinkId") || keys.includes("paymentId");
      if (index.unique && hasConflictField) {
        console.log(`Dropping unique index ${index.name} on paymenttransactions to prevent duplicate key errors...`);
        await collection.dropIndex(index.name);
        console.log(`Successfully dropped unique index ${index.name}.`);
      }
    }
  } catch (err) {
    console.warn("Could not cleanup legacy payment indexes dynamically:", err.message);
  }
}

export async function connectDB() {
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/skillit-fbcrm";
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(uri);
    console.log(`MongoDB connected → ${uri}`);
    await cleanupLegacyRoleIndexes();
    await cleanupLegacyPaymentIndexes();
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
    console.error("Is MongoDB running locally, or is MONGO_URI set correctly in server/.env?");
    process.exit(1);
  }
}
