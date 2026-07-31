import Module from "../models/Module.js";

function shapeModule(doc) {
  return {
    id: doc._id.toString(),
    key: doc.key,
    label: doc.label,
    parentKey: doc.parentKey || null,
    path: doc.path || "",
    icon: doc.icon || "",
    badgeKey: doc.badgeKey || null,
    order: doc.order,
    status: doc.status,
    actions: Array.isArray(doc.actions)
      ? doc.actions.map((action) => ({
          key: action.key,
          label: action.label,
          fields: Array.isArray(action.fields)
            ? action.fields.map((field) => ({
                key: field.key,
                name: field.name,
                type: field.type || "text",
              }))
            : [],
        }))
      : [],
    config: doc.config || {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function slugifyKey(value = "") {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function listModules(req, res) {
  const modules = await Module.find({ key: { $ne: "enrollments" } }).sort({ order: 1, createdAt: 1 }).lean();
  res.json({ modules: modules.map(shapeModule) });
}

export async function createModule(req, res) {
  const { label, parentKey, path, icon, badgeKey, order, status, actions, config } = req.body || {};
  if (!label || !String(label).trim()) {
    return res.status(400).json({ message: "Module label is required" });
  }
  const key = req.body?.key ? slugifyKey(req.body.key) : slugifyKey(label);
  if (!key) return res.status(400).json({ message: "Could not derive a module key from the label" });

  const existing = await Module.findOne({ key });
  if (existing) return res.status(409).json({ message: "A module with this key already exists" });

  const mod = await Module.create({
    key,
    label: String(label).trim(),
    parentKey: parentKey || null,
    path: path || "",
    icon: icon || "",
    badgeKey: badgeKey || null,
    order: Number.isFinite(order) ? order : 0,
    status: status === "Inactive" ? "Inactive" : "Active",
    actions: Array.isArray(actions) ? actions : [],
    config: config || {},
  });
  res.status(201).json({ module: shapeModule(mod) });
}

export async function updateModule(req, res) {
  const mod = await Module.findById(req.params.id);
  if (!mod) return res.status(404).json({ message: "Module not found" });

  const fields = ["label", "parentKey", "path", "icon", "badgeKey", "order", "status", "actions", "config"];
  for (const f of fields) {
    if (req.body?.[f] !== undefined) mod[f] = req.body[f];
  }
  await mod.save();
  res.json({ module: shapeModule(mod) });
}

export async function deleteModule(req, res) {
  const mod = await Module.findByIdAndDelete(req.params.id);
  if (!mod) return res.status(404).json({ message: "Module not found" });
  res.json({ ok: true });
}
