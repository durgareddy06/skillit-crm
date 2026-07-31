import mongoose from "mongoose";

// The single source of truth for "what modules exist in the system".
// Admin manages these rows (via /api/admin/modules). Roles never hardcode
// module lists — they simply reference a module's `key`. Adding a new
// module here (and giving it a matching frontend route) is the only way
// to introduce a new module; nothing about roles/permissions needs to
// change in code for it to become assignable.
const moduleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    label: { type: String, required: true, trim: true },
    parentKey: { type: String, default: null },
    // Optional presentation metadata used by the (locked) frontend nav —
    // purely cosmetic, never used for authorization decisions.
    path: { type: String, default: "" },
    icon: { type: String, default: "" },
    badgeKey: { type: String, default: null },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    actions: {
      type: [
        {
          key: { type: String, required: true, trim: true },
          label: { type: String, required: true, trim: true },
          fields: {
            type: [
              {
                key: { type: String, required: true, trim: true },
                name: { type: String, required: true, trim: true },
                type: { type: String, enum: ["text", "number", "string"], default: "text" },
              },
            ],
            default: [],
          },
        },
      ],
      default: [],
    },
    config: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

export default mongoose.model("Module", moduleSchema);
