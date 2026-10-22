
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Hotel as HotelIcon,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  Users,
  Wifi,
} from "lucide-react";
import { api, clearToken, getToken, setToken } from "./api";
import type { Booking, Hotel, User } from "./types";

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      amount: number;
      currency: string;
      name: string;
      description: string;
      order_id: string;
      handler: (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => void | Promise<void>;
      modal?: { ondismiss?: () => void };
      theme?: { color: string };
    }) => {
      open: () => void;
    };
  }
}

type Page = "home" | "hotel" | "auth" | "bookings" | "admin";

const COUNTRIES = [
  "India",
  "United Arab Emirates",
  "United States",
  "United Kingdom",
];

const INDIA_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const INDIA_UTS = [
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

const ALL_INDIA_REGIONS = [...INDIA_STATES, ...INDIA_UTS];
const AMENITY_OPTIONS = [
  "Wi-Fi",
  "Pool",
  "AC",

  "Parking",
  "Restaurant",
  "Breakfast",
  "Gym",
  "Mountain View",
  "Lake View",
];
const fallbackHotels: Hotel[] = [
  {
    id: 1,
    name: "The Grand Azure Resort",
    city: "Goa",
    state: "Goa",
    country: "India",
    address: "",
    description:
      "A serene luxury escape with ocean views, elegant rooms and thoughtful hospitality.",
    image_url:
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1000&q=80",
    price_per_night: 6500,
    rating: 4.9,
    amenities: ["Wi-Fi", "Pool", "AC", "Breakfast"],
    total_rooms: 18,
  },
  {
    id: 2,
    name: "The Heritage House",
    city: "Jaipur",
    state: "Rajasthan",
    country: "India",
    address: "",
    description:      "A boutique stay inspired by traditional architecture and warm Rajasthani hospitality.",
    image_url:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1000&q=80",
    price_per_night: 4200,
    rating: 4.8,
    amenities: ["Wi-Fi", "AC", "Parking", "Restaurant"],
    total_rooms: 12,
  },
  {
    id: 3,
    name: "Mountain Vista Retreat",
    city: "Manali",
    state: "Himachal Pradesh",
    country: "India",
    address: "",
    description:
      "A peaceful mountain retreat with beautiful scenery and cosy, comfortable rooms.",
    image_url:
      "https://images.unsplash.com/photo-1518732714860-b62714ce0c59?auto=format&fit=crop&w=1000&q=80",
    price_per_night: 3800,
    rating: 4.7,
    amenities: ["Wi-Fi", "Mountain View", "AC"],
    total_rooms: 10,
  },
  {
    id: 4,
    name: "Palm Garden Suites",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    address: "",
    description:
      "Contemporary comfort, spacious suites and convenient access to city attractions.",
    image_url:
      "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1000&q=80",
    price_per_night: 5400,
    rating: 4.6,
    amenities: ["Wi-Fi", "Pool", "AC", "Gym"],
    total_rooms: 15,
  },
  {
    id: 5,
    name: "Lakeview Serenity",
    city: "Udaipur",
    state: "Rajasthan",
    country: "India",
    address: "",
    description:
      "An intimate lakeside hideaway for a memorable and relaxing holiday.",
    image_url:
      "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1000&q=80",
    price_per_night: 7200,
    rating: 4.9,
    amenities: ["Wi-Fi", "Lake View", "Restaurant"],
    total_rooms: 8,
  },
  {
    id: 6,
    name: "Urban Nest Hotel",
    city: "Delhi",
    state: "Delhi",
    country: "India",
    address: "",
    description:
      "A stylish city stay combining practical amenities with a welcoming atmosphere.",
    image_url:
      "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1000&q=80",
    price_per_night: 3200,
    rating: 4.5,
    amenities: ["Wi-Fi", "AC", "Parking"],
    total_rooms: 20,
  },
];

const dateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const dayAfter = new Date(today);
dayAfter.setDate(today.getDate() + 2);

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

function App() {
  const navigate = useNavigate();
  

  const [page, setPageState] = useState<Page>("home");
  const [hotels, setHotels] = useState<Hotel[]>(fallbackHotels);
  const [selected, setSelected] = useState<Hotel | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [query, setQuery] = useState("");
  const [checkIn, setCheckIn] = useState(dateString(tomorrow));
  const [checkOut, setCheckOut] = useState(dateString(dayAfter));
  const [guests, setGuests] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [maxPrice, setMaxPrice] = useState("15000");
  const [minRating, setMinRating] = useState("0");
  const [country, setCountry] = useState("India");
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [hotelFilter, setHotelFilter] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [sort, setSort] = useState("recommended");
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [registerMode, setRegisterMode] = useState(false);
  const [bookingHotel, setBookingHotel] = useState<Hotel | null>(null);

  useEffect(() => {
    api.hotels()
      .then(setHotels)
      .catch(() =>
        setMessage("Demo mode: showing sample hotels until the API is available.")
      );

    if (getToken()) {
      api.me()
        .then(setUser)
        .catch(() => clearToken());
    }
  }, []);



  // The location dropdowns are dependent: country -> state/UT -> city -> hotel.
  const countryHotels = hotels.filter(
    (hotel) => hotel.country.toLowerCase() === country.toLowerCase()
  );

  const availableStates =
    country === "India"
      ? ALL_INDIA_REGIONS
      : Array.from(
          new Set<string>(
            countryHotels
              .map((hotel) => hotel.state)
              .filter((state): state is string => Boolean(state))
          )
        ).sort((a, b) => a.localeCompare(b));

  const stateHotels = countryHotels.filter(
    (hotel) =>
      !stateFilter ||
      (hotel.state ?? "").toLowerCase() === stateFilter.toLowerCase()
  );

  const availableCities = Array.from(
    new Set<string>(stateHotels.map((hotel) => hotel.city).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const cityHotels = stateHotels.filter(
    (hotel) =>
      !cityFilter || hotel.city.toLowerCase() === cityFilter.toLowerCase()
  );

  const availableHotels = [...cityHotels].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const filteredHotels = hotels
    .filter((hotel) => {
      const matchesCountry =
        hotel.country.toLowerCase() === country.toLowerCase();
      const matchesState =
        !stateFilter ||
        (hotel.state ?? "").toLowerCase() === stateFilter.toLowerCase();
      const matchesCity =
        !cityFilter || hotel.city.toLowerCase() === cityFilter.toLowerCase();
      const matchesHotel =
        !hotelFilter || String(hotel.id) === hotelFilter;
      const searchText = [
        hotel.name,
        hotel.city,
        hotel.state ?? "",
        hotel.country,
        hotel.address ?? "",
      ]
        .join(" ")
        .toLowerCase();
      const matchesQuery = searchText.includes(query.trim().toLowerCase());
      const matchesPrice =
        hotel.price_per_night <= Number(maxPrice || Infinity);
      const matchesRating = hotel.rating >= Number(minRating);
      const matchesAmenities = selectedAmenities.every((selectedAmenity) =>
        hotel.amenities.some(
          (item) => item.toLowerCase() === selectedAmenity.toLowerCase()
        )
      );

      return (
        matchesCountry &&
        matchesState &&
        matchesCity &&
        matchesHotel &&
        matchesQuery &&
        matchesPrice &&
        matchesRating &&
        matchesAmenities
      );
    })
    .sort((a, b) => {
      if (sort === "price-asc") return a.price_per_night - b.price_per_night;
      if (sort === "price-desc") return b.price_per_night - a.price_per_night;
      return b.rating - a.rating;
    });
  function setPage(nextPage: Page) {
    setPageState(nextPage);

    const routes: Record<Page, string> = {
      home: "/",
      hotel: selected ? `/hotels/${selected.id}` : "/hotels",
      auth: "/login",
      bookings: "/my-bookings",
      admin: "/admin",
    };

    navigate(routes[nextPage]);
  }
  function toggleAmenity(value: string) {
    setSelectedAmenities((previous) =>
      previous.includes(value)
        ? previous.filter((item) => item !== value)
        : [...previous, value]
    );
  }
  
  function clearFilters() {
    setQuery("");
    setCountry("India");
    setStateFilter("");
    setCityFilter("");
    setHotelFilter("");
    setSelectedAmenities([]);
    setMaxPrice("15000");
    setMinRating("0");
    setSort("recommended");
  }

  function openHotel(hotel: Hotel) {
    setSelected(hotel);
    setBookingHotel(null);
    setMessage("");
    setError("");
    setPage("hotel");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goHome() {
    setPage("home");
    setSelected(null);
    setBookingHotel(null);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function showBookings() {
    setError("");
    setMessage("");

    if (!user) {
      setPage("auth");
      setMessage("Please sign in to view your bookings.");
      return;
    }

    setBusy(true);
    try {
      setBookings(await api.bookings());
      setPage("bookings");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to load bookings."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (registerMode) {
        await api.register(fullName, email, password);
      }

      const result = await api.login(email, password);
      setToken(result.access_token);
      const currentUser = await api.me();
      setUser(currentUser);
      setPassword("");
      setMessage("Welcome to StayEase!");
      setPage("home");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Authentication failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleBooking(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!user) {
      setPage("auth");
      setMessage("Please sign in before making a booking.");
      return;
    }

    const hotel = bookingHotel ?? selected;

    if (!hotel) {
      setError("Please select a hotel first.");
      return;
    }

    if (!checkIn || !checkOut || checkOut <= checkIn) {
      setError("Please select valid check-in and check-out dates.");
      return;
    }

    if (checkIn < dateString(new Date())) {
      setError("Check-in cannot be in the past.");
      return;
    }

    if (!window.Razorpay) {
      setError(
        "Razorpay checkout did not load. Please refresh the page and try again."
      );
      return;
    }

    setBusy(true);

    try {
      // Create a temporary room hold and Razorpay order on the backend.
      const hold = await api.createBookingHold({
        hotel_id: hotel.id,
        check_in: checkIn,
        check_out: checkOut,
        rooms_count: rooms,
      });

      const checkout = new window.Razorpay({
        key: hold.razorpay_key_id,
        amount: hold.amount,
        currency: hold.currency,
        name: "StayEase",
        description: `Booking at ${hotel.name}`,
        order_id: hold.razorpay_order_id,
        handler: async (response) => {
          setBusy(true);
          setError("");
          setMessage("Payment received. Verifying payment...");

          try {
            const result = await api.verifyBookingPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (result.status !== "confirmed") {
              throw new Error(
                "Payment verification is not complete. Please contact support."
              );
            }

            setMessage(
              `Payment successful! Booking #${result.reservation_id} confirmed.`
            );
            setBookingHotel(null);

            // Refresh the existing bookings list if it is available.
            try {
              setBookings(await api.bookings());
            } catch {
              // The payment was verified; a bookings refresh failure
              // should not change the payment result.
            }
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : "Payment verification failed. Please contact support."
            );
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setMessage(
              "Payment window closed. Your booking is not confirmed."
            );
          },
        },
        theme: { color: "#b88a44" },
      });

      checkout.open();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to start payment."
      );
      setBusy(false);
    }
  }

  async function cancelBooking(id: number) {
    setError("");
    setMessage("");

    try {
      const updated = await api.cancelBooking(id);
      setBookings((old) =>
        old.map((booking) => (booking.id === id ? updated : booking))
      );
      setMessage(`Booking #${id} cancelled.`);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Cancellation failed."
      );
    }
  }

  function logout() {
    clearToken();
    setUser(null);
    setBookings([]);
    setPassword("");
    setMessage("You have signed out.");
    setError("");
    setPage("home");
    setSelected(null);
    setBookingHotel(null);
  }

  const nightCount = Math.max(
    1,
    Math.round(
      (new Date(`${checkOut}T00:00:00`).getTime() -
        new Date(`${checkIn}T00:00:00`).getTime()) /
        86400000
    )
  );

  return (
    <>
      <header className="container navbar">
        <button className="link-button brand" onClick={goHome}>
          Stay<span>Ease</span>
        </button>

        <nav className="navlinks" aria-label="Main navigation">
          <button className="desktop-only" onClick={goHome}>
            Explore
          </button>

          {user && (
            <button onClick={showBookings} disabled={busy}>
              My Bookings
            </button>
          )}

          {user?.role === "admin" && (
            <button onClick={() => setPage("admin")}>
              Admin
            </button>
          )}

          {user ? (
            <button
              className="btn btn-light"
              type="button"
              onClick={logout}
              disabled={busy}
            >
              Sign out
            </button>
          ) : (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                setError("");
                setMessage("");
                setPage("auth");
              }}
            >
              Sign in
            </button>
          )}
        </nav>
      </header>

      <main className="container">
        {page === "home" && (
          <>
            <section className="hero">
              <div className="eyebrow">A better way to get away</div>
              <h1>Find your perfect stay.</h1>
              <p>
                Thoughtfully selected stays, memorable destinations and a
                smoother way to plan your next escape.
              </p>
              <div>
                <button
                  className="btn btn-gold"
                  onClick={() =>
                    document.getElementById("discover")?.scrollIntoView({
                      behavior: "smooth",
                    })
                  }
                >
                  Discover stays <ArrowRight size={17} />
                </button>
              </div>
            </section>

            <form
              className="search-panel"
              onSubmit={(e) => {
                e.preventDefault();
                setSearched(true);
                document.getElementById("discover")?.scrollIntoView({
                  behavior: "smooth",
                });
              }}

            >

              <div className="field">
                <label><MapPin size={14} /> Country</label>
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setStateFilter("");
                    setCityFilter("");
                    setHotelFilter("");
                  }}
                >
                  {COUNTRIES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>State / UT</label>
                <select
                  value={stateFilter}
                  onChange={(e) => {
                    setStateFilter(e.target.value);
                    setCityFilter("");
                    setHotelFilter("");
                  }}
                >
                  <option value="">All states / UTs</option>
                  {availableStates.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>City</label>
                <select
                  value={cityFilter}
                  onChange={(e) => {
                    setCityFilter(e.target.value);
                    setHotelFilter("");
                  }}
                  
                >
                  <option value="">All cities</option>
                  {availableCities.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Hotel name / address</label>
                <select
                  value={hotelFilter}
                  onChange={(e) => setHotelFilter(e.target.value)}
                  disabled={!cityFilter || availableHotels.length === 0}
                >
                  <option value="">All hotels</option>
                  {availableHotels.map((hotel) => (
                    <option key={hotel.id} value={String(hotel.id)}>
                      {hotel.name}{hotel.address ? ` — ${hotel.address}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label><CalendarDays size={14} /> Check-in</label>
                <input
                  type="date"
                  min={dateString(today)}
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label><CalendarDays size={14} /> Check-out</label>
                <input                  type="date"
                  min={dateString(
                    new Date(new Date(`${checkIn}T00:00:00`).getTime() + 86400000)
                  )}
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label><Users size={14} /> Guests</label>
                <select
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} guest{n > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <button className="btn btn-gold" type="submit">
                <Search size={17} /> Search
              </button>
            </form>

            <section className="section" id="discover">
              <div className="section-head">
                <div>
                  <div className="eyebrow">Curated for you</div>
                  <h2>Stays worth discovering</h2>
                  <p className="muted">
                    Find the right place for your next journey.
                  </p>
                </div>
                <span className="muted">
                  {filteredHotels.length} properties
                </span>
              </div>

              <div className="form-grid" style={{ marginBottom: 24 }}>
                <div className="field">
                  <label>Maximum price per night</label>
                  <select
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                  >
                    <option value="3000">Up to ₹3,000</option>
                    <option value="5000">Up to ₹5,000</option>
                    <option value="8000">Up to ₹8,000</option>
                    <option value="15000">Any listed price</option>
                  </select>
                </div>

                <div className="field">
                  <label>Minimum rating</label>
                  <select
                    value={minRating}
                    onChange={(e) => setMinRating(e.target.value)}
                  >
                    <option value="0">All ratings</option>
                    <option value="4.5">4.5 and above</option>
                    <option value="4.8">4.8 and above</option>
                  </select>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Amenities (select multiple)</label>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: 12,
                      marginTop: 10,
                    }}
                  >
                    {AMENITY_OPTIONS.map((item) => (
                      <label
                        key={item}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontWeight: 400,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedAmenities.includes(item)}
                          onChange={() => toggleAmenity(item)}
                          style={{
                            width: 18,
                            height: 18,
                            flexShrink: 0,
                            accentColor: "#0f766e",
                            cursor: "pointer",
                          }}
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <label>Sort by</label>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="recommended">Recommended</option>
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                    <option value="rating">Top rated</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
                <button className="btn btn-light" type="button" onClick={clearFilters}>
                  Clear all filters
                </button>
              </div>
              {message && <p className="notice">{message}</p>}
              {error && <p className="error">{error}</p>}

              {filteredHotels.length ? (
                <div className="grid-hotels">
                  {filteredHotels.map((hotel) => (
                    <article className="hotel-card" key={hotel.id}>
                      <button
                        className="link-button"
                        style={{ width: "100%", textAlign: "left" }}
                        onClick={() => openHotel(hotel)}
                      >
                        <img
                          className="hotel-image"
                          src={hotel.image_url}
                          alt={hotel.name}
                          loading="lazy"
                        />
                        <div className="hotel-content">
                          <div className="row-between">
                            <span className="hotel-location">
                              <MapPin size={13} />
                              {hotel.city}{hotel.state ? `, ${hotel.state}` : ""}, {hotel.country}
                            </span>
                            <span className="rating">
                              <Star size={14} fill="currentColor" />
                              {hotel.rating.toFixed(1)}
                            </span>
                          </div>

                          <h3 className="hotel-title">{hotel.name}</h3>

                          <div className="chips">
                            {hotel.amenities.slice(0, 3).map((item) => (
                              <span className="chip" key={item}>
                                {item}
                              </span>
                            ))}
                          </div>

                          <div className="hotel-bottom">
                            <div className="price">
                              {money(hotel.price_per_night)}
                              <small> / night</small>
                            </div>
                            <span className="muted">View stay →</span>
                          </div>
                        </div>
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <HotelIcon size={36} />
                  <h3>No matching hotels found</h3>
                  <p>Try changing the destination or filters.</p>
                  <button
                    className="btn btn-light"
                    onClick={() => {
                      clearFilters();
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}

              {searched && (
                <p className="muted" style={{ marginTop: 16 }}>
                  Search dates: {checkIn} to {checkOut}. Final availability is
                  checked by the backend when you book.
                </p>
              )}
            </section>

            <section
              className="section"
              style={{
                background: "#f8f5ef",
                padding: 30,
                borderRadius: 16,
              }}
            >
              <div className="eyebrow">Travel with confidence</div>
              <h2>Every detail, thoughtfully considered.</h2>
              <div className="grid-hotels">
                <div className="panel">
                  <ShieldCheck size={26} />
                  <h3>Secure booking</h3>
                  <p className="muted">
                    Your booking requests are processed by the server.
                  </p>
                </div>
                <div className="panel">
                  <Wifi size={26} />
                  <h3>Comfort that matters</h3>
                  <p className="muted">
                    Explore stays with the amenities you need.
                  </p>
                </div>
                <div className="panel">
                  <Check size={26} />
                  <h3>Clear pricing</h3>
                  <p className="muted">
                    Review the price breakdown before confirming.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

        {page === "hotel" && selected && (
          <section className="section">
            <button className="btn btn-light" onClick={goHome}>
              ← Back to stays
            </button>

            <img
              src={selected.image_url}
              alt={selected.name}
              style={{
                width: "100%",
                height: 360,
                objectFit: "cover",
                borderRadius: 16,
                marginTop: 20,
              }}
            />

            <div className="two-col" style={{ marginTop: 28 }}>
              <div>
                <div className="eyebrow">
                  {selected.city}{selected.state ? `, ${selected.state}` : ""}, {selected.country}
                </div>
                <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}>
                  {selected.name}
                </h1>
                <div className="rating">
                  <Star size={17} fill="currentColor" />
                  {selected.rating.toFixed(1)} guest rating
                </div>
                <p className="muted" style={{ marginTop: 20 }}>
                  {selected.description}
                </p>
                <h3>What this stay offers</h3>
                <div className="chips">
                  {selected.amenities.map((item) => (
                    <span className="chip" key={item}>{item}</span>
                  ))}
                </div>
                <p className="muted" style={{ marginTop: 24 }}>
                  Room availability is verified by the backend at booking
                  time. Hotel photographs and descriptions in the starter demo
                  are illustrative.
                </p>
              </div>

              <div className="panel">
                <div className="price">
                  {money(selected.price_per_night)} <small>/ night</small>
                </div>
                <p className="muted">
                  Taxes calculated by the server at checkout.
                </p>

                {error && <p className="error">{error}</p>}
                {message && <p className="success">{message}</p>}

                {!bookingHotel ? (
                  <button
                    className="btn btn-primary"
                    style={{ width: "100%" }}
                    onClick={() => {
                      setError("");
                      setMessage("");
                      setBookingHotel(selected);
                    }}
                  >
                    Reserve your stay <ArrowRight size={17} />
                  </button>
                ) : (
                  <form className="stack" onSubmit={handleBooking}>
                    <div className="field">
                      <label>Check-in</label>
                      <input
                        type="date"
                        min={dateString(today)}
                        value={checkIn}
                        onChange={(e) => {
                          const nextCheckIn = e.target.value;
                          setCheckIn(nextCheckIn);

                          if (checkOut <= nextCheckIn) {
                            const nextDay = new Date(`${nextCheckIn}T00:00:00`);
                            nextDay.setDate(nextDay.getDate() + 1);
                            setCheckOut(dateString(nextDay));
                          }
                       }}
                        required
                      />
                    </div>

                    <div className="field">
                      <label>Check-out</label>
                      <input
                        type="date"
                        min={dateString(
                          new Date(new Date(`${checkIn}T00:00:00`).getTime() + 86400000)
                        )}
                        value={checkOut}
                        onChange={(e) => setCheckOut(e.target.value)}
                        required
                      />
                    </div>

                    <div className="field">
                      <label>Number of guests</label>
                      <select
                        value={guests}
                        onChange={(e) => setGuests(Number(e.target.value))}
                      >
                        
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}

                      </select>
                    </div>

                    <div className="field">
                      <label>Rooms</label>
                      <select
                        value={rooms}
                        onChange={(e) => setRooms(Number(e.target.value))}
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>

                    <hr />

                    <div className="row-between">
                      <span>
                        {money(selected.price_per_night)} × {nightCount} nights
                        × {rooms} rooms
                      </span>
                      <strong>
                        {money(
                          selected.price_per_night * nightCount * rooms
                        )}
                      </strong>
                    </div>

                    <p className="muted">
                      Estimated subtotal only. The server calculates the
                      authoritative total and tax.
                    </p>

                    <button
                      className="btn btn-gold"
                      type="submit"
                      disabled={busy}
                    >
                      {busy
                        ? "Processing..."
                        : user
                          ? "Pay Now"
                          : "Sign in to continue"}
                    </button>

                    <button
                      className="btn btn-light"
                      type="button"
                      disabled={busy}
                      onClick={() => setBookingHotel(null)}
                    >
                      Back
                    </button>
                  </form>
                )}
              </div>
            </div>
          </section>
        )}

        {page === "auth" && (
          <section
            className="section"
            style={{ maxWidth: 520, marginInline: "auto" }}
          >
            <div className="eyebrow">Welcome to StayEase</div>
            <h2>
              {registerMode ? "Create your account" : "Sign in to continue"}
            </h2>
            <p className="muted">
              Manage your stays and keep your travel plans in one place.
            </p>

            {error && <p className="error">{error}</p>}
            {message && <p className="notice">{message}</p>}

            <form className="panel stack" onSubmit={handleAuth}>
              {registerMode && (
                <div className="field">
                  <label>Full name</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    minLength={2}
                  />
                </div>
              )}

              <div className="field">
                <label>Email address</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  autoComplete={
                    registerMode ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={busy}
              >
                {busy
                  ? "Please wait..."
                  : registerMode
                    ? "Create account"
                    : "Sign in"}
              </button>

              <button
                className="link-button"
                type="button"
                onClick={() => {
                  setRegisterMode(!registerMode);
                  setError("");
                  setMessage("");
                }}
              >
                {registerMode
                  ? "Already registered? Sign in"
                  : "New to StayEase? Create an account"}
              </button>

              <p className="muted">
                Registration creates an ordinary customer account. Admin
                privileges cannot be selected here.
              </p>
            </form>
          </section>
        )}

        {page === "bookings" && (
          <section className="section">
            <div className="eyebrow">Your travel plans</div>
            <h2>My Bookings</h2>

            {error && <p className="error">{error}</p>}
            {message && <p className="success">{message}</p>}
            {busy && <p className="muted">Loading bookings...</p>}

            {!bookings.length && !busy ? (
              <div className="empty">
                <CalendarDays size={36} />
                <h3>No bookings yet</h3>
                <p>When you make a booking, it will appear here.</p>
                <button className="btn btn-primary" onClick={goHome}>
                  Explore hotels
                </button>
              </div>
            ) : (
              <div className="stack">
                {bookings.map((booking) => (
                  <article className="panel" key={booking.id}>
                    <div className="row-between">
                      <div>
                        <h3>{booking.hotel_name}</h3>
                        <p className="muted">Booking #{booking.id}</p>
                      </div>
                      <span className="chip">{booking.status}</span>
                    </div>

                    <p>{booking.check_in} → {booking.check_out}</p>
                    <p className="muted">
                      {booking.nights} nights · {booking.guests} guests ·{" "}
                      {booking.rooms} room(s)
                    </p>

                    <div className="row-between">
                      <strong>{money(booking.total)}</strong>
                      {["pending", "confirmed"].includes(booking.status) && (
                        <button
                          className="btn btn-light"
                          onClick={() => cancelBooking(booking.id)}
                        >
                          Cancel booking
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {page === "admin" && (
          <section className="section">
            <div className="eyebrow">Management</div>
            <h2>Admin Dashboard</h2>
            <p className="muted">
              The API verifies your admin role on protected endpoints.
            </p>
            <AdminPanel />
          </section>
        )}
      </main>

      <footer className="footer">
        <div className="container">
          <div className="brand" style={{ color: "white" }}>
            Stay<span>Ease</span>
          </div>
          <p>Beautiful stays. Thoughtful journeys.</p>
          <p style={{ fontSize: ".8rem" }}>
            Portfolio demonstration. Sample listings may not represent real
            bookable properties.
          </p>
        </div>
      </footer>
    </>
  );
}

function AdminPanel() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.adminStats()
      .then(setStats)
      .catch((e) => {
        setError(
          e instanceof Error
            ? e.message
            : "Could not load admin statistics"
        );
      });
  }, []);

  if (error) {
    return (
      <p className="error">
        {error}. Sign in with an authorized admin account.
      </p>
    );
  }

  if (!stats) {
    return <p className="muted">Loading dashboard...</p>;
  }

  return (
    <div className="grid-hotels">
      {Object.entries(stats).map(([key, value]) => (
        <div className="panel" key={key}>
          <div className="muted">{key.replace(/_/g, " ")}</div>
          <h2>{value}</h2>
        </div>
      ))}
    </div>
  );
}
export default App;


