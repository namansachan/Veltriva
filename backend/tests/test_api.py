
import os

os.environ.setdefault(
    "JWT_SECRET",
    "local-test-only-secret-key-change-this-123456789",
)
os.environ.setdefault(
    "DATABASE_URL",
    "sqlite:///./stayease_test.db",
)
os.environ.setdefault(
    "FRONTEND_ORIGIN",
    "http://127.0.0.1:5173",
)
os.environ.setdefault("ADMIN_PASSWORD", "TestAdminPassword123!")

from fastapi.testclient import TestClient

from main import app


def test_health():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


def test_root():
    with TestClient(app) as client:
        response = client.get("/")
        assert response.status_code == 200
        assert response.json()["name"] == "StayEase API"


def test_hotels_endpoint():
    with TestClient(app) as client:
        response = client.get("/hotels")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


def test_booking_requires_authentication():
    with TestClient(app) as client:
        response = client.get("/bookings")
        assert response.status_code == 401


def test_admin_stats_requires_authentication():
    with TestClient(app) as client:
        response = client.get("/admin/stats")
        assert response.status_code == 401


def test_invalid_login():
    with TestClient(app) as client:
        response = client.post(
            "/auth/login",
            json={
                "email": "nobody@example.com",
                "password": "WrongPassword123!",
            },
        )
        assert response.status_code == 401
