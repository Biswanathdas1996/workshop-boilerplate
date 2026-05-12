# Parking Management System

A complete full-stack parking management application with React + Vite + TypeScript frontend, Python FastAPI backend, and MongoDB database.

## Features

### User Management (KAN-435, KAN-436)
- User Registration with email and password
- User Login with JWT authentication
- Secure session management

### Vehicle Management (KAN-437)
- Register multiple vehicles per user
- Track vehicle details (license plate, make, model, color)
- View all registered vehicles

### Parking Operations (KAN-438, KAN-439, KAN-440)
- Real-time parking spot availability display
- Live occupancy monitoring with statistics by floor
- Advanced reservation system with conflict prevention
- View and manage reservations
- Cancel reservations

## Technology Stack

### Frontend
- React 18
- TypeScript
- Vite
- React Router DOM
- Modern CSS with custom design system

### Backend
- FastAPI
- Python 3.x
- JWT authentication (python-jose)
- Password hashing (passlib with bcrypt)
- MongoDB (PyMongo)

## Structure
- `frontend/` - React + Vite + TypeScript UI with routing and components
- `backend/` - FastAPI REST API with authentication and MongoDB integration
- `backend/app/models.py` - Pydantic models for request/response validation
- `backend/app/auth.py` - Authentication utilities and JWT handling

## Environment Variables
- `FRONTEND_PORT` - Vite dev server port (default: 5173)
- `BACKEND_PORT` - FastAPI server port (default: 8000)
- `MONGODB_URI` - MongoDB connection string
- `SECRET_KEY` - JWT secret key for token generation

## Setup
1. Run `setup.bat` from the repository root to install dependencies
2. Copy `.env.example` to `.env` and configure your environment variables
3. Ensure MongoDB connection string is valid in `.env`

## Run
Run `start.bat` from the repository root.

The frontend proxy automatically points to the backend port from `.env`.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user profile

### Vehicles
- `POST /api/vehicles` - Register a vehicle
- `GET /api/vehicles` - Get user's vehicles

### Parking Spots
- `GET /api/parking-spots` - Get all parking spots
- `GET /api/parking-spots/occupancy` - Get real-time occupancy statistics

### Reservations
- `POST /api/reservations` - Create a reservation
- `GET /api/reservations` - Get user's reservations
- `DELETE /api/reservations/{id}` - Cancel a reservation

## Database Collections

The system automatically creates the following MongoDB collections:
- `users` - User accounts with authentication
- `vehicles` - Registered vehicles
- `parking_spots` - Parking spot inventory (auto-initialized with 60 spots across 3 floors)
- `reservations` - Parking reservations

## Security Features
- Password complexity requirements (minimum 8 characters)
- Bcrypt password hashing
- JWT token-based authentication
- CORS protection
- Unique email validation
- Reservation conflict prevention
