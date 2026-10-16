
import os

from dotenv import load_dotenv
from sqlalchemy import select

from auth import hash_password
from database import Base, SessionLocal, engine
from models import Hotel, User

load_dotenv()
Base.metadata.create_all(bind=engine)

SAMPLE_HOTELS = [
    {
        "name": "The Grand Azure Resort",
        "city": "Goa",
        "description": "A relaxing resort with elegant rooms and tropical surroundings.",
        "image_url": "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
        "price_per_night": 6500,
        "rating": 4.9,
        "amenities": ["Wi-Fi", "Pool", "AC", "Breakfast"],
        "total_rooms": 18,
    },
    {
        "name": "The Heritage House",
        "city": "Jaipur",
        "description": "A boutique stay inspired by traditional Rajasthani architecture.",
        "image_url": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
        "price_per_night": 4200,
        "rating": 4.8,
        "amenities": ["Wi-Fi", "AC", "Parking", "Restaurant"],
        "total_rooms": 12,
    },
    {
        "name": "Mountain Vista Retreat",
        "city": "Manali",
        "description": "A peaceful mountain retreat with scenic views.",
        "image_url": "https://images.unsplash.com/photo-1518732714860-b62714ce0c59?auto=format&fit=crop&w=1200&q=80",
        "price_per_night": 3800,
        "rating": 4.7,
        "amenities": ["Wi-Fi", "Mountain View", "AC"],
        "total_rooms": 10,
    },
    {
        "name": "Palm Garden Suites",
        "city": "Mumbai",
        "description": "Contemporary suites for a comfortable city break.",
        "image_url": "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
        "price_per_night": 5400,
        "rating": 4.6,
        "amenities": ["Wi-Fi", "Pool", "AC", "Gym"],
        "total_rooms": 15,
    },
    {
        "name": "Lakeview Serenity",
        "city": "Udaipur",
        "description": "An intimate lakeside stay for a relaxing holiday.",
        "image_url": "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
        "price_per_night": 7200,
        "rating": 4.9,
        "amenities": ["Wi-Fi", "Lake View", "Restaurant"],
        "total_rooms": 8,
    },
    {
        "name": "Urban Nest Hotel",
        "city": "Delhi",
        "description": "A stylish city hotel with practical modern amenities.",
        "image_url": "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80",
        "price_per_night": 3200,
        "rating": 4.5,
        "amenities": ["Wi-Fi", "AC", "Parking"],
        "total_rooms": 20,
    },
]


def seed():
    with SessionLocal() as db:
        for item in SAMPLE_HOTELS:
            existing = db.scalar(
                select(Hotel).where(Hotel.name == item["name"])
            )
            if existing is None:
                db.add(Hotel(country="India", **item))

        admin_email = os.getenv(
            "ADMIN_EMAIL", "admin@stayease.local"
        ).lower()
        admin_password = os.getenv("ADMIN_PASSWORD", "")

        admin = db.scalar(
            select(User).where(User.email == admin_email)
        )

        if admin is None:
            if len(admin_password) < 12:
                raise RuntimeError(
                    "Set ADMIN_PASSWORD to at least 12 characters in .env"
                )
            db.add(
                User(
                    full_name="StayEase Administrator",
                    email=admin_email,
                    password_hash=hash_password(admin_password),
                    role="admin",
                )
            )

        db.commit()

    print("StayEase sample hotels and admin account are ready.")


if __name__ == "__main__":
    seed()
