
# StayEase

A full-stack hotel discovery and booking application built with React,
TypeScript, FastAPI and SQLAlchemy.

## Features

- Responsive hotel discovery interface
- Hotel search, price filters, amenities and rating sort
- Hotel detail and booking forms
- Customer registration and login
- JWT-based API authentication
- User-specific booking history and cancellation
- Server-side price and tax calculation
- Date-overlap room inventory checks
- Admin-only statistics and management APIs
- SQLite local development; PostgreSQL-compatible database URL
- Automated API tests

## Requirements

- Python 3.11+
- Node.js 20+
- npm

## 1. Configure the backend

Open a terminal in the project root:

    cd backend
    python -m venv .venv

Windows PowerShell:

    .\.venv\Scripts\Activate.ps1

Install packages:

    pip install -r requirements.txt

Copy `.env.example` to `.env`. Set a unique JWT_SECRET with at least
32 characters and change ADMIN_PASSWORD.

Example local configuration:

    DATABASE_URL=sqlite:///./stayease.db
    JWT_SECRET=replace-with-a-long-random-secret-value
    JWT_EXPIRE_MINUTES=60
    FRONTEND_ORIGIN=http://127.0.0.1:5173
    TAX_RATE=0.12
    ADMIN_EMAIL=admin@stayease.local
    ADMIN_PASSWORD=replace-with-a-unique-strong-password

Create sample data:

    python seed.py

Start the API:

    uvicorn main:app --reload --host 127.0.0.1 --port 8000

API documentation:

    http://127.0.0.1:8000/docs

## 2. Start the frontend

Open a second terminal:

    cd frontend
    npm install

Copy `.env.example` to `.env` and configure:

    VITE_API_URL=http://127.0.0.1:8000

Start the website:

    npm run dev

Open:

    http://127.0.0.1:5173

## 3. Run tests

From the backend directory with its virtual environment activated:

    pytest -q

From the frontend directory:

    npm run build

## Important limitations

This is a starter project, not a production-ready booking platform.

- Hotel listings are sample data.
- Booking creation is pending and unpaid; no real payment is collected.
- Razorpay integration and server-side payment verification still need to
  be implemented before accepting real payments.
- Temporary holds, hold expiration and robust transactional inventory
  locking need a production implementation.
- Email verification, password recovery, reviews UI, room categories,
  image uploads and complete hotel/user CRUD need further development.
- Use PostgreSQL, database migrations, rate limiting, secure cookie/session
  decisions, HTTPS and production secrets before public deployment.
- Configure the correct frontend origin for the deployed website.
- Change all local development credentials before deployment.

## Suggested next steps

1. Add PostgreSQL and Alembic migrations.
2. Implement transaction-safe room inventory and expiring holds.
3. Integrate Razorpay test mode and verify signatures server-side.
4. Add admin hotel and room CRUD.
5. Add email verification, password recovery and review eligibility.
6. Deploy the frontend and API separately.
7. Add CI workflows and broader automated tests.
