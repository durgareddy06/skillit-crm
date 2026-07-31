import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  Inbox,
  Clock,
  CheckCircle,
  HelpCircle,
  X,
  ChevronDown,
  Send,
  Paperclip,
  FileText,
  Bold,
  Italic,
  Link2,
  Image as ImageIcon,
  List,
  User,
  Check,
  Edit2
} from "lucide-react";
import io from "socket.io-client";
import Topbar from "../components/Topbar";
import StatCard from "../components/StatCard";
import DataTable from "../components/DataTable";
import Button from "../components/Button";
import { useAuth } from "../context/AuthContext";
import { hasPermission } from "../lib/permissions";
import { useNavigate } from "react-router-dom";
import {
  getTickets,
  getTicketById,
  assignTicket,
  resolveTicket,
  replyTicket,
  simulateIncomingEmail,
  simulateReplySync
} from "../api/tickets";

const PRIORITY_STYLE = {
  High: "bg-red-50 text-red-600 border border-red-100",
  Medium: "bg-amber-50 text-amber-600 border border-amber-100",
  Low: "bg-slate-100 text-slate-500 border border-slate-200",
};

const STATUS_STYLE = {
  Active: "bg-blue-50 text-skillit border border-blue-100",
  RESOLVED: "bg-emerald-50 text-emerald-600 border border-emerald-100",
};

const EMAIL_TEMPLATES = [
  {
    name: "General Acknowledgement",
    text: (studentName) => `Hi ${studentName},\n\nThank you for reaching out. We have received your query and our team is looking into it. We will get back to you shortly.\n\nBest regards,\nSkillIT Support Team`
  },
  {
    name: "Portal Login Escalation",
    text: (studentName) => `Hi ${studentName},\n\nWe have escalated your portal login issue to our technical support team. They are checking the authentication logs and will resolve it within 24 hours.\n\nBest regards,\nSkillIT Tech Team`
  },
  {
    name: "Fee/Payment Inquiry",
    text: (studentName) => `Hi ${studentName},\n\nThank you for your payment query. We have updated our records and verified your transaction receipt. Your outstanding balance is updated in the portal.\n\nBest regards,\nSkillIT RM Team`
  }
];

export default function Tokens() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canCreateToken = hasPermission(user, "tokens", "create");
  const [tickets, setTickets] = useState([]);
  const [resolvedTickets, setResolvedTickets] = useState([]);
  const [viewResolved, setViewResolved] = useState(false);
  
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Form states
  const [replyText, setReplyText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [assignDropdownOpen, setAssignDropdownOpen] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const fileInputRef = useRef(null);
  const messageEndRef = useRef(null);
  const socketRef = useRef(null);

  // 1. Fetch tickets from backend
  const fetchTickets = async () => {
    try {
      const active = await getTickets(false);
      const resolved = await getTickets(true);
      setTickets(active);
      setResolvedTickets(resolved);
    } catch (err) {
      console.error("Error fetching tickets:", err);
    }
  };

  useEffect(() => {
    fetchTickets();

    // 2. Initialize Socket.IO Client for real-time sync
    const wsUrl = import.meta.env.VITE_WS_URL || "http://localhost:4000";
    const socket = io(wsUrl);
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to WebSocket server");
    });

    socket.on("ticket-created", (newTicket) => {
      // Re-fetch to apply department filters dynamically based on user role
      fetchTickets();
    });

    socket.on("ticket-assigned", ({ ticketId, ticket, fromDepartment, toDepartment }) => {
      fetchTickets();
      // Update selected ticket in place if drawer is open
      setSelectedTicket((prev) => {
        if (prev && (prev.ticketId === ticketId || prev._id === ticketId)) {
          return { ...prev, assignedDepartment: toDepartment };
        }
        return prev;
      });
    });

    socket.on("ticket-resolved", ({ ticketId, ticket }) => {
      fetchTickets();
      setSelectedTicket((prev) => {
        if (prev && (prev.ticketId === ticketId || prev._id === ticketId)) {
          return { ...prev, status: "RESOLVED" };
        }
        return prev;
      });
    });

    socket.on("ticket-updated", (updatedTicket) => {
      // Find and update active or resolved tickets
      setTickets((prev) => prev.map((t) => (t._id === updatedTicket._id ? updatedTicket : t)));
      setResolvedTickets((prev) => prev.map((t) => (t._id === updatedTicket._id ? updatedTicket : t)));
      
      setSelectedTicket((prev) => {
        if (prev && prev._id === updatedTicket._id) {
          return updatedTicket;
        }
        return prev;
      });
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  // Scroll to bottom of message list on updates
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedTicket?.conversation]);

  // Compute stat totals
  const stats = useMemo(() => {
    const totalCount = tickets.length + resolvedTickets.length;
    const activeCount = tickets.length;
    const resolvedCount = resolvedTickets.length;
    
    // Medium/High counts
    const pendingHigh = tickets.filter(t => t.priority === "High").length;
    const csat = 96; // mock static metric
    
    return {
      total: totalCount,
      active: activeCount,
      pendingHigh,
      resolved: resolvedCount,
      csat
    };
  }, [tickets, resolvedTickets]);

  // Open ticket drawer and fetch fresh details
  const handleOpenTicket = async (ticket) => {
    setDrawerLoading(true);
    setDrawerOpen(true);
    try {
      const details = await getTicketById(ticket.ticketId);
      setSelectedTicket(details);
    } catch (err) {
      console.error("Error loading ticket detail:", err);
      setSelectedTicket(ticket); // fallback
    } finally {
      setDrawerLoading(false);
    }
  };

  // Close ticket drawer
  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedTicket(null);
    setReplyText("");
    setSelectedFile(null);
    setAssignDropdownOpen(false);
    setTemplateDropdownOpen(false);
  };

  // Resolve Action
  const handleResolve = async () => {
    if (!selectedTicket) return;
    try {
      await resolveTicket(selectedTicket.ticketId);
      // Close drawer after resolve or let live sync update state
      handleCloseDrawer();
    } catch (err) {
      alert("Error resolving ticket. Please try again.");
    }
  };

  // Assign Action
  const handleAssign = async (department) => {
    if (!selectedTicket) return;
    try {
      await assignTicket(selectedTicket.ticketId, department);
      setAssignDropdownOpen(false);
      
      // If user's role is not admin, they might lose view permission, close drawer
      const role = (user?.role || "").toLowerCase();
      const designation = (user?.designation || "").toLowerCase();
      const isUserAdmin = role === "admin";
      
      let keepsPermission = isUserAdmin;
      if (!isUserAdmin) {
        const isTech = role === "tech" || designation.includes("tech");
        const isRM = role === "relationship manager" || role === "rm" || designation.includes("rm") || designation.includes("relationship manager");
        const isSupport = role === "customer support executive" || role === "support" || designation.includes("support") || designation.includes("customer support");
        
        if (isTech && department === "Tech") keepsPermission = true;
        if (isRM && department === "RM") keepsPermission = true;
        if (isSupport && department === "Support") keepsPermission = true;
      }

      if (!keepsPermission) {
        handleCloseDrawer();
      }
    } catch (err) {
      alert("Error re-assigning ticket. Please try again.");
    }
  };

  // Reply Send Action
  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    setIsSubmittingReply(true);
    try {
      // Simulate file upload name if present
      const attachments = selectedFile ? [selectedFile.name] : [];
      
      await replyTicket(selectedTicket.ticketId, replyText, attachments);
      
      // Reset input fields
      setReplyText("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      alert("Error sending reply. Please check connection.");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Rich text formatting utility
  const formatText = (syntax) => {
    const textarea = document.getElementById("reply-textarea");
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    let replacement = "";
    if (syntax === "bold") replacement = `**${selected || "bold text"}**`;
    if (syntax === "italic") replacement = `*${selected || "italic text"}*`;
    if (syntax === "link") replacement = `[${selected || "Link Text"}](https://)`;
    if (syntax === "image") replacement = `![${selected || "Image"}](https://)`;
    if (syntax === "list") replacement = `\n- ${selected || "List item"}`;

    setReplyText(text.substring(0, start) + replacement + text.substring(end));
    textarea.focus();
  };

  // Insert Template utility
  const handleInsertTemplate = (templateTextFn) => {
    const studentName = selectedTicket?.studentName || "Student";
    const text = templateTextFn(studentName);
    setReplyText((prev) => (prev ? prev + "\n\n" + text : text));
    setTemplateDropdownOpen(false);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Render Timeline Nodes
  const renderTimeline = (ticket) => {
    const isCreated = true;
    const isAssigned = !!ticket.assignedDepartment;
    const isActivity = ticket.conversation && ticket.conversation.length > 1;
    const isResolved = ticket.status === "RESOLVED";

    return (
      <div className="flex flex-col items-center justify-between h-[280px] py-4 bg-slate-50 border border-slate-100 rounded-2xl w-20 shadow-sm shrink-0">
        <TimelineNode label="CREATED" active={isCreated} icon="check" />
        <div className="w-0.5 flex-1 bg-slate-200"></div>
        <TimelineNode label="ASSIGNED" active={isAssigned} icon="user" />
        <div className="w-0.5 flex-1 bg-slate-200"></div>
        <TimelineNode label="ACTIVITY" active={isActivity} icon="pencil" />
        <div className="w-0.5 flex-1 bg-slate-200"></div>
        <TimelineNode label="RESOLVED" active={isResolved} icon="check" />
      </div>
    );
  };

  const currentQueue = viewResolved ? resolvedTickets : tickets;

  return (
    <div className="relative min-h-screen">
      {/* Topbar: Added dynamic context & clean subtitle, removed Manual creation "+ New Ticket" */}
      <Topbar
        title="Tokens"
        subtitle="Skillit Academy | Support Inbox"
      />

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Tickets" value={stats.total} hint="All-time received" tone="blue" />
        <StatCard label="Active Tickets" value={stats.active} hint="Awaiting resolution" tone="amber" />
        <StatCard label="High Priority" value={stats.pendingHigh} hint="Needs urgent attention" tone="red" />
        <StatCard label="Resolved Tickets" value={stats.resolved} hint="Archived from queue" tone="green" />
      </div>

      {/* Active vs Resolved tab queue */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
          <button
            onClick={() => setViewResolved(false)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              !viewResolved ? "bg-white text-slate-800 shadow-sm border border-slate-200/20" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Active Ticket Queue ({tickets.length})
          </button>
          <button
            onClick={() => setViewResolved(true)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              viewResolved ? "bg-white text-slate-800 shadow-sm border border-slate-200/20" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Resolved Tickets ({resolvedTickets.length})
          </button>
        </div>
        <div className="flex gap-2">
          {/* Simulation Tools for easier developer testing & manual checks */}
          <button
            onClick={async () => {
              const testEmail = prompt("Enter student email to simulate ticket creation:");
              if (!testEmail) return;
              try {
                await simulateIncomingEmail({
                  senderEmail: testEmail,
                  recipientEmail: "support@skillit.com",
                  subject: "Course Enrollment Failure",
                  body: "I am unable to see my enrolled Course DADS-02 on my student dashboard. Please check this immediately."
                });
                alert("Simulated incoming email. Live sync will refresh queue.");
              } catch (err) {
                alert("Failed: Student not registered.");
              }
            }}
            className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 font-medium transition-all"
          >
            Simulate Email
          </button>
          <Button variant="outline">Export CSV</Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        <DataTable
          columns={[
            {
              key: "ticketId",
              label: "Ticket ID",
              render: (r) => (
                <button
                  onClick={() => handleOpenTicket(r)}
                  className="font-medium text-skillit hover:underline text-left"
                >
                  #{r.ticketId}
                </button>
              )
            },
            {
              key: "studentName",
              label: "Student",
              render: (r) => {
                const canViewDetails = hasPermission(user, "tokens", "details");
                return (
                  <div>
                    {canViewDetails && r.studentId ? (
                      <button
                        onClick={() => navigate(`/student/${r.studentId}?context=tokens`)}
                        className="font-medium text-skillit hover:underline text-left"
                      >
                        {r.studentName}
                      </button>
                    ) : (
                      <div className="font-medium text-slate-800">{r.studentName}</div>
                    )}
                    <div className="text-xs text-slate-400">{r.studentEmail}</div>
                  </div>
                );
              }
            },
            {
              key: "subject",
              label: "Subject",
              render: (r) => <span className="text-slate-600 truncate max-w-xs block font-medium">{r.subject}</span>
            },
            {
              key: "priority",
              label: "Priority",
              render: (r) => (
                <span className={`text-[10px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full ${PRIORITY_STYLE[r.priority] || PRIORITY_STYLE.Medium}`}>
                  {r.priority}
                </span>
              )
            },
            {
              key: "assignedDepartment",
              label: "Department",
              render: (r) => (
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
                  {r.assignedDepartment || "Support"}
                </span>
              )
            },
            {
              key: "status",
              label: "Status",
              render: (r) => (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[r.status] || STATUS_STYLE.Active}`}>
                  {r.status === "RESOLVED" ? "Resolved" : "Active"}
                </span>
              )
            },
            {
              key: "createdAt",
              label: "Created",
              render: (r) => {
                const diffMs = new Date() - new Date(r.createdAt);
                const diffHrs = Math.floor(diffMs / 3600000);
                if (diffHrs < 1) return "Just now";
                if (diffHrs < 24) return `${diffHrs}h ago`;
                return new Date(r.createdAt).toLocaleDateString();
              }
            }
          ]}
          rows={currentQueue}
          emptyText={viewResolved ? "No resolved tickets yet." : "No active tickets in queue."}
        />
      </div>

      {/* Slide-over side Drawer exactly matching Figma reference layout */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={handleCloseDrawer}
          />

          <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex sm:pl-16">
            <div className="w-screen max-w-4xl bg-white shadow-2xl flex flex-col h-full animate-slideOver border-l border-slate-100">
              
              {/* Drawer Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCloseDrawer}
                    className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <span className="font-display font-bold text-slate-800 text-lg">
                    #{selectedTicket?.ticketId}
                  </span>
                </div>
                
                {/* Actions: Assign dropdown & Resolve button */}
                <div className="flex items-center gap-2">
                  {selectedTicket?.status !== "RESOLVED" && (
                    <>
                      {/* Assign Department Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setAssignDropdownOpen(!assignDropdownOpen)}
                          disabled={!canCreateToken}
                          title={canCreateToken ? undefined : "Create access is disabled for this role"}
                          className="px-4 py-1.5 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold text-slate-600 bg-white flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          assign <ChevronDown className="h-3 w-3" />
                        </button>
                        {assignDropdownOpen && (
                          <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-pop z-50 p-1">
                            {["Support", "Relationship Manager", "Tech"].map((d) => (
                              <button
                                key={d}
                                onClick={() => handleAssign(d === "Relationship Manager" ? "RM" : d)}
                                className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-800 rounded font-medium transition-colors"
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Resolve button */}
                      <button
                        onClick={handleResolve}
                        disabled={!canCreateToken}
                        title={canCreateToken ? undefined : "Create access is disabled for this role"}
                        className="px-4 py-1.5 bg-skillit hover:bg-skillit-dark text-white rounded-lg text-xs font-semibold shadow-pop transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Resolve
                      </button>
                    </>
                  )}
                  {selectedTicket?.status === "RESOLVED" && (
                    <span className="px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full flex items-center gap-1">
                      <Check className="h-3 w-3" /> Resolved
                    </span>
                  )}
                  <button className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                    {/* Extra details option */}
                  </button>
                </div>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col justify-between">
                {drawerLoading || !selectedTicket ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                    <Clock className="h-8 w-8 animate-spin text-skillit" />
                    <span>Loading ticket details...</span>
                  </div>
                ) : (
                  <>
                    {/* Student Info Card + Vertical Timeline */}
                    <div className="flex gap-4">
                      {/* Left: Info Card */}
                      <div className="flex-1 border border-slate-100 rounded-2xl p-5 bg-white shadow-card flex items-start gap-4">
                        {/* Student Avatar */}
                        <div className="h-16 w-16 rounded-2xl bg-slate-100 text-slate-600 shrink-0 overflow-hidden flex items-center justify-center font-bold text-2xl border border-slate-200/50 shadow-inner">
                          {selectedTicket.studentName ? (
                            <img
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedTicket.studentName)}&background=f1f5f9&color=0284c7&bold=true&size=128`}
                              alt={selectedTicket.studentName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <User className="h-8 w-8 text-slate-400" />
                          )}
                        </div>

                        {/* Student fields */}
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <h3 className="font-display font-bold text-slate-800 text-lg leading-tight truncate">
                            {selectedTicket.studentName}
                          </h3>
                          <p className="text-xs text-slate-400 font-medium truncate">
                            {selectedTicket.studentEmail}
                          </p>

                          {/* Student Badges */}
                          <div className="flex flex-wrap gap-1.5 pt-2">
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200/50 px-2.5 py-0.5 rounded-full">
                              DADS-02
                            </span>
                            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200/50 px-2.5 py-0.5 rounded-full">
                              Batch 2
                            </span>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/45 px-2.5 py-0.5 rounded-full">
                              Active Status
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Vertical Timeline */}
                      {renderTimeline(selectedTicket)}
                    </div>

                    {/* Ticket Subject and Description */}
                    <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50/50 space-y-2">
                      <h4 className="font-display font-bold text-slate-800 text-base">
                        {selectedTicket.subject}
                      </h4>
                      <p className="text-sm text-slate-500 italic leading-relaxed whitespace-pre-wrap">
                        "{selectedTicket.description}"
                      </p>
                    </div>

                    {/* Email Conversation Thread */}
                    <div className="flex-1 min-h-[250px] border border-slate-100 rounded-2xl bg-slate-50/20 p-4 overflow-y-auto space-y-4 shadow-inner">
                      {selectedTicket.conversation && selectedTicket.conversation.map((msg, i) => {
                        const isStudent = msg.direction === "INBOUND";
                        return (
                          <div
                            key={i}
                            className={`flex items-start gap-3 max-w-[85%] ${
                              isStudent ? "mr-auto" : "ml-auto flex-row-reverse"
                            }`}
                          >
                            {/* Avatar */}
                            <div className="h-9 w-9 rounded-full bg-slate-200 shrink-0 overflow-hidden flex items-center justify-center font-bold text-sm text-slate-600 border border-slate-100 shadow-sm">
                              {isStudent ? (
                                <img
                                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedTicket.studentName)}&background=e2e8f0&color=475569&bold=true`}
                                  alt="Student"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="text-skillit">SA</span>
                              )}
                            </div>

                            {/* Message content block */}
                            <div className="space-y-1">
                              {/* Header info */}
                              <div className={`flex items-center gap-2 text-[10px] text-slate-400 ${
                                isStudent ? "justify-start" : "justify-end"
                              }`}>
                                <span className="font-semibold text-slate-600">
                                  {isStudent ? selectedTicket.studentName : msg.sender}
                                </span>
                                <span>•</span>
                                <span>
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              {/* Bubble */}
                              <div
                                className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                                  isStudent
                                    ? "bg-white text-slate-800 border border-slate-200/60 rounded-tl-none"
                                    : "bg-skillit text-white rounded-tr-none"
                                }`}
                              >
                                {msg.message}

                                {/* Message attachments list */}
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className={`mt-2 pt-2 border-t flex flex-col gap-1 ${
                                    isStudent ? "border-slate-100 text-slate-500" : "border-white/20 text-white/90"
                                  }`}>
                                    {msg.attachments.map((file, idx) => (
                                      <div key={idx} className="flex items-center gap-1.5 text-xs font-semibold">
                                        <FileText className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{file}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messageEndRef} />
                    </div>

                    {/* Rich text reply box & actions */}
                    {selectedTicket.status !== "RESOLVED" && (
                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                        {/* Editor Toolbar */}
                        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                          <div className="flex items-center gap-3 text-slate-500">
                            <button
                              onClick={() => formatText("bold")}
                              title="Bold"
                              className="p-1 hover:bg-slate-200 rounded transition-colors"
                            >
                              <Bold className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => formatText("italic")}
                              title="Italic"
                              className="p-1 hover:bg-slate-200 rounded transition-colors"
                            >
                              <Italic className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => formatText("link")}
                              title="Insert Link"
                              className="p-1 hover:bg-slate-200 rounded transition-colors"
                            >
                              <Link2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => formatText("image")}
                              title="Insert Image"
                              className="p-1 hover:bg-slate-200 rounded transition-colors"
                            >
                              <ImageIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => formatText("list")}
                              title="Bullet List"
                              className="p-1 hover:bg-slate-200 rounded transition-colors"
                            >
                              <List className="h-4 w-4" />
                            </button>
                          </div>
                          
                          {/* Selected file preview */}
                          {selectedFile && (
                            <span className="text-xs text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded flex items-center gap-1">
                              <FileText className="h-3 w-3" /> {selectedFile.name}
                              <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-slate-600 font-bold">×</button>
                            </span>
                          )}
                        </div>

                        {/* TextArea Input */}
                        <textarea
                          id="reply-textarea"
                          rows={3}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Type your reply here..."
                          className="w-full px-4 py-3 outline-none text-slate-700 text-sm resize-none"
                        />

                        {/* Footer Controls */}
                        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* File Upload Trigger */}
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={handleFileChange}
                              className="hidden"
                            />
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
                            >
                              <Paperclip className="h-3.5 w-3.5" /> Attach File
                            </button>

                            {/* Templates Trigger */}
                            <div className="relative">
                              <button
                                onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
                              >
                                <Edit2 className="h-3.5 w-3.5" /> Use Template
                              </button>
                              {templateDropdownOpen && (
                                <div className="absolute left-0 bottom-full mb-1 w-64 bg-white border border-slate-200 rounded-xl shadow-pop z-50 p-1">
                                  {EMAIL_TEMPLATES.map((tmpl, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => handleInsertTemplate(tmpl.text)}
                                      className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-800 rounded-lg transition-colors font-medium"
                                    >
                                      {tmpl.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Submit Button */}
                          <button
                            onClick={handleSendReply}
                            disabled={isSubmittingReply || !replyText.trim()}
                            className="px-4 py-2 bg-skillit hover:bg-skillit-dark text-white rounded-xl text-xs font-semibold shadow-pop transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSubmittingReply ? "Sending..." : (
                              <>
                                Send Reply <Send className="h-3 w-3" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Timeline Helper Step
function TimelineNode({ label, active, icon }) {
  let colorClass = "bg-slate-200 text-slate-400 border border-slate-300";
  if (active) {
    if (label === "CREATED") colorClass = "bg-emerald-500 text-white shadow-sm border border-emerald-600";
    if (label === "ASSIGNED") colorClass = "bg-blue-500 text-white shadow-sm border border-blue-600";
    if (label === "ACTIVITY") colorClass = "bg-amber-500 text-white shadow-sm border border-amber-600";
    if (label === "RESOLVED") colorClass = "bg-emerald-500 text-white shadow-sm border border-emerald-600";
  }

  const renderIcon = () => {
    if (icon === "check") return <Check className="h-4 w-4" strokeWidth={3} />;
    if (icon === "user") return <User className="h-4 w-4" strokeWidth={3} />;
    if (icon === "pencil") return <Edit2 className="h-3.5 w-3.5" strokeWidth={3} />;
    return null;
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`h-8 w-8 rounded-full flex items-center justify-center transition-all ${colorClass}`}>
        {renderIcon()}
      </div>
      <span className={`text-[9px] font-bold tracking-wider ${active ? "text-slate-800" : "text-slate-400"}`}>
        {label}
      </span>
    </div>
  );
}
