import api from "./axios";

export const listStudents = (view) =>
  api.get("/students", { params: view ? { view } : {} }).then((r) => (Array.isArray(r.data) ? r.data : r.data?.data || []));

export const getStudentSummary = (config = {}) => api.get("/students/summary", config).then((r) => r.data);

export const getStudent = (id) => api.get(`/students/${id}`).then((r) => r.data);

export const createStudent = (payload) => api.post("/students", payload).then((r) => r.data);

export const generatePaymentLink = (id, amount) =>
  api.post(`/students/${id}/payment-link`, { amount }).then((r) => r.data);

export const addPayment = (id, payload) =>
  api.post(`/students/${id}/payments`, payload).then((r) => r.data);

export const punchOrder = (id, payload) =>
  api.post(`/students/${id}/punch-order`, payload).then((r) => r.data);

export const enrollStudent = (id, payload = {}) => api.post(`/students/${id}/enroll`, payload).then((r) => r.data);

export const cancelStudent = (id) => api.post(`/students/${id}/cancel`).then((r) => r.data);

export const misApprove = (id) => api.post(`/students/${id}/mis-approve`).then((r) => r.data);

export const misCancel = (id) => api.post(`/students/${id}/mis-cancel`).then((r) => r.data);

export const dropStudent = (id) => api.post(`/students/${id}/drop`).then((r) => r.data);

export const updateStudent = (id, patch) => api.patch(`/students/${id}`, patch).then((r) => r.data);

export const listTransferTargets = () =>
  api.get("/students/transfer-targets").then((r) => r.data?.users || []);

export const transferStudent = (id, toUserId) =>
  api.post(`/students/${id}/transfer`, { toUserId }).then((r) => r.data);
