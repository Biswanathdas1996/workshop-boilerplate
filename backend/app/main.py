from functools import lru_cache
import os
from pathlib import Path
from datetime import datetime, timedelta
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials
from pymongo import MongoClient, ASCENDING
from pymongo.errors import PyMongoError, DuplicateKeyError
from pymongo.database import Database
from bson import ObjectId

from app.models import (
    UserRegister, UserLogin, UserResponse, UserRole,
    VehicleRegister, VehicleResponse,
    ParkingSpotResponse, ReservationCreate, ReservationResponse,
    AdminMetrics
)
from app.auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, require_admin, security
)

load_dotenv(Path(__file__).resolve().parents[2] / '.env')

frontend_port = os.getenv('FRONTEND_PORT', '5173')
backend_port = os.getenv('BACKEND_PORT', '8000')

app = FastAPI(title='Parking Management API')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[f'http://localhost:{frontend_port}'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClient:
    mongodb_uri = os.getenv('MONGODB_URI')
    if not mongodb_uri:
        raise RuntimeError('MONGODB_URI is not configured.')
    return MongoClient(mongodb_uri, serverSelectionTimeoutMS=3000)


def get_db() -> Database:
    client = get_mongo_client()
    db = client.get_default_database()
    if db is None:
        raise RuntimeError('Database not configured.')
    return db


def log_audit(db: Database, user_id: str, action: str, resource: str, details: dict = None):
    """Log admin actions for audit trail (NFR-002)"""
    db.audit_logs.insert_one({
        'user_id': user_id,
        'action': action,
        'resource': resource,
        'details': details or {},
        'timestamp': datetime.utcnow()
    })


@app.on_event('startup')
def initialize_database():
    """Create indexes and seed initial data"""
    db = get_db()

    # Create indexes
    db.users.create_index([('email', ASCENDING)], unique=True)
    db.vehicles.create_index([('license_plate', ASCENDING)], unique=True)
    db.parking_spots.create_index([('spot_number', ASCENDING)], unique=True)

    # Seed parking spots if empty
    if db.parking_spots.count_documents({}) == 0:
        spots = [
            {
                'spot_number': f'A{i:02d}',
                'location': 'Ground Floor',
                'site_name': 'Main Site',
                'is_available': True,
                'created_at': datetime.utcnow()
            }
            for i in range(1, 21)
        ]
        spots.extend([
            {
                'spot_number': f'B{i:02d}',
                'location': 'First Floor',
                'site_name': 'Main Site',
                'is_available': True,
                'created_at': datetime.utcnow()
            }
            for i in range(1, 21)
        ])
        db.parking_spots.insert_many(spots)

    # Create default admin user if none exists
    if db.users.count_documents({'role': 'admin'}) == 0:
        db.users.insert_one({
            'email': 'admin@oktawave.com',
            'password': get_password_hash('Admin@123'),
            'full_name': 'System Administrator',
            'phone': None,
            'role': 'admin',
            'created_at': datetime.utcnow()
        })


@app.get('/api/health')
def health_check() -> dict[str, object]:
    backend_status = 'connected'
    database_status = 'disconnected'
    database_name = None

    try:
        client = get_mongo_client()
        client.admin.command('ping')
        default_database = client.get_default_database()
        database_name = default_database.name if default_database is not None else None
        database_status = 'connected'
    except (PyMongoError, RuntimeError):
        database_status = 'disconnected'

    return {
        'frontend': 'active',
        'backend': backend_status,
        'database': database_status,
        'databaseName': database_name,
        'backendPort': backend_port,
    }


# ========== KAN-331: User Registration ==========
@app.post('/api/auth/register', response_model=dict, status_code=status.HTTP_201_CREATED)
def register_user(user_data: UserRegister):
    """Register a new user (FR-001, AC-01)"""
    db = get_db()

    try:
        user_doc = {
            'email': user_data.email,
            'password': get_password_hash(user_data.password),
            'full_name': user_data.full_name,
            'phone': user_data.phone,
            'role': UserRole.USER,
            'created_at': datetime.utcnow()
        }
        result = db.users.insert_one(user_doc)

        access_token = create_access_token(data={'sub': str(result.inserted_id)})

        return {
            'message': 'User registered successfully',
            'access_token': access_token,
            'token_type': 'bearer'
        }
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Email already registered'
        )


# ========== KAN-332: User Login ==========
@app.post('/api/auth/login', response_model=dict)
def login_user(credentials: UserLogin):
    """Authenticate user and issue JWT token (FR-002, AC-02, NFR-001)"""
    db = get_db()

    user = db.users.find_one({'email': credentials.email})
    if not user or not verify_password(credentials.password, user['password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid email or password',
            headers={'WWW-Authenticate': 'Bearer'},
        )

    access_token = create_access_token(data={'sub': str(user['_id'])})

    return {
        'access_token': access_token,
        'token_type': 'bearer',
        'user': {
            'id': str(user['_id']),
            'email': user['email'],
            'full_name': user['full_name'],
            'role': user['role']
        }
    }


@app.get('/api/auth/me', response_model=UserResponse)
async def get_current_user_info(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get current authenticated user information"""
    db = get_db()
    user = await get_current_user(credentials, db)

    return UserResponse(
        id=str(user['_id']),
        email=user['email'],
        full_name=user['full_name'],
        phone=user.get('phone'),
        role=user['role'],
        created_at=user['created_at']
    )


# ========== KAN-333: Vehicle Registration ==========
@app.post('/api/vehicles', response_model=dict, status_code=status.HTTP_201_CREATED)
async def register_vehicle(
    vehicle_data: VehicleRegister,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Register a vehicle for the authenticated user (FR-003, AC-03)"""
    db = get_db()
    user = await get_current_user(credentials, db)

    try:
        vehicle_doc = {
            'user_id': str(user['_id']),
            'license_plate': vehicle_data.license_plate.upper(),
            'make': vehicle_data.make,
            'model': vehicle_data.model,
            'color': vehicle_data.color,
            'year': vehicle_data.year,
            'created_at': datetime.utcnow()
        }
        result = db.vehicles.insert_one(vehicle_doc)

        return {
            'message': 'Vehicle registered successfully',
            'vehicle_id': str(result.inserted_id)
        }
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='License plate already registered'
        )


@app.get('/api/vehicles', response_model=List[VehicleResponse])
async def get_user_vehicles(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get all vehicles registered by the authenticated user"""
    db = get_db()
    user = await get_current_user(credentials, db)

    vehicles = db.vehicles.find({'user_id': str(user['_id'])})

    return [
        VehicleResponse(
            id=str(v['_id']),
            user_id=v['user_id'],
            license_plate=v['license_plate'],
            make=v['make'],
            model=v['model'],
            color=v['color'],
            year=v['year'],
            created_at=v['created_at']
        )
        for v in vehicles
    ]


# ========== KAN-334: Parking Reservation ==========
@app.get('/api/spots', response_model=List[ParkingSpotResponse])
async def get_available_spots(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get all available parking spots with real-time occupancy (FR-004, AC-04)"""
    db = get_db()
    await get_current_user(credentials, db)  # Verify authentication

    spots = db.parking_spots.find({})

    return [
        ParkingSpotResponse(
            id=str(spot['_id']),
            spot_number=spot['spot_number'],
            is_available=spot['is_available'],
            location=spot['location'],
            site_name=spot['site_name']
        )
        for spot in spots
    ]


@app.post('/api/reservations', response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_reservation(
    reservation_data: ReservationCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Create a parking reservation (FR-004, AC-04)"""
    db = get_db()
    user = await get_current_user(credentials, db)

    # Verify spot exists and is available
    spot = db.parking_spots.find_one({'_id': ObjectId(reservation_data.spot_id)})
    if not spot:
        raise HTTPException(status_code=404, detail='Parking spot not found')

    # Check for conflicting reservations
    conflict = db.reservations.find_one({
        'spot_id': reservation_data.spot_id,
        'status': 'active',
        '$or': [
            {
                'start_time': {'$lte': reservation_data.end_time},
                'end_time': {'$gte': reservation_data.start_time}
            }
        ]
    })

    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail='Spot is already reserved for this time period'
        )

    # Verify vehicle belongs to user
    vehicle = db.vehicles.find_one({
        '_id': ObjectId(reservation_data.vehicle_id),
        'user_id': str(user['_id'])
    })
    if not vehicle:
        raise HTTPException(status_code=404, detail='Vehicle not found')

    reservation_doc = {
        'user_id': str(user['_id']),
        'spot_id': reservation_data.spot_id,
        'vehicle_id': reservation_data.vehicle_id,
        'start_time': reservation_data.start_time,
        'end_time': reservation_data.end_time,
        'status': 'active',
        'created_at': datetime.utcnow()
    }
    result = db.reservations.insert_one(reservation_doc)

    # Update spot availability
    db.parking_spots.update_one(
        {'_id': ObjectId(reservation_data.spot_id)},
        {'$set': {'is_available': False}}
    )

    return {
        'message': 'Reservation created successfully',
        'reservation_id': str(result.inserted_id)
    }


@app.get('/api/reservations', response_model=List[ReservationResponse])
async def get_user_reservations(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get all reservations for the authenticated user"""
    db = get_db()
    user = await get_current_user(credentials, db)

    reservations = db.reservations.find({'user_id': str(user['_id'])})

    return [
        ReservationResponse(
            id=str(r['_id']),
            user_id=r['user_id'],
            spot_id=r['spot_id'],
            vehicle_id=r['vehicle_id'],
            start_time=r['start_time'],
            end_time=r['end_time'],
            status=r['status'],
            created_at=r['created_at']
        )
        for r in reservations
    ]


# ========== KAN-335: Admin Dashboard ==========
@app.get('/api/admin/metrics', response_model=AdminMetrics)
async def get_admin_metrics(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Get system metrics for admin dashboard (FR-005, AC-05)"""
    db = get_db()
    admin = await require_admin(credentials, db)

    log_audit(db, str(admin['_id']), 'view', 'metrics')

    total_users = db.users.count_documents({'role': 'user'})
    total_vehicles = db.vehicles.count_documents({})
    total_reservations = db.reservations.count_documents({})
    active_reservations = db.reservations.count_documents({'status': 'active'})
    total_spots = db.parking_spots.count_documents({})
    available_spots = db.parking_spots.count_documents({'is_available': True})

    return AdminMetrics(
        total_users=total_users,
        total_vehicles=total_vehicles,
        total_reservations=total_reservations,
        active_reservations=active_reservations,
        available_spots=available_spots,
        total_spots=total_spots
    )


@app.get('/api/admin/users', response_model=List[UserResponse])
async def get_all_users(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Admin: Get all users (FR-005, AC-05)"""
    db = get_db()
    admin = await require_admin(credentials, db)

    log_audit(db, str(admin['_id']), 'view', 'users')

    users = db.users.find({'role': 'user'})

    return [
        UserResponse(
            id=str(u['_id']),
            email=u['email'],
            full_name=u['full_name'],
            phone=u.get('phone'),
            role=u['role'],
            created_at=u['created_at']
        )
        for u in users
    ]


@app.get('/api/admin/vehicles', response_model=List[VehicleResponse])
async def get_all_vehicles(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Admin: Get all vehicles (FR-005, AC-05)"""
    db = get_db()
    admin = await require_admin(credentials, db)

    log_audit(db, str(admin['_id']), 'view', 'vehicles')

    vehicles = db.vehicles.find({})

    return [
        VehicleResponse(
            id=str(v['_id']),
            user_id=v['user_id'],
            license_plate=v['license_plate'],
            make=v['make'],
            model=v['model'],
            color=v['color'],
            year=v['year'],
            created_at=v['created_at']
        )
        for v in vehicles
    ]


@app.get('/api/admin/reservations', response_model=List[ReservationResponse])
async def get_all_reservations(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Admin: Get all reservations (FR-005, AC-05)"""
    db = get_db()
    admin = await require_admin(credentials, db)

    log_audit(db, str(admin['_id']), 'view', 'reservations')

    reservations = db.reservations.find({})

    return [
        ReservationResponse(
            id=str(r['_id']),
            user_id=r['user_id'],
            spot_id=r['spot_id'],
            vehicle_id=r['vehicle_id'],
            start_time=r['start_time'],
            end_time=r['end_time'],
            status=r['status'],
            created_at=r['created_at']
        )
        for r in reservations
    ]


@app.delete('/api/admin/reservations/{reservation_id}', response_model=dict)
async def cancel_reservation(
    reservation_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Admin: Cancel a reservation (FR-005, AC-05, NFR-002)"""
    db = get_db()
    admin = await require_admin(credentials, db)

    reservation = db.reservations.find_one({'_id': ObjectId(reservation_id)})
    if not reservation:
        raise HTTPException(status_code=404, detail='Reservation not found')

    db.reservations.update_one(
        {'_id': ObjectId(reservation_id)},
        {'$set': {'status': 'cancelled'}}
    )

    # Free up the spot
    db.parking_spots.update_one(
        {'_id': ObjectId(reservation['spot_id'])},
        {'$set': {'is_available': True}}
    )

    log_audit(db, str(admin['_id']), 'cancel', 'reservation', {'reservation_id': reservation_id})

    return {'message': 'Reservation cancelled successfully'}


@app.delete('/api/admin/users/{user_id}', response_model=dict)
async def delete_user(
    user_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Admin: Delete a user (FR-005, AC-05, NFR-002)"""
    db = get_db()
    admin = await require_admin(credentials, db)

    user = db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail='User not found')

    if user['role'] == 'admin':
        raise HTTPException(status_code=400, detail='Cannot delete admin users')

    db.users.delete_one({'_id': ObjectId(user_id)})

    log_audit(db, str(admin['_id']), 'delete', 'user', {'user_id': user_id})

    return {'message': 'User deleted successfully'}
