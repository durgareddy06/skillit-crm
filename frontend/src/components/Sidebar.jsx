import React, { useEffect, useState } from "react";
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
import { MODULE_NAV } from "../config/menuConfig";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../lib/permissions";
import { getStudentSummary } from "../api/students";

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
  const items = MODULE_NAV.filter((item) => hasPermission(user, item.key, "read"));
  const location = useLocation();
  const [dashboardCounts, setDashboardCounts] = useState({ pending: 0, enrolled: 0, cancelled: 0 });
  const context = new URLSearchParams(location.search).get("context");
  const paymentLinkContext = context === "payment-link";
  const paymentsContext = context === "payments";
  const bookedOrdersContext = context === "booked-orders";
  const pendingContext = context === "pending";
  const enrollmentsContext = context === "enrollments";
  const enrolledContext = context === "enrolled";
  const cancelledContext = context === "cancelled";
  const misApprovalContext = context === "mis-approval";
  const approvedContext = context === "approved";
  const onboardingDetail = location.pathname.startsWith("/onboarding/");
  const orientationDetail = location.pathname.startsWith("/orientation/");
  const learnersDetail = location.pathname.startsWith("/learners/");
  const tokensDetail = location.pathname.startsWith("/tokens/");
  const moduleContext = paymentLinkContext || paymentsContext || bookedOrdersContext || pendingContext || enrollmentsContext || enrolledContext || cancelledContext || misApprovalContext || approvedContext || onboardingDetail || orientationDetail || learnersDetail || tokensDetail;

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    getStudentSummary({ signal: controller.signal })
      .then((summary) => {
        if (!alive) return;
        setDashboardCounts({
          pending: summary?.pending || 0,
          enrolled: summary?.enrolled || 0,
          cancelled: summary?.cancelled || 0,
        });
      })
      .catch(() => {
        if (!alive) return;
        setDashboardCounts({ pending: 0, enrolled: 0, cancelled: 0 });
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  return (
    <aside className="hidden md:flex md:w-64 shrink-0 flex-col bg-white border-r border-slate-200 h-screen sticky top-0">
      {/* Logo */}
      <div className="flex h-[135px] items-start border-b border-slate-100 px-4 pt-4">
        <img
          src="/skillitacc_logo.svg"
          alt="SkillIT Academy"
          className="h-[114px] w-[229px] object-contain object-left-top"
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
        {items.map((item) => {
          const Icon = ICONS[item.icon] || GraduationCap;
          const isPaymentLinkDetail = item.key === "payment-link" && location.pathname.startsWith("/student") && paymentLinkContext;
          const isPaymentsDetail = item.key === "payments" && location.pathname.startsWith("/student") && paymentsContext;
          const isBookedOrdersDetail = item.key === "booked-orders" && location.pathname.startsWith("/student") && bookedOrdersContext;
          const isPendingDetail = item.key === "pending" && location.pathname.startsWith("/student") && pendingContext;
          const isEnrollmentsDetail = item.key === "enrollments" && location.pathname.startsWith("/student") && enrollmentsContext;
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
                  : item.key === "enrollments"
                    ? location.pathname === "/enrollments" || isEnrollmentsDetail
                  : item.key === "enrolled"
                    ? location.pathname === "/enrolled" || isEnrolledDetail
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
        })}
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
