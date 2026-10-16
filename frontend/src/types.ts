
export interface Hotel {
  id: number;
  name: string;
  city: string;
  state?: string | null;
  country: string;
  address?: string | null;
  description: string;
  image_url: string;
  price_per_night: number;
  rating: number;
  amenities: string[];
  total_rooms: number;
}

export interface Booking {
  id: number;
  hotel_id: number;
  hotel_name: string;
  check_in: string;
  check_out: string;
  guests: number;
  rooms: number;
  nights: number;
  subtotal: number;
  taxes: number;
  total: number;
  status: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: "user" | "admin";
}
