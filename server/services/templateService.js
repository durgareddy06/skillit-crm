/**
 * Centralized Email Template Service
 * Generates premium HTML layouts for system notifications.
 */

// ==============================================================================
// #1 BASE LAYOUT & STYLING
// ==============================================================================
const baseLayout = (content, previewText = "SkillIT Notification") => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SkillIT CRM</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #334155;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f8fafc;
      padding-bottom: 40px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      margin-top: 40px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05);
      border: 1px solid #f1f5f9;
    }
    .header {
      background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%);
      padding: 32px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.025em;
    }
    .header p {
      color: #bfdbfe;
      margin: 4px 0 0 0;
      font-size: 14px;
    }
    .content {
      padding: 32px;
      font-size: 16px;
      line-height: 1.6;
    }
    .button-container {
      text-align: center;
      margin: 24px 0;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #4f46e5;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      transition: background-color 0.2s;
    }
    .footer {
      text-align: center;
      padding: 24px;
      font-size: 12px;
      color: #94a3b8;
      background-color: #f8fafc;
      border-top: 1px solid #f1f5f9;
    }
    .footer p {
      margin: 4px 0;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .info-table td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 14px;
    }
    .info-table td.label {
      font-weight: 600;
      color: #64748b;
      width: 35%;
    }
    .info-table td.value {
      color: #0f172a;
    }
    .preview-text {
      display: none;
      max-height: 0px;
      overflow: hidden;
    }
    .quote-box {
      background-color: #f1f5f9;
      border-left: 4px solid #4f46e5;
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
      font-style: italic;
      font-size: 15px;
    }
    .history-box {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      background-color: #fafafa;
      margin-top: 20px;
      max-height: 250px;
      overflow-y: auto;
    }
    .history-item {
      margin-bottom: 12px;
      font-size: 13px;
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 8px;
    }
    .history-item:last-child {
      margin-bottom: 0;
      border-bottom: none;
      padding-bottom: 0;
    }
    .history-meta {
      font-weight: bold;
      color: #475569;
      margin-bottom: 2px;
    }
  </style>
</head>
<body>
  <span class="preview-text">${previewText}</span>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>SkillIT</h1>
        <p>Academy & Student Portal</p>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} SkillIT. All rights reserved.</p>
        <p>support@skillit.com | +91 98765 43210</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

// ==============================================================================
// #2 STUDENT MODULE TEMPLATES
// ==============================================================================
export const getWelcomeTemplate = ({ name, email, loginUrl, tempPassword }) => {
  const passwordSection = tempPassword
    ? `<tr><td class="label">Temporary Password</td><td class="value"><code>${tempPassword}</code></td></tr>`
    : "";

  return baseLayout(`
    <h2>Welcome to SkillIT, ${name}!</h2>
    <p>We are absolutely thrilled to welcome you to our learner community. Your registration has been processed successfully, and your student portal account is active.</p>
    
    <table class="info-table">
      <tr>
        <td class="label">Registered Email</td>
        <td class="value">${email}</td>
      </tr>
      ${passwordSection}
    </table>

    <p>Please click the button below to access your student dashboard and start your journey.</p>
    <div class="button-container">
      <a href="${loginUrl}" class="button">Go to Student Portal</a>
    </div>
    
    <p>If you have any questions or need technical support, reply directly to this email or contact support@skillit.com.</p>
  `, `Welcome to SkillIT, ${name}!`);
};

// ==============================================================================
// #3 FORGOT PASSWORD & AUTHENTICATION MODULE TEMPLATES
// ==============================================================================
export const getPasswordResetTemplate = ({ name, resetUrl, expiresHours }) => {
  return baseLayout(`
    <h2>Password Reset Request</h2>
    <p>Hello ${name},</p>
    <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
    
    <p>To set a new password, click the button below. This link is valid for the next <strong>${expiresHours || 1} hour(s)</strong>.</p>
    
    <div class="button-container">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>
    
    <p>Alternatively, copy and paste this URL into your browser:</p>
    <p style="word-break: break-all; font-size: 14px; color: #4f46e5;">${resetUrl}</p>
  `, "Reset your SkillIT student password");
};

export const getEmailVerificationTemplate = ({ name, verificationUrl }) => {
  return baseLayout(`
    <h2>Verify Your Email Address</h2>
    <p>Hello ${name},</p>
    <p>Thank you for signing up with SkillIT. Please verify your email address to unlock all dashboard privileges and complete your onboarding process.</p>
    
    <div class="button-container">
      <a href="${verificationUrl}" class="button">Verify Email</a>
    </div>
    
    <p>Or click this link: <a href="${verificationUrl}">${verificationUrl}</a></p>
  `, "Verify your SkillIT registration");
};

// ==============================================================================
// #4 PAYMENT MODULE TEMPLATES (SUCCESS, FAILURE, REFUND)
// ==============================================================================
export const getPaymentSuccessTemplate = ({ name, amount, date, transactionId, productName }) => {
  return baseLayout(`
    <h2>Payment Confirmation</h2>
    <p>Hello ${name},</p>
    <p>Thank you for your payment. Your transaction was completed successfully, and your course seats/materials have been updated.</p>
    
    <table class="info-table">
      <tr>
        <td class="label">Course/Product</td>
        <td class="value">${productName || "SkillIT Program Fee"}</td>
      </tr>
      <tr>
        <td class="label">Amount Paid</td>
        <td class="value"><strong>₹${amount}</strong></td>
      </tr>
      <tr>
        <td class="label">Transaction ID</td>
        <td class="value"><code>${transactionId}</code></td>
      </tr>
      <tr>
        <td class="label">Payment Date</td>
        <td class="value">${date}</td>
      </tr>
    </table>

    <p>We have attached the Fee Receipt PDF to this email for your records.</p>
    <p>Happy learning!</p>
  `, `Payment received for ${productName || "SkillIT"}`);
};

export const getPaymentFailureTemplate = ({ name, amount, errorReason, retryUrl }) => {
  const retrySection = retryUrl
    ? `
      <div class="button-container">
        <a href="${retryUrl}" class="button">Try Payment Again</a>
      </div>`
    : "";

  return baseLayout(`
    <h2 style="color: #dc2626;">Payment Failed</h2>
    <p>Hello ${name},</p>
    <p>We attempted to process a payment of <strong>₹${amount}</strong> on your account, but the transaction failed.</p>
    
    <div class="quote-box" style="border-left-color: #dc2626;">
      <strong>Reason:</strong> ${errorReason || "Declined by issuing bank"}
    </div>

    <p>Please double-check your payment credentials or try a different payment mode. If you need assistance, please reply to this email.</p>
    
    ${retrySection}
  `, "Urgent: Payment failed on your account");
};

export const getRefundTemplate = ({ name, amount, date, transactionId }) => {
  return baseLayout(`
    <h2>Refund Issued</h2>
    <p>Hello ${name},</p>
    <p>We have processed a refund of <strong>₹${amount}</strong> on your payment transaction. The funds should credit back to your original payment mode within 5-7 working days.</p>
    
    <table class="info-table">
      <tr>
        <td class="label">Refunded Amount</td>
        <td class="value">₹${amount}</td>
      </tr>
      <tr>
        <td class="label">Transaction ID</td>
        <td class="value"><code>${transactionId}</code></td>
      </tr>
      <tr>
        <td class="label">Refund Date</td>
        <td class="value">${date}</td>
      </tr>
    </table>
    
    <p>If you have any questions about this refund, please reply to this email.</p>
  `, "SkillIT Refund processed successfully");
};

// ==============================================================================
// #5 TOKENS (SUPPORT) MODULE TEMPLATES
// ==============================================================================
export const getSupportReplyTemplate = ({ ticketId, subject, replyMessage, conversationHistory }) => {
  let historyHtml = "";
  if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
    const items = conversationHistory
      .slice(-5)
      .map(item => `
        <div class="history-item">
          <div class="history-meta">${item.sender} - ${new Date(item.timestamp).toLocaleString("en-GB")}</div>
          <div>${item.message}</div>
        </div>
      `).join("");
    historyHtml = `
      <h3 style="margin-top: 24px; color: #64748b;">Conversation Thread:</h3>
      <div class="history-box">${items}</div>
    `;
  }

  return baseLayout(`
    <h2>Update for Ticket #${ticketId}</h2>
    <p>Our support executive has posted a new reply to your ticket <strong>[${ticketId}] - ${subject}</strong>.</p>
    
    <div class="quote-box">
      ${replyMessage}
    </div>

    <p style="font-size: 13px; color: #64748b; font-style: italic;">To reply to this update, you can simply reply to this email, and it will sync back to your support dashboard.</p>
    
    ${historyHtml}
  `, `Update for Ticket #${ticketId}`);
};

export const getTicketCreatedTemplate = ({ ticketId, subject, description, department }) => {
  return baseLayout(`
    <h2>Ticket Created - #${ticketId}</h2>
    <p>We have successfully registered your request. A ticket has been created and assigned to our <strong>${department || "Support"}</strong> team.</p>
    
    <table class="info-table">
      <tr>
        <td class="label">Ticket ID</td>
        <td class="value"><code>${ticketId}</code></td>
      </tr>
      <tr>
        <td class="label">Subject</td>
        <td class="value">${subject}</td>
      </tr>
      <tr>
        <td class="label">Assigned Department</td>
        <td class="value">${department}</td>
      </tr>
    </table>

    <div class="quote-box">
      <strong>Your query:</strong><br/>
      ${description || "No description provided."}
    </div>

    <p>Our team will look into this and update you shortly. Thank you for your patience.</p>
  `, `Ticket [${ticketId}] created: ${subject}`);
};

export const getTicketResolvedTemplate = ({ ticketId, resolvedBy, resolvedAt }) => {
  return baseLayout(`
    <h2>Support Ticket Resolved</h2>
    <p>We are writing to confirm that ticket <strong>#${ticketId}</strong> has been marked as <strong>RESOLVED</strong> by our support team.</p>
    
    <table class="info-table">
      <tr>
        <td class="label">Ticket ID</td>
        <td class="value"><code>${ticketId}</code></td>
      </tr>
      <tr>
        <td class="label">Resolved By</td>
        <td class="value">${resolvedBy || "System Support"}</td>
      </tr>
      <tr>
        <td class="label">Resolved At</td>
        <td class="value">${resolvedAt ? new Date(resolvedAt).toLocaleString("en-GB") : new Date().toLocaleString("en-GB")}</td>
      </tr>
    </table>

    <p>We hope we answered your query completely. If your issue is still unresolved, you can simply reply to this email to re-open it.</p>
  `, `Ticket #${ticketId} has been resolved`);
};

// ==============================================================================
// #6 GENERAL NOTIFICATIONS
// ==============================================================================
export const getGeneralNotificationTemplate = ({ title, message }) => {
  return baseLayout(`
    <h2>${title}</h2>
    <p>${message}</p>
  `, title);
};

// ==============================================================================
// #7 STATUS TRANSITION WORKFLOW TEMPLATES
// ==============================================================================
export const getOrderPunchedTemplate = ({ name, program, date }) => {
  return baseLayout(`
    <h2>Hello ${name},</h2>
    <p>We are pleased to inform you that your program order has been successfully placed.</p>
    <table class="info-table">
      <tr>
        <td class="label">Program Name</td>
        <td class="value">${program}</td>
      </tr>
      <tr>
        <td class="label">Order Date</td>
        <td class="value">${date}</td>
      </tr>
    </table>
    <p>Our academic admissions team will review your order details and follow up on the next steps for your enrollment.</p>
    <p>Happy learning!</p>
  `, `Order Punched Confirmation for ${name}`);
};

export const getAdmissionApprovedTemplate = ({ name, program }) => {
  return baseLayout(`
    <h2>Hello ${name},</h2>
    <p>Congratulations! Your admission to the <strong>${program}</strong> has been officially approved by our admissions team.</p>
    <p>You are now being moved to the Orientation process. You will receive orientation details and schedules shortly.</p>
    <p>Welcome to SkillIT!</p>
  `, `Admission Approved - ${name}`);
};

export const getOnboardingTemplate = ({ name, program, batch, onboardingDate }) => {
  return baseLayout(`
    <h2>Hello ${name},</h2>
    <p>Your onboarding process is complete, and you have been assigned to your batch!</p>
    <table class="info-table">
      <tr>
        <td class="label">Program</td>
        <td class="value">${program}</td>
      </tr>
      <tr>
        <td class="label">Assigned Batch</td>
        <td class="value">${batch}</td>
      </tr>
      ${onboardingDate ? `
      <tr>
        <td class="label">Onboarding Date</td>
        <td class="value">${onboardingDate}</td>
      </tr>` : ""}
    </table>
    <p>Get ready to start your learning journey. Your batch coordinators will contact you soon with the launch links and portals.</p>
  `, `Onboarding Confirmation - ${name}`);
};

export const getOrientationTemplate = ({ name, program, orientationDate, orientationLink, instructions }) => {
  return baseLayout(`
    <h2>Hello ${name},</h2>
    <p>You have been scheduled for the Orientation process for <strong>${program}</strong>. Please find the joining details below:</p>
    <table class="info-table">
      <tr>
        <td class="label">Orientation Date/Time</td>
        <td class="value">${orientationDate}</td>
      </tr>
      <tr>
        <td class="label">Meeting Link</td>
        <td class="value"><a href="${orientationLink}" target="_blank">${orientationLink}</a></td>
      </tr>
    </table>
    ${instructions ? `
    <h3>Instructions</h3>
    <div class="quote-box" style="font-style: normal;">
      ${instructions.replace(/\n/g, "<br/>")}
    </div>` : ""}
    <div class="button-container">
      <a href="${orientationLink}" class="button" target="_blank">Join Orientation Session</a>
    </div>
    <p>Please make sure to join on time and from a quiet location with a stable internet connection.</p>
  `, `Orientation Details - ${name}`);
};
