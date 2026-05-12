from functools import lru_cache
import os
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Optional

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pymongo.errors import PyMongoError, DuplicateKeyError

from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user_id,
)
from app.models import (
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
    VehicleCreate,
    VehicleResponse,
    ParkingSpot,
    ReservationCreate,
    ReservationResponse,
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


def get_database():
    client = get_mongo_client()
    return client.get_default_database()


@app.on_event('startup')
async def startup_event():
    try:
        db = get_database()
        db.users.create_index('email', unique=True)
        db.vehicles.create_index('user_id')
        db.parking_spots.create_index('spot_number', unique=True)
        db.reservations.create_index([('user_id', 1), ('start_time', 1)])

        existing_spots = db.parking_spots.count_documents({})
        if existing_spots == 0:
            spots = []
            for floor in range(1, 4):
                for spot_num in range(1, 21):
                    spots.append({
                        '_id': ObjectId(),
                        'spot_number': f'{floor}{spot_num:02d}',
                        'floor': floor,
                        'is_occupied': False,
                        'reserved': False,
                        'last_updated': datetime.utcnow(),
                    })
            if spots:
                db.parking_spots.insert_many(spots)
    except Exception:
        pass


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


@app.post('/api/auth/register', response_model=Token, status_code=status.HTTP_201_CREATED)
def register_user(user: UserCreate):
    db = get_database()

    if len(user.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Password must be at least 8 characters long',
        )

    existing_user = db.users.find_one({'email': user.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Email already registered',
        )

    user_doc = {
        '_id': ObjectId(),
        'email': user.email,
        'name': user.name,
        'hashed_password': get_password_hash(user.password),
        'created_at': datetime.utcnow(),
    }

    try:
        db.users.insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Email already registered',
        )

    access_token = create_access_token(data={'sub': str(user_doc['_id'])})
    return Token(access_token=access_token, token_type='bearer')


@app.post('/api/auth/login', response_model=Token)
def login_user(credentials: UserLogin):
    db = get_database()

    user = db.users.find_one({'email': credentials.email})
    if not user or not verify_password(credentials.password, user['hashed_password']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid email or password',
            headers={'WWW-Authenticate': 'Bearer'},
        )

    access_token = create_access_token(data={'sub': str(user['_id'])})
    return Token(access_token=access_token, token_type='bearer')


@app.get('/api/auth/me', response_model=UserResponse)
def get_current_user(user_id: str = Depends(get_current_user_id)):
    db = get_database()

    user = db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='User not found',
        )

    return UserResponse(
        id=str(user['_id']),
        email=user['email'],
        name=user['name'],
        created_at=user['created_at'],
    )


@app.post('/api/vehicles', response_model=VehicleResponse, status_code=status.HTTP_201_CREATED)
def register_vehicle(vehicle: VehicleCreate, user_id: str = Depends(get_current_user_id)):
    db = get_database()

    existing_vehicle = db.vehicles.find_one({
        'user_id': user_id,
        'license_plate': vehicle.license_plate,
    })
    if existing_vehicle:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Vehicle with this license plate already registered',
        )

    vehicle_doc = {
        '_id': ObjectId(),
        'user_id': user_id,
        'license_plate': vehicle.license_plate.upper(),
        'make': vehicle.make,
        'model': vehicle.model,
        'color': vehicle.color,
        'created_at': datetime.utcnow(),
    }

    db.vehicles.insert_one(vehicle_doc)

    return VehicleResponse(
        id=str(vehicle_doc['_id']),
        user_id=vehicle_doc['user_id'],
        license_plate=vehicle_doc['license_plate'],
        make=vehicle_doc['make'],
        model=vehicle_doc['model'],
        color=vehicle_doc['color'],
        created_at=vehicle_doc['created_at'],
    )


@app.get('/api/vehicles', response_model=List[VehicleResponse])
def get_user_vehicles(user_id: str = Depends(get_current_user_id)):
    db = get_database()

    vehicles = list(db.vehicles.find({'user_id': user_id}))

    return [
        VehicleResponse(
            id=str(v['_id']),
            user_id=v['user_id'],
            license_plate=v['license_plate'],
            make=v['make'],
            model=v['model'],
            color=v.get('color'),
            created_at=v['created_at'],
        )
        for v in vehicles
    ]


@app.get('/api/parking-spots', response_model=List[ParkingSpot])
def get_parking_spots():
    db = get_database()

    spots = list(db.parking_spots.find({}))

    return [
        ParkingSpot(
            id=str(spot['_id']),
            spot_number=spot['spot_number'],
            floor=spot['floor'],
            is_occupied=spot['is_occupied'],
            reserved=spot['reserved'],
            last_updated=spot['last_updated'],
        )
        for spot in spots
    ]


@app.get('/api/parking-spots/occupancy')
def get_occupancy_stats():
    db = get_database()

    total_spots = db.parking_spots.count_documents({})
    occupied_spots = db.parking_spots.count_documents({'is_occupied': True})
    reserved_spots = db.parking_spots.count_documents({'reserved': True})
    available_spots = total_spots - occupied_spots - reserved_spots

    occupancy_by_floor = []
    for floor in range(1, 4):
        floor_total = db.parking_spots.count_documents({'floor': floor})
        floor_occupied = db.parking_spots.count_documents({'floor': floor, 'is_occupied': True})
        floor_reserved = db.parking_spots.count_documents({'floor': floor, 'reserved': True})
        floor_available = floor_total - floor_occupied - floor_reserved

        occupancy_by_floor.append({
            'floor': floor,
            'total': floor_total,
            'occupied': floor_occupied,
            'reserved': floor_reserved,
            'available': floor_available,
            'occupancy_rate': round((floor_occupied / floor_total * 100) if floor_total > 0 else 0, 1),
        })

    return {
        'total_spots': total_spots,
        'occupied': occupied_spots,
        'reserved': reserved_spots,
        'available': available_spots,
        'occupancy_rate': round((occupied_spots / total_spots * 100) if total_spots > 0 else 0, 1),
        'by_floor': occupancy_by_floor,
        'last_updated': datetime.utcnow(),
    }


@app.post('/api/reservations', response_model=ReservationResponse, status_code=status.HTTP_201_CREATED)
def create_reservation(reservation: ReservationCreate, user_id: str = Depends(get_current_user_id)):
    db = get_database()

    vehicle = db.vehicles.find_one({'_id': ObjectId(reservation.vehicle_id), 'user_id': user_id})
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Vehicle not found',
        )

    spot = db.parking_spots.find_one({'_id': ObjectId(reservation.spot_id)})
    if not spot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Parking spot not found',
        )

    if spot['is_occupied'] or spot['reserved']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Parking spot is not available',
        )

    conflicting_reservation = db.reservations.find_one({
        'spot_id': reservation.spot_id,
        'status': 'active',
        '$or': [
            {'start_time': {'$lte': reservation.end_time}, 'end_time': {'$gte': reservation.start_time}},
        ],
    })

    if conflicting_reservation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Parking spot already reserved for this time period',
        )

    reservation_doc = {
        '_id': ObjectId(),
        'user_id': user_id,
        'spot_id': reservation.spot_id,
        'vehicle_id': reservation.vehicle_id,
        'start_time': reservation.start_time,
        'end_time': reservation.end_time,
        'status': 'active',
        'created_at': datetime.utcnow(),
    }

    db.reservations.insert_one(reservation_doc)

    db.parking_spots.update_one(
        {'_id': ObjectId(reservation.spot_id)},
        {'$set': {'reserved': True, 'last_updated': datetime.utcnow()}},
    )

    return ReservationResponse(
        id=str(reservation_doc['_id']),
        user_id=reservation_doc['user_id'],
        spot_id=reservation_doc['spot_id'],
        vehicle_id=reservation_doc['vehicle_id'],
        start_time=reservation_doc['start_time'],
        end_time=reservation_doc['end_time'],
        status=reservation_doc['status'],
        created_at=reservation_doc['created_at'],
    )


@app.get('/api/reservations', response_model=List[ReservationResponse])
def get_user_reservations(user_id: str = Depends(get_current_user_id)):
    db = get_database()

    reservations = list(db.reservations.find({'user_id': user_id}).sort('created_at', -1))

    return [
        ReservationResponse(
            id=str(r['_id']),
            user_id=r['user_id'],
            spot_id=r['spot_id'],
            vehicle_id=r['vehicle_id'],
            start_time=r['start_time'],
            end_time=r['end_time'],
            status=r['status'],
            created_at=r['created_at'],
        )
        for r in reservations
    ]


@app.delete('/api/reservations/{reservation_id}', status_code=status.HTTP_204_NO_CONTENT)
def cancel_reservation(reservation_id: str, user_id: str = Depends(get_current_user_id)):
    db = get_database()

    reservation = db.reservations.find_one({
        '_id': ObjectId(reservation_id),
        'user_id': user_id,
    })

    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Reservation not found',
        )

    db.reservations.update_one(
        {'_id': ObjectId(reservation_id)},
        {'$set': {'status': 'cancelled'}},
    )

    db.parking_spots.update_one(
        {'_id': ObjectId(reservation['spot_id'])},
        {'$set': {'reserved': False, 'last_updated': datetime.utcnow()}},
    )

    return None
