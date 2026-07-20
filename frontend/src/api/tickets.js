import api from "./axios";

// Fetch tickets (filters active or resolved)
export async function getTickets(resolved = false) {
  const res = await api.get(`/tickets?resolved=${resolved}`);
  return res.data;
}

// Fetch a single ticket by its ID
export async function getTicketById(id) {
  const res = await api.get(`/tickets/${id}`);
  return res.data;
}

// Assign a ticket to a new department (Support, Tech, RM)
export async function assignTicket(id, department) {
  const res = await api.put(`/tickets/${id}/assign`, { department });
  return res.data;
}

// Resolve a ticket
export async function resolveTicket(id) {
  const res = await api.put(`/tickets/${id}/resolve`);
  return res.data;
}

// Send a CRM user reply to a ticket
export async function replyTicket(id, message, attachments = []) {
  const res = await api.post(`/tickets/${id}/reply`, { message, attachments });
  return res.data;
}

// Fetch Support department active tickets
export async function getSupportTickets() {
  const res = await api.get("/tickets/team/support");
  return res.data;
}

// Fetch Tech department active tickets
export async function getTechTickets() {
  const res = await api.get("/tickets/team/tech");
  return res.data;
}

// Fetch Relationship Manager department active tickets
export async function getRMTickets() {
  const res = await api.get("/tickets/team/rm");
  return res.data;
}

// Simulated webhook triggers for local testing
export async function simulateIncomingEmail(payload) {
  const res = await api.post("/webhooks/email/webhook", payload);
  return res.data;
}

export async function simulateReplySync(payload) {
  const res = await api.post("/webhooks/email/reply", payload);
  return res.data;
}
