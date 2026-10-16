
import type { Booking, Hotel, User } from "./types";


const API_URL = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");


export default API_URL;

// Authentication token
export function getToken(): string | null {
  return localStorage.getItem("stayease_token");
}

export function setToken(token: string): void {
  localStorage.setItem("stayease_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("stayease_token");
}

// Common API request handler
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;

    const message = Array.isArray(detail)
      ? detail
          .map((item: { msg?: string }) => item.msg ?? "Invalid request")
          .join(", ")
      : typeof detail === "string"
        ? detail
        : `Request failed (${response.status})`;

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// Types for advanced booking and Razorpay
export interface BookingHoldResponse {
  reservation_id: number;
  expires_at: string;
  razorpay_order_id: string;
  razorpay_key_id: string;
  amount: number;
  currency: string;
}

export interface PaymentVerificationResponse {
  status: "confirmed" | "pending";
  reservation_id: number;
}

export interface PaymentVerificationData {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export const api = {
  // Hotels
  hotels: (params = "") =>
    request<Hotel[]>(`/hotels${params ? `?${params}` : ""}`),

  hotel: (id: number) => request<Hotel>(`/hotels/${id}`),

  // Authentication
  register: (full_name: string, email: string, password: string) =>
    request<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ full_name, email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ access_token: string; token_type: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<User>("/auth/me"),

  // Existing booking APIs
  bookings: () => request<Booking[]>("/bookings"),

  createBooking: (data: {
    hotel_id: number;
    check_in: string;
    check_out: string;
    guests: number;
    rooms: number;
  }) =>
    request<Booking>("/bookings", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  cancelBooking: (id: number) =>
    request<Booking>(`/bookings/${id}/cancel`, {
      method: "POST",
    }),

  // Admin
  adminStats: () => request<Record<string, number>>("/admin/stats"),

  // Advanced booking: temporary room hold + Razorpay order
  createBookingHold: (data: {
    hotel_id: number;
    check_in: string;
    check_out: string;
    rooms_count: number;
  }) =>
    request<BookingHoldResponse>("/api/advanced/holds", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Call only after receiving Razorpay checkout response.
  // The backend must verify the signature and fetch payment status
  // directly from Razorpay before confirming the reservation.
  verifyBookingPayment: (data: PaymentVerificationData) =>
    request<PaymentVerificationResponse>("/api/advanced/verify-payment", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
