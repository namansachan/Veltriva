
import math
import os
from contextlib import asynccontextmanager
from datetime import date

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from advanced_booking import router as advanced_booking_router

from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_admin,
    verify_password,
)
from database import Base, SessionLocal, engine, get_db
from models import Booking, Hotel, User
from schemas import (
    BookingInput,
    BookingOut,
    HotelOut,
    LoginInput,
    RegisterInput,
    UserOut,
)

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="StayEase API",
    description="Hotel discovery and booking API",
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(advanced_booking_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGIN", "http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

TAX_RATE = float(os.getenv("TAX_RATE", "0.12"))
if not 0 <= TAX_RATE <= 1:
    raise RuntimeError("TAX_RATE must be between 0 and 1")


@app.get("/")
def root():
    return {"name": "StayEase API", "status": "running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post(
    "/auth/register",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
)
def register(data: RegisterInput, db: Session = Depends(get_db)):
    email = str(data.email).lower()
    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(409, "Email is already registered")

    user = User(
        full_name=data.full_name.strip(),
        email=email,
        password_hash=hash_password(data.password),
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login")
def login(data: LoginInput, db: Session = Depends(get_db)):
    email = str(data.email).lower()
    user = db.scalar(select(User).where(User.email == email))

    if (
        user is None
        or not user.is_active
        or not verify_password(data.password, user.password_hash)
    ):
        raise HTTPException(401, "Invalid email or password")

    return {
        "access_token": create_access_token(user),
        "token_type": "bearer",
    }


@app.get("/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@app.get("/hotels", response_model=list[HotelOut])
def list_hotels(
    city: str | None = None,
    min_price: float = Query(0, ge=0),
    max_price: float | None = Query(None, ge=0),
    min_rating: float = Query(0, ge=0, le=5),
    amenity: str | None = None,
    sort: str = Query("rating", pattern="^(rating|price_asc|price_desc)$"),
    db: Session = Depends(get_db),
):
    stmt = select(Hotel).where(
        Hotel.is_active.is_(True),
        Hotel.price_per_night >= min_price,
        Hotel.rating >= min_rating,
    )

    if max_price is not None:
        stmt = stmt.where(Hotel.price_per_night <= max_price)

    if city and city.strip():
        stmt = stmt.where(Hotel.city.ilike(f"%{city.strip()}%"))

    if sort == "price_asc":
        stmt = stmt.order_by(Hotel.price_per_night.asc())
    elif sort == "price_desc":
        stmt = stmt.order_by(Hotel.price_per_night.desc())
    else:
        stmt = stmt.order_by(Hotel.rating.desc())

    hotels = list(db.scalars(stmt).all())

    if amenity:
        hotels = [
            hotel for hotel in hotels
            if any(
                item.lower() == amenity.strip().lower()
                for item in (hotel.amenities or [])
            )
        ]

    return hotels


@app.get("/hotels/{hotel_id}", response_model=HotelOut)
def hotel_detail(hotel_id: int, db: Session = Depends(get_db)):
    hotel = db.get(Hotel, hotel_id)
    if hotel is None or not hotel.is_active:
        raise HTTPException(404, "Hotel not found")
    return hotel


@app.post(
    "/bookings",
    response_model=BookingOut,
    status_code=status.HTTP_201_CREATED,
)
def create_booking(
    data: BookingInput,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hotel = db.get(Hotel, data.hotel_id)
    if hotel is None or not hotel.is_active:
        raise HTTPException(404, "Hotel not found")

    nights = (data.check_out - data.check_in).days
    if nights < 1 or nights > 90:
        raise HTTPException(400, "Stay must be between 1 and 90 nights")

    if data.guests > data.rooms * 4:
        raise HTTPException(400, "Maximum capacity is 4 guests per room")

    # A booking occupies inventory when its date range overlaps:
    # existing check_in < requested check_out AND
    # existing check_out > requested check_in.
    # Cancelled bookings do not consume inventory.
    try:
        overlapping = db.scalar(
            select(func.coalesce(func.sum(Booking.rooms), 0)).where(
                Booking.hotel_id == hotel.id,
                Booking.status.in_(["pending", "confirmed"]),
                Booking.check_in < data.check_out,
                Booking.check_out > data.check_in,
            )
        ) or 0

        if overlapping + data.rooms > hotel.total_rooms:
            raise HTTPException(
                409,
                "Not enough rooms available for these dates",
            )

        # Calculate the authoritative price on the server.
        # Round each currency amount to two decimal places.
        subtotal = round(hotel.price_per_night * nights * data.rooms, 2)
        taxes = round(subtotal * TAX_RATE, 2)
        total = round(subtotal + taxes, 2)

        booking = Booking(
            user_id=user.id,
            hotel_id=hotel.id,
            hotel_name=hotel.name,
            check_in=data.check_in,
            check_out=data.check_out,
            guests=data.guests,
            rooms=data.rooms,
            nights=nights,
            unit_price=hotel.price_per_night,
            subtotal=subtotal,
            taxes=taxes,
            total=total,
            status="pending",
            payment_status="unpaid",
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        return booking

    except Exception:
        db.rollback()
        raise


@app.get("/bookings", response_model=list[BookingOut])
def my_bookings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = (
        select(Booking)
        .where(Booking.user_id == user.id)
        .order_by(Booking.created_at.desc())
    )
    return list(db.scalars(stmt).all())


@app.post("/bookings/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    booking = db.get(Booking, booking_id)
    if booking is None:
        raise HTTPException(404, "Booking not found")

    if booking.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "You cannot cancel this booking")

    if booking.status == "cancelled":
        return booking

    if booking.payment_status == "paid":
        raise HTTPException(
            409,
            "Paid bookings require the configured refund workflow",
        )

    if booking.status not in ("pending", "confirmed"):
        raise HTTPException(409, "This booking cannot be cancelled")

    booking.status = "cancelled"
    db.commit()
    db.refresh(booking)
    return booking


@app.get("/admin/stats")
def admin_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return {
        "total_hotels": db.scalar(
            select(func.count()).select_from(Hotel)
        ) or 0,
        "total_bookings": db.scalar(
            select(func.count()).select_from(Booking)
        ) or 0,
        "registered_users": db.scalar(
            select(func.count()).select_from(User)
        ) or 0,
        "confirmed_bookings": db.scalar(
            select(func.count()).select_from(Booking).where(
                Booking.status == "confirmed"
            )
        ) or 0,
        "cancelled_bookings": db.scalar(
            select(func.count()).select_from(Booking).where(
                Booking.status == "cancelled"
            )
        ) or 0,
        "pending_bookings": db.scalar(
            select(func.count()).select_from(Booking).where(
                Booking.status == "pending"
            )
        ) or 0,
    }


@app.get("/admin/bookings", response_model=list[BookingOut])
def all_bookings(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return list(
        db.scalars(
            select(Booking).order_by(Booking.created_at.desc())
        ).all()
    )


@app.get("/admin/users", response_model=list[UserOut])
def all_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    return list(db.scalars(select(User).order_by(User.id)).all())
