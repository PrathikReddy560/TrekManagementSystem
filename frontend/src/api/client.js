const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  health: () => request("/api/health"),

  searchTreks: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    ).toString();
    return request(`/api/treks${qs ? `?${qs}` : ""}`);
  },
  getTrek: (id) => request(`/api/treks/${id}`),
  getStays: (id) => request(`/api/treks/${id}/stays`),

  signup: (payload) => request("/api/auth/signup", { method: "POST", body: payload }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: payload }),

  createBooking: (payload, token) => request("/api/bookings", { method: "POST", body: payload, token }),
  myBookings: (token) => request("/api/bookings/my", { token }),

  planTrip: (payload) => request("/api/ai/plan", { method: "POST", body: payload }),
  planDemoTrip: (payload) => request("/api/trip-demo/plan", { method: "POST", body: payload }),
  scheduleTripReminders: (payload) => request("/api/trip-demo/reminders", { method: "POST", body: payload }),
  createTrek: (payload, token) => request("/api/treks", { method: "POST", body: payload, token }),
  deleteTrek: (id, token) => request(`/api/treks/${id}`, { method: "DELETE", token }),
  adminOverview: (token) => request("/api/admin/overview", { token }),
  askAdminAdvisor: (question, token) => request("/api/admin/ask", { method: "POST", body: { question }, token }),
};
