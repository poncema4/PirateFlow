import axios from "axios";

// ─── Token Storage ──────────────────────────────────────────────────────────
export const tokenStorage = {
  getAccess: () => localStorage.getItem("pf_access"),
  getRefresh: () => localStorage.getItem("pf_refresh"),
  set: (access, refresh) => {
    if (access) localStorage.setItem("pf_access", access);
    if (refresh) localStorage.setItem("pf_refresh", refresh);
  },
  clear: () => {
    localStorage.removeItem("pf_access");
    localStorage.removeItem("pf_refresh");
    localStorage.removeItem("pf_user");
  },
};

// ─── Axios Instance ─────────────────────────────────────────────────────────
const apiClient = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Inject auth header
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 → silent refresh → retry
let isRefreshing = false;
let refreshQueue = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retried) {
      original._retried = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((newToken) => {
          original.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(original);
        });
      }

      isRefreshing = true;
      try {
        const { data } = await axios.post("/api/auth/refresh", {
          refresh_token: tokenStorage.getRefresh(),
        });
        tokenStorage.set(data.access_token, null);
        refreshQueue.forEach(({ resolve }) => resolve(data.access_token));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(original);
      } catch {
        refreshQueue.forEach(({ reject }) => reject(error));
        refreshQueue = [];
        tokenStorage.clear();
        window.location.href = "/login";
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ─── API Methods ────────────────────────────────────────────────────────────
export const api = {
  // Auth
  login: (email, password) =>
    apiClient.post("/auth/login", { email, password }).then((r) => r.data),

  studentLookup: (studentId) =>
    apiClient.post("/auth/lookup", { student_id: studentId }).then((r) => r.data),

  refreshToken: (refreshToken) =>
    apiClient.post("/auth/refresh", { refresh_token: refreshToken }).then((r) => r.data),

  getMe: () =>
    apiClient.get("/auth/me").then((r) => r.data),

  // Buildings
  getBuildings: () =>
    apiClient.get("/buildings").then((r) => r.data),

  getBuilding: (buildingId) =>
    apiClient.get(`/buildings/${buildingId}`).then((r) => r.data),

  // Rooms
  getRooms: (params = {}) =>
    apiClient.get("/rooms", { params }).then((r) => r.data),

  getRoom: (roomId) =>
    apiClient.get(`/rooms/${roomId}`).then((r) => r.data),

  getRoomAvailability: (roomId, date) =>
    apiClient.get(`/rooms/${roomId}/availability`, { params: { date } }).then((r) => r.data),

  // Bookings
  getBookings: (params = {}) =>
    apiClient.get("/bookings", { params }).then((r) => r.data),

  getBooking: (bookingId) =>
    apiClient.get(`/bookings/${bookingId}`).then((r) => r.data),

  createBooking: (body) =>
    apiClient.post("/bookings", body).then((r) => r.data),

  cancelBooking: (bookingId) =>
    apiClient.patch(`/bookings/${bookingId}/cancel`).then((r) => r.data),

  // Analytics
  getUtilization: (params = {}) =>
    apiClient.get("/analytics/utilization", { params }).then((r) => r.data),

  getHeatmap: () =>
    apiClient.get("/analytics/utilization/heatmap").then((r) => r.data),

  getRevenue: () =>
    apiClient.get("/analytics/revenue").then((r) => r.data),

  getRevenueOpportunity: () =>
    apiClient.get("/analytics/revenue/opportunity").then((r) => r.data),

  getPeakHours: () =>
    apiClient.get("/analytics/peak-hours").then((r) => r.data),

  // AI
  aiSearch: (query) =>
    apiClient.post("/ai/search", { query }).then((r) => r.data),

  getRecommendations: () =>
    apiClient.get("/ai/recommendations").then((r) => r.data),

  predict: (days = 7) =>
    apiClient.post("/ai/predict", { days }).then((r) => r.data),

  detectAnomalies: () =>
    apiClient.post("/ai/anomalies", {}).then((r) => r.data),

  // Demo
  startDemo: () =>
    apiClient.post("/demo/start").then((r) => r.data),

  stopDemo: () =>
    apiClient.post("/demo/stop").then((r) => r.data),
};

export default apiClient;
