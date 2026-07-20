// Mock rows so every screen renders real-looking data out of the box.
// Replace calls to `getStudents()` etc. with the equivalent `api.get(...)`
// call once the backend endpoints exist — the shape below is what the
// tables/detail page already expect.

const names = [
  // Removed demo-specific names; keep an empty list so UI falls back
  // to real backend data in production. Add names here only for local
  // development mocks when needed.
];

const courses = ["DADS-B8", "Full Stack Development", "Data Science and Data Analytics", "UI/UX Design"];

function makeId(prefix, i) {
  return `${prefix}-${String(i).padStart(4, "0")}`;
}

export function getStudents(count = 0) {
  // Return an empty array by default so the app shows real data from the
  // backend. For local development, pass a positive `count` and populate
  // `names` above with desired mock entries.
  if (!count || names.length === 0) return [];
  return Array.from({ length: count }).map((_, i) => ({
    id: makeId("STU", i + 1),
    customerName: names[i % names.length],
    date: "09-06-2026",
    month: "JUN-26",
    cycle: 1,
    course: courses[i % courses.length],
    contactNumber: "+91 98765 432" + String(10 + (i % 90)),
    sdeName: i % 2 === 0 ? "Dhanusree" : "Ilaa",
    manager: "Vieeth",
    saleValue: 70000,
    paidAmount: [5000, 40000, 70000][i % 3],
    outstanding: 70000 - [5000, 40000, 70000][i % 3],
    email: `${names[i % names.length].split(" ")[0].toLowerCase()}${i}@gmail.com`,
    program: "Data Science and Data Analytics",
    status: ["Pending", "Enrolled", "Cancelled"][i % 3],
  }));
}

export function getStudentById(id) {
  const list = getStudents(60);
  return list.find((s) => s.id === id) || list[0];
}

export function getPayments(studentSeed) {
  return [
    { paidDate: "03-06-2026", amount: 5000, product: "Jobo Pay", mode: "Payment Link", refId: "pay_1234567" },
    { paidDate: "05-06-2026", amount: 35000, product: "Jobo Pay", mode: "Payment Link", refId: "pay_1234568" },
    { paidDate: "08-06-2026", amount: 30000, product: "Jobo Pay", mode: "Payment Link", refId: "pay_1234569" },
  ];
}

export function getActivityTimeline() {
  return [
    { title: "Student created", by: "Ranadheer", at: "03 Jun 2026 - 11:43PM", detail: "Program: Data Science Master's Program · Batch B7" },
    { title: "Payment link generated", by: "Ranadheer", at: "04 Jun 2026 - 11:43PM", detail: "Amount ₹5,000 · Status: Paid" },
    { title: "Payment added", by: "Ranadheer", at: "12 Jun 2026 - 11:43PM", detail: "₹25,000 received via Cash" },
    { title: "Order punched", by: "Ranadheer", at: "13 Jun 2026 - 11:43PM", detail: "Booked order created" },
    { title: "Enrolled", by: "Pavan", at: "14 Jun 2026 - 09:10AM", detail: "Moved to Enrolled queue" },
    { title: "MIS approved", by: "Ranadheer", at: "15 Jun 2026 - 04:22PM", detail: "Approved with no remarks" },
    { title: "Onboarding submitted", by: "Divya", at: "16 Jun 2026 - 01:05PM", detail: "Verification checklist completed" },
    { title: "Orientation completed", by: "Divya", at: "18 Jun 2026 - 10:30AM", detail: "Recording uploaded" },
  ];
}

export function getTickets() {
  const subjects = ["Course Enrollment Failure", "Portal Login Issue", "Missing Transcript Data", "Password Reset Loop"];
  const priorities = ["High", "Medium", "Low", "High"];
  const statuses = ["In Progress", "Active", "Resolved", "Closed"];
  return subjects.map((s, i) => ({
    id: `TKT-${8291 + i}`,
    student: names[i],
    subject: s,
    priority: priorities[i],
    status: statuses[i],
    created: `${i + 1}h ago`,
  }));
}

export const tokenStats = {
  total: 1284,
  today: 42,
  pending: 156,
  resolved: 892,
  csat: 94,
};

export const dashboardCounts = {
  pending: 120,
  enrolled: 65,
  cancelled: 12,
};
