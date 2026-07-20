import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import { MODULE_NAV } from "./config/menuConfig";
import { hasPermission } from "./lib/permissions";

const Login = lazy(() => import("./pages/Login"));
const StudentListPage = lazy(() => import("./pages/StudentListPage"));
const StudentCreatePage = lazy(() => import("./pages/StudentCreatePage"));
const StudentDetail = lazy(() => import("./pages/StudentDetail"));
const StudentFeeEditPage = lazy(() => import("./pages/StudentFeeEditPage"));
const StudentPunchOrderPage = lazy(() => import("./pages/StudentPunchOrderPage"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Orientation = lazy(() => import("./pages/Orientation"));
const Learners = lazy(() => import("./pages/Learners"));
const Tokens = lazy(() => import("./pages/Tokens"));
const Settings = lazy(() => import("./pages/Settings"));
const SupportDetailPage = lazy(() => import("./pages/SupportDetailPage"));

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/student" replace />;
  const firstAllowed = MODULE_NAV.find((item) => hasPermission(user, item.key, "read"));
  return <Navigate to={firstAllowed?.path || "/settings"} replace />;
}

function EnrolledRoute() {
  return <StudentListPage title="Enrolled" view="enrolled" emptyText="No one enrolled yet." />;
}

function EnrollmentQueueRoute() {
  return <StudentListPage title="Enrollments" view="enrollments" emptyText="No enrollments yet." />;
}

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<HomeRedirect />} />

          <Route path="/student" element={<StudentListPage title="Students" />} />
          <Route path="/student/new" element={<StudentCreatePage />} />
          <Route path="/payment-link" element={<StudentListPage title="Payment Link" view="payment-link" />} />
          <Route path="/payments" element={<StudentListPage title="Payments" view="payments" />} />
          <Route
            path="/booked-orders"
            element={<StudentListPage title="Booked Orders" view="booked-orders" emptyText="No orders punched yet." />}
          />
          <Route path="/pending" element={<StudentListPage title="Pending" view="pending" emptyText="Nothing pending." />} />
          <Route path="/enrolled" element={<EnrolledRoute />} />
          <Route path="/enrollments" element={<EnrollmentQueueRoute />} />
          <Route path="/cancelled" element={<StudentListPage title="Cancelled" view="cancelled" emptyText="No cancellations." />} />

          <Route
            path="/mis-approval"
            element={<StudentListPage title="MIS Approval" view="mis-approval" emptyText="Nothing waiting on MIS approval." />}
          />
          <Route
            path="/approved"
            element={
              <StudentListPage
                title="Approved"
                view="approved"
                subtitle="Approved and handed to Customer Support"
                emptyText="Nothing approved yet."
              />
            }
          />

          <Route path="/student/:id" element={<StudentDetail />} />
          <Route path="/student/:id/edit-fee-components" element={<StudentFeeEditPage />} />
          <Route path="/student/:id/punch-order" element={<StudentPunchOrderPage />} />

          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/onboarding/:id" element={<SupportDetailPage mode="onboarding" />} />
          <Route path="/orientation" element={<Orientation />} />
          <Route path="/orientation/:id" element={<SupportDetailPage mode="orientation" />} />
          <Route path="/learners" element={<Learners />} />
          <Route path="/learners/:id" element={<SupportDetailPage mode="learners" />} />
          <Route path="/tokens" element={<Tokens />} />

          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
