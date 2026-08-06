/**
 * activityFeed.js
 *
 * Builds the Activity drawer feed 100 % from live student data.
 * No hardcoded dates, names, amounts, or placeholder strings.
 * Each entry is only added when the corresponding real data exists.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Formats a stored date/timestamp string to a readable label.
 * Accepts "DD/MM/YYYY, HH:MM:SS" (en-GB locale from backend) or ISO strings.
 */
function fmtDateTime(raw) {
  if (!raw) return "";
  const str = String(raw).trim();
  if (str.includes("AM") || str.includes("PM")) {
    return str;
  }
  
  // en-GB locale format: "24/07/2026, 12:34:56" or "24/7/2026, 12:34:56"
  const gbMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{1,2}:\d{2})/);
  if (gbMatch) {
    const [, day, month, year, time] = gbMatch;
    const [hh, mm] = time.split(":");
    const h = Number(hh);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${day} ${MONTHS[Number(month) - 1]} ${year} - ${h12}:${mm}${ampm}`;
  }
  
  // ISO: "2026-07-24T12:34:56.000Z"
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (isoMatch) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      const day = parsed.getDate();
      const month = parsed.getMonth();
      const year = parsed.getFullYear();
      const h = parsed.getHours();
      const mm = String(parsed.getMinutes()).padStart(2, "0");
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${day} ${MONTHS[month]} ${year} - ${h12}:${mm}${ampm}`;
    }
  }
  
  // DD-MM-YYYY (legacy stored date)
  const legacyMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (legacyMatch) {
    const [, day, month, year] = legacyMatch;
    return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
  }

  // YYYY-MM-DD
  const isoDateMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
  }
  
  // Try Javascript Date parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const day = parsed.getDate();
    const month = parsed.getMonth();
    const year = parsed.getFullYear();
    const h = parsed.getHours();
    const mm = String(parsed.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    if (h === 0 && mm === "00") {
      return `${day} ${MONTHS[month]} ${year}`;
    }
    return `${day} ${MONTHS[month]} ${year} - ${h12}:${mm}${ampm}`;
  }
  
  return str;
}

function timeLabel(raw, prefix = "Exact Time") {
  const formatted = fmtDateTime(raw);
  return formatted ? `${prefix}: ${formatted}` : null;
}

/** Format a plain date string (YYYY-MM-DD or DD-MM-YYYY) to "24 Jul 2026" */
function fmtDate(raw) {
  if (!raw) return "";
  const iso = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const [, year, month, day] = iso;
    return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
  }
  const legacy = String(raw).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (legacy) {
    const [, day, month, year] = legacy;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${Number(day)} ${MONTHS[Number(month) - 1]} ${fullYear}`;
  }
  return String(raw);
}

/** Format ₹ money from a raw number */
function fmtMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

/** Safe fallback for any field */
function val(v, fallback = "—") {
  const s = String(v || "").trim();
  return s || fallback;
}

const JOURNEY_ACTION_TITLES = {
  "Student Created": "Student Created",
  "Payment Link Generated": "Payment Link Generated",
  "Payment Link Cancelled": "Payment Link Cancelled",
  "Payment Added": "Payment Added",
  "Order Punched": "Order Punched",
  "Student Enrolled": "Enrolled",
  "MIS Approved": "MIS Approved",
  "Onboarding Submitted": "Onboarding",
  "Orientation Completed": "Orientation",
  "Verification Checklist Updated": "Verification Checklist Updated",
  "Student Details Updated": "Student Details Updated",
  "Lead Transferred": "Lead Transferred",
  "Student Registration Cancelled": "Student Registration Cancelled",
  "Student Dropped": "Student Dropped",
  "Call Recording Uploaded": "Call Recording Uploaded",
};

function getItemTimestamp(item) {
  const raw = item?.timestamp || item?.at || item?.createdAt || item?.updatedAt || 0;
  const parsed = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function formatActionTitle(action, userName) {
  const title = JOURNEY_ACTION_TITLES[action] || action || "Activity";
  const actor = val(userName, "System");
  return actor ? `${title} by ${actor}` : title;
}

function formatLogDetailValue(key, value) {
  if (key === "amount" || key === "saleValue" || key === "paidAmount" || key === "outstanding") {
    return fmtMoney(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return value;
}

function getLogDetailLines(details) {
  if (!details || typeof details !== "object") return [];

  const lines = [];
  for (const [key, value] of Object.entries(details)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item == null || item === "") continue;
        if (typeof item === "string") {
          lines.push(item);
          continue;
        }
        if (typeof item === "object") {
          const nested = Object.entries(item)
            .map(([nestedKey, nestedValue]) => `${nestedKey.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}: ${formatLogDetailValue(nestedKey, nestedValue)}`)
            .join(", ");
          if (nested) lines.push(nested);
        }
      }
      continue;
    }

    if (value && typeof value === "object") {
      const nested = Object.entries(value)
        .map(([nestedKey, nestedValue]) => `${nestedKey.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}: ${formatLogDetailValue(nestedKey, nestedValue)}`)
        .join(", ");
      if (nested) lines.push(`${key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}: ${nested}`);
      continue;
    }

    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase());
    lines.push(`${label}: ${formatLogDetailValue(key, value)}`);
  }

  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────

export function getActivityFeed(student) {
  if (!student) return { all: [], callLogs: [], payments: [], onboardings: [] };

  if (Array.isArray(student.activityLogs) && student.activityLogs.length > 0) {
    const all = [];
    const callLogs = [];
    const payments = [];
    const onboardings = [];

    // Sort ascending so the feed mirrors the production sequence.
    const sortedLogs = [...student.activityLogs].sort((a, b) => getItemTimestamp(a) - getItemTimestamp(b));

    for (const log of sortedLogs) {
      const logDetails = getLogDetailLines(log.details);
      const timestamp = getItemTimestamp(log);
      const actorName = val(log.userName, "System");

      const item = {
        title: formatActionTitle(log.action, actorName),
        at: fmtDateTime(log.timestamp || log.createdAt || log.updatedAt || timestamp),
        details: logDetails,
        audio: log.action === "Call Recording Uploaded" ? log.details?.url : undefined,
        timestamp
      };

      all.push(item);

      if (log.action === "Call Recording Uploaded") {
        callLogs.push(item);
      } else if (
        log.action === "Payment Added" ||
        log.action === "Payment Link Generated" ||
        log.action === "Payment Link Cancelled"
      ) {
        payments.push(item);
      } else if (
        log.action === "Onboarding Submitted" ||
        log.action === "Orientation Completed" ||
        log.action === "Verification Checklist Updated"
      ) {
        onboardings.push(item);
      }
    }

    return {
      all,
      callLogs,
      payments,
      onboardings
    };
  }

  const s = student;
  const createdBy = val(s.createdBy);
  const sdeName = val(s.sdeName || s.createdBy);
  const managerName = val(s.manager || s.reportedTo);

  const allItems = [];
  const paymentItems = [];
  const onboardingItems = [];

  // ── 1. Student Created ─────────────────────────────────────────────────────
  if (s.createdAt) {
    allItems.push({
      title: `Student Created by ${createdBy}`,
      at: fmtDateTime(s.createdAt),
      details: [
        `Student Name: ${val(s.customerName)}`,
        `Program: ${val(s.program || s.course)}`,
        `Batch: ${val(s.batch)}`,
        `Primary Contact Name: ${val(s.primaryContactName || s.customerName)}`,
        `Primary Contact Number: ${val(s.contactNumber)}`,
        `Primary Contact Email: ${val(s.email)}`,
        `Course Fee: ${fmtMoney(s.saleValue)}`,
        s.sdeName ? `SDE: ${s.sdeName}` : null,
        s.manager ? `Manager: ${s.manager}` : null,
        timeLabel(s.createdAt),
      ].filter(Boolean),
    });
  }

  // ── 2. Payment Links generated ────────────────────────────────────────────
  const paymentLinks = Array.isArray(s.paymentLinks) && s.paymentLinks.length > 0
    ? s.paymentLinks
    : s.paymentLinkGenerated
      ? [{
          linkId: s.paymentLinkId || s.id,
          amount: s.paymentLinkAmount,
          status: s.paymentLinkStatus || "Pending",
          url: s.paymentLinkUrl || "",
          createdAt: s.paymentLinkCreatedAt || s.createdAt || "",
        }]
      : [];

  for (const link of paymentLinks) {
    const entry = {
      title: `Payment Link Generated by ${sdeName}`,
      at: fmtDateTime(link.createdAt),
      details: [
        `Amount: ${fmtMoney(link.amount)}`,
        `Status: ${val(link.status, "Pending")}`,
        link.createdAt ? `Created On: ${fmtDateTime(link.createdAt)}` : null,
        link.url ? `Link: ${link.url}` : null,
        timeLabel(link.createdAt),
      ].filter(Boolean),
    };
    allItems.push(entry);
    paymentItems.push(entry);
  }

  // ── 3. Payments added ─────────────────────────────────────────────────────
  const payments = Array.isArray(s.payments) ? s.payments : [];
  let runningPaid = 0;
  const netPayable = Math.max(0, Number(s.saleValue || 0) - Number(s.discount || 0));

  for (const p of payments) {
    const amt = Number(p.amount || 0);
    const prevPaid = runningPaid;
    runningPaid += amt;
    const prevOutstanding = Math.max(0, netPayable - prevPaid);
    const newOutstanding = Math.max(0, netPayable - runningPaid);

    const entry = {
      title: `Payment Added by ${sdeName}`,
      at: fmtDateTime(p.paidDate),
      details: [
        `Amount Received: ${fmtMoney(amt)} from ${val(s.customerName)}`,
        `Payment Mode: ${val(p.mode || s.paymentMode)}`,
        p.refId ? `Reference ID: ${p.refId}` : null,
        p.paidDate ? `Transaction Date: ${fmtDateTime(p.paidDate)}` : null,
        `Outstanding updated from ${fmtMoney(prevOutstanding)} to ${fmtMoney(newOutstanding)}`,
        timeLabel(p.paidDate),
      ].filter(Boolean),
    };
    allItems.push(entry);
    paymentItems.push(entry);
  }

  // ── 4. Order Punched ──────────────────────────────────────────────────────
  if (s.orderPunched && s.orderPunchedAt) {
    allItems.push({
      title: `Order Punched by ${sdeName}`,
      at: fmtDateTime(s.orderPunchedAt),
      details: [
        `Customer Name: ${val(s.customerName)}`,
        `Primary Contact Name: ${val(s.primaryContactName || s.customerName)}`,
        `Primary Contact Number: ${val(s.contactNumber)}`,
        `Course: ${val(s.course || s.program)}`,
        `Batch: ${val(s.batch)}`,
        `Cycle: ${val(s.cycle)}`,
        `Month: ${val(s.month)}`,
        s.paymentMode ? `Payment Mode: ${s.paymentMode}` : null,
        `Sale Value: ${fmtMoney(s.saleValue)}`,
        `Paid Amount: ${fmtMoney(s.paidAmount)}`,
        `Outstanding: ${fmtMoney(s.outstanding)}`,
        s.demoDoneBy ? `Demo Done By: ${s.demoDoneBy}` : null,
        `SDE: ${sdeName}`,
        `Manager: ${managerName}`,
        timeLabel(s.orderPunchedAt),
      ].filter(Boolean),
    });
  }

  // ── 5. Enrolled ───────────────────────────────────────────────────────────
  if (s.status === "Enrolled" && s.enrolledAt) {
    allItems.push({
      title: `Enrolled by ${managerName}`,
      at: fmtDateTime(s.enrolledAt),
      details: [
        `Status changed to Enrolled`,
        `Course: ${val(s.course || s.program)}`,
        `Batch: ${val(s.batch)}`,
        timeLabel(s.enrolledAt),
      ],
    });
  }

  // ── 5a. Cancelled ───────────────────────────────────────────────────────────
  if (s.status === "Cancelled" && s.cancelledAt) {
    allItems.push({
      title: `Student Registration Cancelled by ${managerName}`,
      at: fmtDateTime(s.cancelledAt),
      details: [
        `Status changed to Cancelled`,
        s.internalRemarks ? `Remarks: ${s.internalRemarks}` : null,
        timeLabel(s.cancelledAt),
      ].filter(Boolean),
    });
  }

  // ── 5b. Dropped ─────────────────────────────────────────────────────────────
  if (s.dropped && s.droppedAt) {
    allItems.push({
      title: `Student Dropped from Program by ${managerName}`,
      at: fmtDateTime(s.droppedAt),
      details: [
        `Status changed to Dropped`,
        s.internalRemarks ? `Remarks: ${s.internalRemarks}` : null,
        timeLabel(s.droppedAt),
      ].filter(Boolean),
    });
  }

  // ── 5c. Lead Transferred ───────────────────────────────────────────────────
  if (Array.isArray(s.transferHistory) && s.transferHistory.length > 0) {
    for (const t of s.transferHistory) {
      const fromName = t.fromUserId?.name || "Unassigned";
      const toName = t.toUserId?.name || "Unknown SDE";
      const byName = t.transferredBy?.name || "System";
      allItems.push({
        title: `Lead Transferred by ${byName}`,
        at: fmtDateTime(t.transferredAt),
        details: [
          `Transferred from: ${fromName}`,
          `Transferred to: ${toName}`,
          timeLabel(t.transferredAt),
        ],
      });
    }
  }

  // ── 6. MIS Approved ───────────────────────────────────────────────────────
  if (s.misStatus === "approved" && s.misApprovedAt) {
    allItems.push({
      title: `MIS Approved by ${managerName}`,
      at: fmtDateTime(s.misApprovedAt),
      details: [
        "MIS checklist reviewed and approved",
        s.internalRemarks ? `Remarks: ${s.internalRemarks}` : "No internal remarks",
        timeLabel(s.misApprovedAt),
      ],
    });
  }

  // ── 7. Onboarding Submitted ───────────────────────────────────────────────
  if (s.onboardingSubmitted) {
    const onboardingEntry = {
      title: `Onboarding by ${sdeName}`,
      at: s.onboardingSubmittedAt ? fmtDateTime(s.onboardingSubmittedAt) : (s.onboardingDate ? fmtDate(s.onboardingDate) : ""),
      details: [
        `Full Name: ${val(s.customerName)}`,
        `Phone Number: ${val(s.contactNumber)}`,
        `WhatsApp Number: ${val(s.altContactNumber || s.contactNumber)}`,
        `Email Address: ${val(s.email)}`,
        s.graduatedBranch ? `Graduated In / Branch: ${s.graduatedBranch}` : null,
        s.graduationYear ? `Graduation Year: ${s.graduationYear}` : null,
        s.category ? `Category: ${s.category}` : null,
        `Course: ${val(s.course || s.program)}`,
        `Batch: ${val(s.batch)}`,
        s.onboardingDate ? `Onboarding Date: ${fmtDate(s.onboardingDate)}` : null,
        s.onboardingComments ? `Verification Comments: ${s.onboardingComments}` : null,
        ...(Array.isArray(s.onboardingVerifications) ? s.onboardingVerifications.map(v => 
          `${v.item}: ${v.verified ? "Verified" : "Not Verified"} (by ${val(v.verifiedBy)} on ${fmtDateTime(v.verifiedAt)})`
        ) : []),
        timeLabel(s.onboardingSubmittedAt || s.onboardingDate || s.createdAt),
      ].filter(Boolean),
    };
    allItems.push(onboardingEntry);
    onboardingItems.push(onboardingEntry);
  }

  // ── 8. Orientation Completed ──────────────────────────────────────────────
  if (s.orientationCompleted) {
    const orientationEntry = {
      title: `Orientation by ${sdeName}`,
      at: s.orientationCompletedAt ? fmtDateTime(s.orientationCompletedAt) : (s.orientationDate ? fmtDate(s.orientationDate) : ""),
      details: [
        s.orientationDate ? `Orientation Date: ${fmtDate(s.orientationDate)}` : null,
        s.orientationLink ? `Orientation Link: ${s.orientationLink}` : null,
        s.recordedLink ? `Recorded Link: ${s.recordedLink}` : null,
        s.internalRemarks ? `Internal Remarks: ${s.internalRemarks}` : null,
        timeLabel(s.orientationCompletedAt || s.orientationDate),
      ].filter(Boolean),
    };
    allItems.push(orientationEntry);
    onboardingItems.push(orientationEntry);
  }

  // ── Call Logs ──────────────────────────────────────────────────────────────
  const callLogs = (s.callRecordings || []).map((rec) => {
    return {
      title: `Call Recording Uploaded by ${val(rec.uploadedBy, "System")}`,
      at: fmtDateTime(rec.uploadedAt),
      timestamp: rec.uploadedAt ? new Date(rec.uploadedAt) : new Date(),
      audio: rec.url,
      details: [
        `File Name: ${val(rec.fileName, "recording.mp3")}`,
        `Uploaded By: ${val(rec.uploadedBy, "System")}`,
        timeLabel(rec.uploadedAt),
      ]
    };
  });

  // Assign raw timestamps to existing items in allItems so we can sort them
  for (const item of allItems) {
    if (!item.timestamp) {
      const parsed = item.at ? new Date(item.at) : null;
      item.timestamp = parsed && !isNaN(parsed.getTime()) ? parsed : new Date(0);
    }
  }

  callLogs.sort((a, b) => getItemTimestamp(a) - getItemTimestamp(b));
  paymentItems.sort((a, b) => getItemTimestamp(a) - getItemTimestamp(b));
  onboardingItems.sort((a, b) => getItemTimestamp(a) - getItemTimestamp(b));
  allItems.push(...callLogs);
  allItems.sort((a, b) => getItemTimestamp(a) - getItemTimestamp(b));

  return {
    all: allItems,
    callLogs,
    payments: paymentItems,
    onboardings: onboardingItems,
  };
}
