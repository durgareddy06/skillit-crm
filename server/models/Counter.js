import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

export async function nextStudentId() {
  const counter = await Counter.findByIdAndUpdate(
    "studentId",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `STU-${String(counter.seq).padStart(4, "0")}`;
}

export async function nextTicketId() {
  const counter = await Counter.findByIdAndUpdate(
    "ticketId",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `TKT-${String(counter.seq).padStart(4, "0")}`;
}

export default Counter;
