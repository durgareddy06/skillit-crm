import { Users, UsersRound, ShieldCheck, Home, Archive } from "lucide-react";

const slugify = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Text", helper: "Characters only" },
  { value: "number", label: "Number", helper: "Numbers only" },
  { value: "string", label: "String", helper: "Letters and Numbers" },
];

export const SETTINGS_SECTIONS = [
  { key: "users", label: "Manage Users", icon: Users },
  { key: "teams", label: "Manage Teams", icon: UsersRound },
  { key: "roles", label: "Manage Roles", icon: ShieldCheck },
  { key: "archive", label: "Archive", icon: Archive },
];

export const SETTINGS_HOME_ICON = Home;

const makeOption = (label = "") => ({
  key: slugify(label),
  label: String(label).trim(),
});

const makeField = (name = "", type = "text", required = false) => ({
  key: slugify(name),
  name: String(name).trim(),
  type,
  required: Boolean(required),
});

const makeSection = (label = "", itemType = "options", items = []) => ({
  key: slugify(label),
  label: String(label).trim(),
  itemType,
  items,
});

const DEFAULT_STUDENT_FORMS = [
  makeSection("Add New Student", "fields", [
    makeField("Student Name", "text", true),
    makeField("Parent Name", "text", true),
    makeField("Student Email", "text", true),
    makeField("Student Phone", "text", true),
    makeField("Alternative Number", "text", true),
    makeField("Batch", "text", true),
    makeField("Program", "text", true),
    makeField("Category", "text", true),
    makeField("Course Fee", "number", true),
  ]),
  makeSection("Edit Student", "fields", []),
  makeSection("Add Payment", "fields", [
    makeField("Mode of Payment", "text", true),
    makeField("Amount", "number", true),
    makeField("Loan ID", "text", false),
    makeField("Transaction Date", "text", true),
  ]),
  makeSection("Punch Order", "fields", [
    makeField("Category", "text", true),
    makeField("Batch", "text", true),
    makeField("Course", "text", true),
    makeField("Payment Mode", "text", true),
    makeField("Lead Source", "text", true),
  ]),
];

const DEFAULT_STUDENT_DROPDOWNS = [
  makeSection("Category", "options", ["Fresher", "Working Professional", "Career Break", "Student", "Other"].map(makeOption)),
  makeSection("Course", "options", [
    "Data Science and Data Analytics (DADS)",
    "Full Stack Development (FSD)",
    "UI/UX Design",
  ].map(makeOption)),
  makeSection("Program", "options", [
    "Data Science and Data Analytics",
    "Full Stack Development (FSD)",
    "UI/UX Design",
  ].map(makeOption)),
  makeSection("Batch", "options", ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8"].map(makeOption)),
  makeSection("Payment Mode", "options", ["Payment Link", "Cash", "Bank Transfer", "UPI", "Cheque", "EMI", "DD (Demand Draft)"].map(makeOption)),
  makeSection("Lead Source", "options", ["Website", "Referral", "Social Media", "Walk-in", "Email Campaign", "Other"].map(makeOption)),
];

const DEFAULT_STUDENT_FILTERS = [];

export const MODULE_CONFIG_TEMPLATES = {
  student: {
    forms: DEFAULT_STUDENT_FORMS,
    dropdowns: DEFAULT_STUDENT_DROPDOWNS,
    filters: DEFAULT_STUDENT_FILTERS,
    verifications: [],
  },
  "payment-link": {
    forms: [
      makeSection("Create Payment Link", "fields", [
        makeField("Amount", "number", true),
      ]),
    ],
    dropdowns: [
      makeSection("Payment Mode", "options", ["Payment Link", "Cash", "Bank Transfer", "UPI", "Cheque", "EMI"].map(makeOption)),
    ],
    filters: [],
    verifications: [],
  },
  payments: {
    forms: [
      makeSection("Add Payment", "fields", [
        makeField("Mode of Payment", "text", true),
        makeField("Amount", "number", true),
      ]),
    ],
    dropdowns: [
      makeSection("Payment Mode", "options", ["Cash", "Cashfree", "JoPay"].map(makeOption)),
    ],
    filters: [],
    verifications: [],
  },
  "booked-orders": { forms: [], dropdowns: [], filters: [makeSection("Filters", "options", [])], verifications: [] },
  pending: { forms: [], dropdowns: [], filters: [makeSection("Filters", "options", [])], verifications: [] },
  enrolled: { forms: [], dropdowns: [], filters: [makeSection("Filters", "options", [])], verifications: [] },
  "mis-approval": { forms: [], dropdowns: [], filters: [makeSection("Filters", "options", [])], verifications: [] },
  approved: { forms: [], dropdowns: [], filters: [makeSection("Filters", "options", [])], verifications: [] },
  cancelled: { forms: [], dropdowns: [], filters: [makeSection("Filters", "options", [])], verifications: [] },
  onboarding: {
    forms: [
      makeSection("Onboarding Details", "fields", [
        makeField("Onboarding Date", "text", true),
        makeField("Call Recording Upload", "text", false),
      ]),
    ],
    dropdowns: [],
    filters: [],
    verifications: [
      makeSection("Verification", "checks", ["Course Duration Verified", "Payment Details Verified", "Job Assistance Opt-in"].map(makeOption)),
    ],
  },
  orientation: {
    forms: [
      makeSection("Orientation Details", "fields", [
        makeField("Orientation Date", "text", false),
        makeField("Orientation Link", "text", false),
        makeField("Recorded Link", "text", false),
        makeField("Internal Remarks", "text", false),
      ]),
    ],
    dropdowns: [],
    filters: [],
    verifications: [],
  },
  learners: { forms: [], dropdowns: [], filters: [], verifications: [] },
  tokens: { forms: [], dropdowns: [], filters: [], verifications: [] },
};

function cloneSection(section = {}) {
  return {
    key: section.key || slugify(section.label),
    label: section.label || section.key || "",
    itemType: section.itemType || "options",
    items: Array.isArray(section.items)
      ? section.items.map((item) => {
          if (typeof item === "string") return makeOption(item);
          if (section.itemType === "fields") {
            return {
              key: item.key || slugify(item.name),
              name: item.name || item.label || "",
              type: item.type || "text",
              required: Boolean(item.required),
            };
          }
          return makeOption(item.label || item.name || item.key || "");
        })
      : [],
  };
}

export function getModuleConfigTemplate(moduleKey = "", moduleLabel = "") {
  const template = MODULE_CONFIG_TEMPLATES[slugify(moduleKey)] || MODULE_CONFIG_TEMPLATES[slugify(moduleLabel)];
  const base = template || { forms: [], dropdowns: [], filters: [], verifications: [] };
  return {
    forms: (base.forms || []).map(cloneSection),
    dropdowns: (base.dropdowns || []).map(cloneSection),
    filters: (base.filters || []).map(cloneSection),
    verifications: (base.verifications || []).map(cloneSection),
  };
}

export function cloneModuleConfig(config = {}, moduleKey = "", moduleLabel = "") {
  const template = getModuleConfigTemplate(moduleKey, moduleLabel);
  const source = config && typeof config === "object" ? config : {};
  return {
    forms: Array.isArray(source.forms) && source.forms.length ? source.forms.map(cloneSection) : template.forms,
    dropdowns: Array.isArray(source.dropdowns) && source.dropdowns.length ? source.dropdowns.map(cloneSection) : template.dropdowns,
    filters: Array.isArray(source.filters) && source.filters.length ? source.filters.map(cloneSection) : template.filters,
    verifications: Array.isArray(source.verifications) && source.verifications.length ? source.verifications.map(cloneSection) : template.verifications,
  };
}

export function findConfigSection(sections = [], identifier = "") {
  const needle = slugify(identifier);
  return (Array.isArray(sections) ? sections : []).find((section) => slugify(section?.key || section?.label) === needle) || null;
}

export function getOptionLabels(section, fallback = []) {
  const items = Array.isArray(section?.items) ? section.items : [];
  return items.map((item) => item?.label || item?.name || "").filter(Boolean);
}

export function getFieldItems(section, fallback = []) {
  const items = Array.isArray(section?.items) ? section.items : [];
  return items.length ? items : fallback;
}

export const MODULE_ACTION_TEMPLATES = {
  student: [
    { key: "create-student", label: "Add New Student", fields: [] },
    { key: "edit-student", label: "Edit Student", fields: [] },
    { key: "view-student", label: "View Student", fields: [] },
    { key: "generate-payment-link", label: "Create Payment Link", fields: [] },
    { key: "add-payment", label: "Add Payment", fields: [] },
    { key: "punch-order", label: "Punch Order", fields: [] },
    { key: "transfer-lead", label: "Transfer Lead", fields: [] },
    { key: "drop-student", label: "Drop Student", fields: [] },
  ],
  "payment-link": [
    { key: "generate-payment-link", label: "Generate Payment Link", fields: [] },
    { key: "add-payment", label: "Add Payment", fields: [] },
    { key: "punch-order", label: "Punch Order", fields: [] },
  ],
  payments: [
    { key: "add-payment", label: "Add Payment", fields: [] },
    { key: "view-payments", label: "View Payments", fields: [] },
  ],
  "booked-orders": [
    { key: "create-booked-order", label: "Create Booked Order", fields: [] },
    { key: "view-booked-order", label: "View Booked Order", fields: [] },
  ],
  pending: [
    { key: "enroll-student", label: "Enroll Student", fields: [] },
    { key: "cancel-student", label: "Cancel Student", fields: [] },
    { key: "view-pending", label: "View Pending Student", fields: [] },
  ],
  enrolled: [
    { key: "view-enrolled", label: "View Enrolled Student", fields: [] },
    { key: "edit-student", label: "Edit Student", fields: [] },
  ],
  "mis-approval": [
    { key: "mis-approve", label: "Approve MIS", fields: [] },
    { key: "mis-escalate", label: "Escalate MIS", fields: [] },
  ],
  approved: [
    { key: "view-approved", label: "View Approved Student", fields: [] },
    { key: "edit-student", label: "Edit Student", fields: [] },
  ],
  cancelled: [
    { key: "view-cancelled", label: "View Cancelled Student", fields: [] },
    { key: "restore-student", label: "Restore Student", fields: [] },
  ],
  onboarding: [
    { key: "submit-onboarding", label: "Submit Onboarding", fields: [] },
    { key: "view-onboarding", label: "View Onboarding", fields: [] },
  ],
  orientation: [
    { key: "complete-orientation", label: "Complete Orientation", fields: [] },
    { key: "view-orientation", label: "View Orientation", fields: [] },
  ],
  learners: [
    { key: "view-learners", label: "View Learners", fields: [] },
    { key: "edit-learner", label: "Edit Learner", fields: [] },
  ],
  tokens: [
    { key: "view-tokens", label: "View Tokens", fields: [] },
    { key: "edit-tokens", label: "Edit Tokens", fields: [] },
  ],
};

export function getModuleTemplateActions(moduleKey = "", moduleLabel = "") {
  const template = MODULE_ACTION_TEMPLATES[slugify(moduleKey)] || MODULE_ACTION_TEMPLATES[slugify(moduleLabel)];
  return Array.isArray(template) ? template.map((action) => ({
    key: action.key,
    label: action.label,
    fields: Array.isArray(action.fields) ? action.fields.map((field) => ({ ...field })) : [],
  })) : [];
}

export function slugifySettingsKey(value = "") {
  return slugify(value);
}

export function cloneActions(actions = []) {
  return (Array.isArray(actions) ? actions : []).map((action) => ({
    key: action.key || slugify(action.label),
    label: action.label || action.key || "",
    fields: Array.isArray(action.fields)
      ? action.fields.map((field) => ({
          key: field.key || slugify(field.name),
          name: field.name || field.key || "",
          type: field.type || "text",
        }))
      : [],
  }));
}
