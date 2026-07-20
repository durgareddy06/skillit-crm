import api from "./axios";

export const loginRequest = async (phone, password) => {
  const response = await api.post("/auth/login", { phone, password });
  return response.data;
};

export const fetchMe = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};
