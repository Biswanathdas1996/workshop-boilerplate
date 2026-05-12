from functools import lru_cache
import os
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Optional

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError
from pymongo.read_preferences import ReadPreference
from starlette.requests import Request

from app.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user_id,
)
from app.parking_seed import effective_floor
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

MONGO_UNAVAILABLE_MSG = (
    'Database unavailable. Check MongoDB Atlas: Network Access must allow your current IP, '
    'the cluster must be running (not paused), and your connection string must be correct. '
    'If one replica is slow, try again or use a VPN-friendly network.'
)


@app.exception_handler(DuplicateKeyError)
async def duplicate_key_handler(_request: Request, _exc: DuplicateKeyError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={'detail': 'A record with this unique value already exists.'},
    )


@app.exception_handler(PyMongoError)
async def pymongo_error_handler(_request: Request, _exc: PyMongoError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={'detail': MONGO_UNAVAILABLE_MSG},
    )


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClient:
    mongodb_uri = os.getenv('MONGODB_URI')
    if not mongodb_uri:
        raise RuntimeError('MONGODB_URI is not configured.')
    # Longer timeouts for Atlas over residential/Wi‑Fi; reads can use healthy secondaries if primary is flaky.
    return MongoClient(
        mongodb_uri,
        serverSelectionTimeoutMS=20_000,
        connectTimeoutMS=20_000,
        socketTimeoutMS=45_000,
        read_preference=ReadPreference.SECONDARY_PREFERRED,
    )


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
    if not user or 'hashed_password' not in user or not verify_password(credentials.password, user['hashed_password']):
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


@app.delete('/api/vehicles/{vehicle_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(vehicle_id: str, user_id: str = Depends(get_current_user_id)):
    db = get_database()

    try:
        oid = ObjectId(vehicle_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Invalid vehicle id',
        )

    vehicle = db.vehicles.find_one({'_id': oid, 'user_id': user_id})
    if not vehicle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Vehicle not found',
        )

    active_reservation = db.reservations.find_one({
        'user_id': user_id,
        'vehicle_id': vehicle_id,
        'status': 'active',
    })
    if active_reservation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Cancel active reservations that use this vehicle before deleting it.',
        )

    db.vehicles.delete_one({'_id': oid, 'user_id': user_id})
    return None


@app.get('/api/parking-spots', response_model=List[ParkingSpot])
def get_parking_spots():
    db = get_database()

    spots = list(db.parking_spots.find({}))

    return [
        ParkingSpot(
            id=str(spot['_id']),
            spot_number=str(spot.get('spot_number', '')),
            floor=effective_floor(spot),
            is_occupied=bool(spot.get('is_occupied')),
            reserved=bool(spot.get('reserved')),
            last_updated=spot.get('last_updated') or datetime.utcnow(),
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

    spot_rows = list(db.parking_spots.find({}, ['floor', 'spot_number', 'is_occupied', 'reserved']))
    floor_buckets: dict[int, dict[str, int]] = {}
    for s in spot_rows:
        fl = effective_floor(s)
        b = floor_buckets.setdefault(fl, {'total': 0, 'occupied': 0, 'reserved': 0})
        b['total'] += 1
        if s.get('is_occupied'):
            b['occupied'] += 1
        if s.get('reserved'):
            b['reserved'] += 1
    occupancy_by_floor = []
    for floor in sorted(floor_buckets.keys()):
        st = floor_buckets[floor]
        floor_available = st['total'] - st['occupied'] - st['reserved']
        occupancy_by_floor.append({
            'floor': floor,
            'total': st['total'],
            'occupied': st['occupied'],
            'reserved': st['reserved'],
            'available': floor_available,
            'occupancy_rate': round((st['occupied'] / st['total'] * 100) if st['total'] > 0 else 0, 1),
        })

    recent = db.parking_spots.find_one(sort=[('last_updated', -1)], projection=['last_updated'])
    last_updated = recent['last_updated'] if recent and recent.get('last_updated') else datetime.utcnow()

    return {
        'total_spots': total_spots,
        'occupied': occupied_spots,
        'reserved': reserved_spots,
        'available': available_spots,
        'occupancy_rate': round((occupied_spots / total_spots * 100) if total_spots > 0 else 0, 1),
        'by_floor': occupancy_by_floor,
        'last_updated': last_updated,
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

    if spot.get('is_occupied') or spot.get('reserved'):
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
        spot_number=spot.get('spot_number'),
        vehicle_plate=vehicle.get('license_plate'),
    )


@app.get('/api/reservations', response_model=List[ReservationResponse])
def get_user_reservations(user_id: str = Depends(get_current_user_id)):
    db = get_database()

    reservations = list(db.reservations.find({'user_id': user_id}).sort('created_at', -1))
    if not reservations:
        return []

    spot_oids: list[ObjectId] = []
    vehicle_oids: list[ObjectId] = []
    for r in reservations:
        try:
            spot_oids.append(ObjectId(str(r['spot_id'])))
            vehicle_oids.append(ObjectId(str(r['vehicle_id'])))
        except Exception:
            continue

    spots = {
        str(s['_id']): s
        for s in db.parking_spots.find({'_id': {'$in': spot_oids}})
    } if spot_oids else {}
    vehicles = {
        str(v['_id']): v
        for v in db.vehicles.find({'_id': {'$in': vehicle_oids}})
    } if vehicle_oids else {}

    result: list[ReservationResponse] = []
    for r in reservations:
        sid = str(r['spot_id'])
        vid = str(r['vehicle_id'])
        spot = spots.get(sid)
        veh = vehicles.get(vid)
        result.append(
            ReservationResponse(
                id=str(r['_id']),
                user_id=r['user_id'],
                spot_id=sid,
                vehicle_id=vid,
                start_time=r['start_time'],
                end_time=r['end_time'],
                status=r['status'],
                created_at=r['created_at'],
                spot_number=spot.get('spot_number') if spot else None,
                vehicle_plate=veh.get('license_plate') if veh else None,
            )
        )
    return result


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
