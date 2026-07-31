// Route/label/icon metadata for every module the sidebar can show.
// This is NOT permission logic — it's just "what page does module X open".
// Which of these actually show up for a given user is decided entirely by
// that user's (database-driven) permissions: see Sidebar.jsx, which keeps
// only the items the user has "read" access to, in this order.
//
// Adding a brand-new module still requires a matching page/route (the UI
// is locked), but no role/permission code anywhere needs to change to
// assign an existing module to a new role — that's fully Admin/DB driven.
export const MODULE_NAV = [
  { key: "student", label: "Student", path: "/student", icon: "student", badgeKey: "student" },
  { key: "payment-link", label: "Payment Link", path: "/payment-link", icon: "paymentLink", badgeKey: "payment-link" },
  { key: "payments", label: "Payments", path: "/payments", icon: "payments", badgeKey: "payments" },
  { key: "booked-orders", label: "Booked Orders", path: "/booked-orders", icon: "bookedOrders", badgeKey: "booked-orders" },
  { key: "pending", label: "Pending", path: "/pending", icon: "pending", badgeKey: "pending" },
  { key: "enrolled", label: "Enrollments", path: "/enrollments", icon: "enrolled", badgeKey: "enrolled" },
  { key: "mis-approval", label: "MIS Approval", path: "/mis-approval", icon: "misApproval", badgeKey: "mis-approval" },
  { key: "approved", label: "Approved", path: "/approved", icon: "approved", badgeKey: "approved" },
  { key: "cancelled", label: "Cancelled", path: "/cancelled", icon: "cancelled", badgeKey: "cancelled" },
  { key: "onboarding", label: "Onboarding", path: "/onboarding", icon: "onboarding", badgeKey: "onboarding" },
  { key: "orientation", label: "Orientation", path: "/orientation", icon: "orientation", badgeKey: "orientation" },
  { key: "learners", label: "Learners", path: "/learners", icon: "learners", badgeKey: "learners" },
  { key: "tokens", label: "Tokens", path: "/tokens", icon: "tokens", badgeKey: "tokens" },
];
