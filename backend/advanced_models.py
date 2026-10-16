
from datetime import datetime, timezone
from sqlalchemy import (
    String, Integer, Date, DateTime, ForeignKey,
    Numeric, UniqueConstraint, CheckConstraint
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


def utc_now():
    return datetime.now(timezone.utc)


class BookingReservation(Base):
    __tablename__ = "booking_reservations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )
    hotel_id: Mapped[int] = mapped_column(
        ForeignKey("hotels.id"), nullable=False, index=True
    )

    check_in: Mapped[datetime] = mapped_column(Date, nullable=False)
    check_out: Mapped[datetime] = mapped_column(Date, nullable=False)
    rooms_count: Mapped[int] = mapped_column(Integer, nullable=False)

    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), default="INR", nullable=False
    )

    # held -> confirmed / expired / cancelled
    status: Mapped[str] = mapped_column(
        String(20), default="held", nullable=False, index=True
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    __table_args__ = (
        CheckConstraint("rooms_count > 0", name="ck_reservation_rooms"),
        CheckConstraint("check_out > check_in", name="ck_reservation_dates"),
        CheckConstraint("amount > 0", name="ck_reservation_amount"),
    )


class PaymentRecord(Base):
    __tablename__ = "payment_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    reservation_id: Mapped[int] = mapped_column(
        ForeignKey("booking_reservations.id"),
        nullable=False,
        unique=True,
        index=True,
    )

    # One reservation has one Razorpay order in this initial design.
    provider: Mapped[str] = mapped_column(
        String(20), default="razorpay", nullable=False
    )
    order_id: Mapped[str] = mapped_column(
        String(100), nullable=False, unique=True
    )
    payment_id: Mapped[str | None] = mapped_column(
        String(100), unique=True, nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(20), default="created", nullable=False, index=True
    )
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), default="INR", nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
