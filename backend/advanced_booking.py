
import os
import hmac
import hashlib
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation

import razorpay
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Hotel, User
from advanced_models import BookingReservation, PaymentRecord
from auth import get_current_user

load_dotenv()

router = APIRouter(
    prefix="/api/advanced",
    tags=["Advanced Booking"],
)

HOLD_MINUTES = int(os.getenv("BOOKING_HOLD_MINUTES", "10"))

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
    raise RuntimeError(
        "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env"
    )

razorpay_client = razorpay.Client(
    auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)
)


def now_utc():
    return datetime.now(timezone.utc)


class HoldRequest(BaseModel):
    hotel_id: int
    check_in: datetime
    check_out: datetime
    rooms_count: int = Field(ge=1, le=10)


class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


def available_rooms(
    db: Session,
    hotel_id: int,
    check_in,
    check_out,
) -> int:
    """Calculate rooms remaining for the requested date range."""
    hotel = db.get(Hotel, hotel_id)

    if not hotel:
        raise HTTPException(
            status_code=404,
            detail="Hotel not found",
        )

    current = now_utc()

    overlapping = db.execute(
        select(
            func.coalesce(
                func.sum(BookingReservation.rooms_count),
                0,
            )
        ).where(
            BookingReservation.hotel_id == hotel_id,
            BookingReservation.check_in < check_out,
            BookingReservation.check_out > check_in,
            (
                (BookingReservation.status == "confirmed")
                | (
                    (BookingReservation.status == "held")
                    & (BookingReservation.expires_at > current)
                )
            ),
        )
    ).scalar_one()

    return max(
        0,
        int(hotel.total_rooms) - int(overlapping),
    )


@router.get("/availability")
def check_availability(
    hotel_id: int,
    check_in: datetime,
    check_out: datetime,
):
    """Check room availability for the selected dates."""
    if check_out.date() <= check_in.date():
        raise HTTPException(
            status_code=400,
            detail="Check-out must be after check-in",
        )

    with SessionLocal() as db:
        rooms = available_rooms(
            db,
            hotel_id,
            check_in.date(),
            check_out.date(),
        )

        return {
            "hotel_id": hotel_id,
            "available_rooms": rooms,
        }


@router.post("/holds")
def create_hold(
    data: HoldRequest,
    user: User = Depends(get_current_user),
):
    """Create a temporary booking hold and a Razorpay order."""
    check_in = data.check_in.date()
    check_out = data.check_out.date()

    if check_out <= check_in:
        raise HTTPException(
            status_code=400,
            detail="Invalid check-in/check-out dates",
        )

    if check_in < now_utc().date():
        raise HTTPException(
            status_code=400,
            detail="Check-in cannot be in the past",
        )

    with SessionLocal() as db:
        try:
            # Lock the hotel row while checking availability.
            hotel = db.execute(
                select(Hotel)
                .where(Hotel.id == data.hotel_id)
                .with_for_update()
            ).scalar_one_or_none()

            if not hotel:
                raise HTTPException(
                    status_code=404,
                    detail="Hotel not found",
                )

            rooms = available_rooms(
                db,
                data.hotel_id,
                check_in,
                check_out,
            )

            if rooms < data.rooms_count:
                raise HTTPException(
                    status_code=409,
                    detail="Not enough rooms available",
                )

            nights = (check_out - check_in).days

            try:
                nightly_price = Decimal(
                    str(hotel.price_per_night)
                )
            except (InvalidOperation, TypeError, ValueError):
                raise HTTPException(
                    status_code=500,
                    detail="Invalid hotel price configuration",
                )

            total = (
                nightly_price
                * nights
                * data.rooms_count
            )

            if not total.is_finite() or total <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Booking amount must be greater than zero",
                )

            amount_paise = int(total * 100)

            if amount_paise <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="Booking amount must be greater than zero",
                )

            reservation = BookingReservation(
                user_id=user.id,
                hotel_id=data.hotel_id,
                check_in=check_in,
                check_out=check_out,
                rooms_count=data.rooms_count,
                amount=total,
                currency="INR",
                status="held",
                expires_at=now_utc()
                + timedelta(minutes=HOLD_MINUTES),
            )

            db.add(reservation)
            db.flush()

            # Create the Razorpay order for the booking.
            order = razorpay_client.order.create(
                {
                    "amount": amount_paise,
                    "currency": "INR",
                    "receipt": f"stay-{reservation.id}",
                    "notes": {
                        "reservation_id": str(reservation.id),
                        "user_id": str(user.id),
                    },
                }
            )

            payment = PaymentRecord(
                reservation_id=reservation.id,
                order_id=order["id"],
                amount_paise=amount_paise,
                currency="INR",
                status="created",
            )

            db.add(payment)
            db.commit()

            return {
                "reservation_id": reservation.id,
                "expires_at": reservation.expires_at.isoformat(),
                "razorpay_order_id": order["id"],
                "razorpay_key_id": RAZORPAY_KEY_ID,
                "amount": amount_paise,
                "currency": "INR",
            }

        except Exception:
            db.rollback()
            raise


@router.post("/verify-payment")
def verify_payment(
    data: PaymentVerifyRequest,
    user: User = Depends(get_current_user),
):
    """Verify Razorpay payment and confirm the user's booking."""
    expected_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        (
            f"{data.razorpay_order_id}|"
            f"{data.razorpay_payment_id}"
        ).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(
        expected_signature,
        data.razorpay_signature,
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid payment signature",
        )

    with SessionLocal() as db:
        try:
            payment = db.execute(
                select(PaymentRecord)
                .where(
                    PaymentRecord.order_id
                    == data.razorpay_order_id
                )
                .with_for_update()
            ).scalar_one_or_none()

            if not payment:
                raise HTTPException(
                    status_code=404,
                    detail="Payment order not found",
                )

            reservation = db.execute(
                select(BookingReservation)
                .where(
                    BookingReservation.id
                    == payment.reservation_id
                )
                .with_for_update()
            ).scalar_one_or_none()

            if not reservation:
                raise HTTPException(
                    status_code=404,
                    detail="Reservation not found",
                )

            # Prevent a user from verifying another user's booking.
            if reservation.user_id != user.id:
                raise HTTPException(
                    status_code=403,
                    detail="You cannot verify another user's booking",
                )

            # Make repeated verification requests safe.
            if (
                payment.status == "captured"
                and reservation.status == "confirmed"
            ):
                return {
                    "status": "confirmed",
                    "reservation_id": reservation.id,
                }

            if payment.status == "captured":
                raise HTTPException(
                    status_code=409,
                    detail="Payment is captured but booking is not confirmed; reconciliation is required",
                )

            if (
                reservation.status != "held"
                or reservation.expires_at <= now_utc()
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Booking hold expired. Payment may need "
                        "reconciliation; booking was not confirmed."
                    ),
                )

            # Verify the payment against Razorpay's server-side record.
            rp_payment = razorpay_client.payment.fetch(
                data.razorpay_payment_id
            )

            if rp_payment.get("order_id") != payment.order_id:
                raise HTTPException(
                    status_code=400,
                    detail="Payment/order mismatch",
                )

            if int(rp_payment.get("amount", -1)) != payment.amount_paise:
                raise HTTPException(
                    status_code=400,
                    detail="Payment amount mismatch",
                )

            if rp_payment.get("currency") != payment.currency:
                raise HTTPException(
                    status_code=400,
                    detail="Payment currency mismatch",
                )

            if rp_payment.get("status") != "captured":
                raise HTTPException(
                    status_code=409,
                    detail="Payment is not captured yet",
                )

            payment.payment_id = data.razorpay_payment_id
            payment.status = "captured"
            reservation.status = "confirmed"

            db.commit()

            return {
                "status": "confirmed",
                "reservation_id": reservation.id,
            }

        except Exception:
            db.rollback()
            raise
