
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class RegisterInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str


class HotelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str
    country: str
    description: str
    image_url: str
    price_per_night: float
    rating: float
    amenities: list[str]
    total_rooms: int


class BookingInput(BaseModel):
    hotel_id: int
    check_in: date
    check_out: date
    guests: int = Field(ge=1, le=32)
    rooms: int = Field(ge=1, le=10)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.check_in < date.today():
            raise ValueError("Check-in cannot be in the past")
        if self.check_out <= self.check_in:
            raise ValueError("Check-out must be after check-in")
        return self


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    hotel_id: int
    hotel_name: str
    check_in: date
    check_out: date
    guests: int
    rooms: int
    nights: int
    subtotal: float
    taxes: float
    total: float
    status: str
    payment_status: str
    created_at: datetime
