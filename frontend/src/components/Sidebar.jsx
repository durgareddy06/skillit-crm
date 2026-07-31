import React, { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  GraduationCap,
  Link2,
  CreditCard,
  PackageCheck,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  BadgeCheck,
  UserPlus,
  Video,
  Users,
  Ticket,
  Settings as SettingsIcon,
  Power,
} from "lucide-react";
import io from "socket.io-client";
import { MODULE_NAV } from "../config/menuConfig";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../lib/permissions";
import { getStudentSummary } from "../api/students";
import { getTicketSummary } from "../api/tickets";
import { SETTINGS_SECTIONS } from "../config/settingsWorkspace";

// Exact icon components, keyed the same way as menuConfig.js — no <img> placeholders.
const ICONS = {
  student: GraduationCap,
  paymentLink: Link2,
  payments: CreditCard,
  bookedOrders: PackageCheck,
  pending: Clock,
  enrolled: CheckCircle2,
  cancelled: XCircle,
  misApproval: ShieldCheck,
  approved: BadgeCheck,
  onboarding: UserPlus,
  orientation: Video,
  learners: Users,
  tokens: Ticket,
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const items = isSettingsRoute ? [] : MODULE_NAV.filter((item) => hasPermission(user, item.key, "read"));
  const settingsSection = new URLSearchParams(location.search).get("section") || "users";
  const [dashboardCounts, setDashboardCounts] = useState({});
  const context = new URLSearchParams(location.search).get("context");
  const paymentLinkContext = context === "payment-link";
  const paymentsContext = context === "payments";
  const bookedOrdersContext = context === "booked-orders";
  const pendingContext = context === "pending";
  const enrolledContext = context === "enrolled";
  const cancelledContext = context === "cancelled";
  const misApprovalContext = context === "mis-approval";
  const approvedContext = context === "approved";
  const onboardingDetail = location.pathname.startsWith("/onboarding/");
  const orientationDetail = location.pathname.startsWith("/orientation/");
  const learnersDetail = location.pathname.startsWith("/learners/");
  const tokensDetail = location.pathname.startsWith("/tokens/");
  const moduleContext = paymentLinkContext || paymentsContext || bookedOrdersContext || pendingContext || enrolledContext || cancelledContext || misApprovalContext || approvedContext || onboardingDetail || orientationDetail || learnersDetail || tokensDetail;

  const socketRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const wsUrl = import.meta.env.VITE_WS_URL || "http://localhost:4000";

    // Reuse existing socket if it's still connected
    if (!socketRef.current || socketRef.current.disconnected) {
      socketRef.current = io(wsUrl);
    }
    const socket = socketRef.current;

    async function refreshCounts() {
      // Debounce: cancel any pending refresh and schedule a new one after 500ms
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const canReadTokens = hasPermission(user, "tokens", "read");
        const canReadStudents = MODULE_NAV.some((item) => hasPermission(user, item.key, "read") && item.key !== "tokens");

        const [studentResult, ticketResult] = await Promise.allSettled([
          canReadStudents ? getStudentSummary({ signal: controller.signal }) : Promise.resolve({}),
          canReadTokens ? getTicketSummary({ signal: controller.signal }) : Promise.resolve({ total: 0 }),
        ]);

        if (!alive) return;

        if (studentResult.status === "fulfilled" || ticketResult.status === "fulfilled") {
          setDashboardCounts((prev) => ({
            student: studentResult.status === "fulfilled" ? studentResult.value?.["student"] || 0 : prev.student || 0,
            "payment-link": studentResult.status === "fulfilled" ? studentResult.value?.["payment-link"] || 0 : prev["payment-link"] || 0,
            payments: studentResult.status === "fulfilled" ? studentResult.value?.payments || 0 : prev.payments || 0,
            "booked-orders": studentResult.status === "fulfilled" ? studentResult.value?.["booked-orders"] || 0 : prev["booked-orders"] || 0,
            pending: studentResult.status === "fulfilled" ? studentResult.value?.pending || 0 : prev.pending || 0,
            enrolled: studentResult.status === "fulfilled" ? studentResult.value?.enrolled || 0 : prev.enrolled || 0,
            "mis-approval": studentResult.status === "fulfilled" ? studentResult.value?.["mis-approval"] || 0 : prev["mis-approval"] || 0,
            approved: studentResult.status === "fulfilled" ? studentResult.value?.approved || 0 : prev.approved || 0,
            cancelled: studentResult.status === "fulfilled" ? studentResult.value?.cancelled || 0 : prev.cancelled || 0,
            onboarding: studentResult.status === "fulfilled" ? studentResult.value?.onboarding || 0 : prev.onboarding || 0,
            orientation: studentResult.status === "fulfilled" ? studentResult.value?.orientation || 0 : prev.orientation || 0,
            learners: studentResult.status === "fulfilled" ? studentResult.value?.learners || 0 : prev.learners || 0,
            tokens: ticketResult.status === "fulfilled" ? ticketResult.value?.total || 0 : prev.tokens || 0,
          }));
        }
      }, 500);
    }

    refreshCounts();

    socket.on("connect", () => {
      // Keep counts fresh when backend data changes.
      refreshCounts();
    });

    socket.on("student-updated", refreshCounts);
    socket.on("payment-success", refreshCounts);
    socket.on("payment-refunded", refreshCounts);
    socket.on("ticket-created", refreshCounts);
    socket.on("ticket-assigned", refreshCounts);
    socket.on("ticket-resolved", refreshCounts);
    socket.on("ticket-updated", refreshCounts);

    return () => {
      alive = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      controller.abort();
      socket.off("connect");
      socket.off("student-updated", refreshCounts);
      socket.off("payment-success", refreshCounts);
      socket.off("payment-refunded", refreshCounts);
      socket.off("ticket-created", refreshCounts);
      socket.off("ticket-assigned", refreshCounts);
      socket.off("ticket-resolved", refreshCounts);
      socket.off("ticket-updated", refreshCounts);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return (
    <aside className="hidden md:flex md:w-64 shrink-0 flex-col bg-white border-r border-slate-200 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center border-b border-slate-100 px-5 pt-5 pb-3">
        <img
          src="/skillit_logo.svg"
          alt="SkillIT Academy"
          className="h-[75px] w-auto object-contain"
        />
      </div>

      {/* Role badge */}
      <div className="px-5 pt-4">
        <span className="inline-block text-xs font-medium text-skillit bg-blue-50 px-2.5 py-1 rounded-full">
          {user?.role === "admin" ? "Admin" : user?.designation || "Team"}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {isSettingsRoute ? (
          <>
            <div className="px-2 pb-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Settings Menu</p>
            </div>
            {SETTINGS_SECTIONS.map((section) => {
              const active = settingsSection === section.key;
              const Icon = section.icon || SettingsIcon;
              return (
                <NavLink
                  key={section.key}
                  to={`/settings?section=${section.key}`}
                  className={[
                    "group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                    "transition-all duration-200 ease-out",
                    active ? "bg-skillit text-white shadow-pop translate-x-0.5" : "text-slate-600 hover:bg-slate-100 hover:translate-x-0.5",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-3">
                    <Icon
                      className={[
                        "h-[18px] w-[18px] transition-transform duration-200",
                        active ? "scale-110" : "text-slate-400 group-hover:scale-110 group-hover:text-skillit",
                      ].join(" ")}
                      strokeWidth={2}
                    />
                    {section.label}
                  </span>
                </NavLink>
              );
            })}
          </>
        ) : (
          items.map((item) => {
            const Icon = ICONS[item.icon] || GraduationCap;
            const isPaymentLinkDetail = item.key === "payment-link" && location.pathname.startsWith("/student") && paymentLinkContext;
            const isPaymentsDetail = item.key === "payments" && location.pathname.startsWith("/student") && paymentsContext;
            const isBookedOrdersDetail = item.key === "booked-orders" && location.pathname.startsWith("/student") && bookedOrdersContext;
            const isPendingDetail = item.key === "pending" && location.pathname.startsWith("/student") && pendingContext;
            const isEnrolledDetail = item.key === "enrolled" && location.pathname.startsWith("/student") && enrolledContext;
            const isCancelledDetail = item.key === "cancelled" && location.pathname.startsWith("/student") && cancelledContext;
            const isMisApprovalDetail = item.key === "mis-approval" && location.pathname.startsWith("/student") && misApprovalContext;
            const isApprovedDetail = item.key === "approved" && location.pathname.startsWith("/student") && approvedContext;
            const isStudentDetail = item.key === "student" && location.pathname.startsWith("/student") && !moduleContext;
            const isOnboardingDetail = item.key === "onboarding" && onboardingDetail;
            const isOrientationDetail = item.key === "orientation" && orientationDetail;
            const isLearnersDetail = item.key === "learners" && learnersDetail;
            const isTokensDetail = item.key === "tokens" && tokensDetail;
            const isRouteActive =
              item.key === "payment-link"
                ? location.pathname === "/payment-link" || isPaymentLinkDetail
                : item.key === "payments"
                  ? location.pathname === "/payments" || isPaymentsDetail
                  : item.key === "booked-orders"
                    ? location.pathname === "/booked-orders" || isBookedOrdersDetail
                    : item.key === "pending"
                      ? location.pathname === "/pending" || isPendingDetail
                      : item.key === "enrolled"
                        ? location.pathname === "/enrollments" || isEnrolledDetail
                        : item.key === "cancelled"
                          ? location.pathname === "/cancelled" || isCancelledDetail
                          : item.key === "mis-approval"
                            ? location.pathname === "/mis-approval" || isMisApprovalDetail
                            : item.key === "approved"
                              ? location.pathname === "/approved" || isApprovedDetail
                              : item.key === "student"
                                ? location.pathname === "/student" || isStudentDetail
                                : item.key === "onboarding"
                                  ? location.pathname === "/onboarding" || isOnboardingDetail
                                  : item.key === "orientation"
                                    ? location.pathname === "/orientation" || isOrientationDetail
                                    : item.key === "learners"
                                      ? location.pathname === "/learners" || isLearnersDetail
                                      : item.key === "tokens"
                                        ? location.pathname === "/tokens" || isTokensDetail
                                        : location.pathname === item.path;
            const useCustomActive = item.key === "student" || item.key === "payment-link" || item.key === "payments" || item.key === "onboarding" || item.key === "orientation" || item.key === "learners" || item.key === "tokens";
            return (
              <NavLink
                key={item.key}
                to={item.path}
                className={({ isActive }) =>
                  [
                    "group flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                    "transition-all duration-200 ease-out",
                    (isRouteActive || (!useCustomActive && isActive))
                      ? "bg-skillit text-white shadow-pop translate-x-0.5"
                      : "text-slate-600 hover:bg-slate-100 hover:translate-x-0.5",
                  ].join(" ")
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="flex items-center gap-3">
                      <Icon
                        className={[
                          "h-[18px] w-[18px] transition-transform duration-200",
                          (isRouteActive || (!useCustomActive && isActive))
                            ? "scale-110"
                            : "text-slate-400 group-hover:scale-110 group-hover:text-skillit",
                        ].join(" ")}
                        strokeWidth={2}
                      />
                      {item.label}
                    </span>
                    {item.badgeKey && dashboardCounts[item.badgeKey] != null && (
                      <span
                        className={[
                          "text-[11px] font-semibold rounded-full px-2 py-0.5",
                          (isRouteActive || (!useCustomActive && isActive)) ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600",
                        ].join(" ")}
                      >
                        {dashboardCounts[item.badgeKey]}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })
        )}
      </nav>

      {/* Settings + user */}
      <div className="border-t border-slate-100 px-3 py-3 space-y-1">

        <NavLink
          to="/settings"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all duration-200"
        >
          <SettingsIcon className="h-[18px] w-[18px] text-slate-400" strokeWidth={2} />
          Settings
        </NavLink>

        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="h-8 w-8 rounded-full bg-skillit text-white flex items-center justify-center text-sm font-semibold uppercase">
            {user?.name?.[0] || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.phone}</p>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="text-slate-400 hover:text-red-500 transition-colors duration-200 btn-anim"
          >
            <Power className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
