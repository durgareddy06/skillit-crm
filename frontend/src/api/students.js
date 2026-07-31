import api from "./axios";

export const listStudents = (view, params = {}) =>
  api.get("/students", { params: { ...(view ? { view } : {}), ...params } }).then((r) => (Array.isArray(r.data) ? r.data : r.data?.data || []));

export const getStudentSummary = (params = {}) => api.get("/students/summary", { params }).then((r) => r.data);

export const getHierarchyFilters = () => api.get("/students/hierarchy-filters").then((r) => r.data);

export const getStudent = (id, context) => api.get(`/students/${id}`, { params: context ? { context } : {} }).then((r) => r.data);

export const createStudent = (payload) => api.post("/students", payload).then((r) => r.data);

export const generatePaymentLink = (id, amount) =>
  api.post(`/students/${id}/payment-link`, { amount }).then((r) => r.data);

export const cancelPaymentLink = (id, linkId) =>
  api.post(`/students/${id}/payment-link/${linkId}/cancel`).then((r) => r.data);

export const addPayment = (id, payload) =>
  api.post(`/students/${id}/payments`, payload).then((r) => r.data);

export const getPaymentInvoice = (studentId, paymentIndex) =>
  api.get(`/students/${studentId}/payments/${paymentIndex}/invoice`, { responseType: "blob" });

export const punchOrder = (id, payload) =>
  api.post(`/students/${id}/punch-order`, payload).then((r) => r.data);

export const enrollStudent = (id, payload = {}) => api.post(`/students/${id}/enroll`, payload).then((r) => r.data);

export const cancelStudent = (id) => api.post(`/students/${id}/cancel`).then((r) => r.data);

export const misApprove = (id) => api.post(`/students/${id}/mis-approve`).then((r) => r.data);

export const misCancel = (id) => api.post(`/students/${id}/mis-cancel`).then((r) => r.data);

export const dropStudent = (id) => api.post(`/students/${id}/drop`).then((r) => r.data);

export const updateStudent = (id, payload, context) => api.patch(`/students/${id}`, payload, { params: context ? { context } : {} }).then((r) => r.data);

export const listTransferTargets = () =>
  api.get("/students/transfer-targets").then((r) => r.data?.users || []);

export const transferStudent = (id, toUserId) =>
  api.post(`/students/${id}/transfer`, { toUserId }).then((r) => r.data);

export const listAllUsers = () =>
  api.get("/students/all-users").then((r) => r.data?.users || []);

export const verifyPaymentLink = (studentId, paymentLinkId, paymentId) =>
  api.post("/payments/verify-link", { studentId, paymentLinkId, paymentId }).then((r) => r.data);
