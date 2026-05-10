from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from enum import Enum


class UserRole(str, Enum):
    USER = 'user'
    ADMIN = 'admin'


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    phone: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    phone: Optional[str] = None
    role: UserRole
    created_at: datetime


class VehicleRegister(BaseModel):
    license_plate: str
    make: str
    model: str
    color: str
    year: int = Field(ge=1900, le=2100)


class VehicleResponse(BaseModel):
    id: str
    user_id: str
    license_plate: str
    make: str
    model: str
    color: str
    year: int
    created_at: datetime


class ParkingSpotResponse(BaseModel):
    id: str
    spot_number: str
    is_available: bool
    location: str
    site_name: str


class ReservationCreate(BaseModel):
    spot_id: str
    vehicle_id: str
    start_time: datetime
    end_time: datetime


class ReservationResponse(BaseModel):
    id: str
    user_id: str
    spot_id: str
    vehicle_id: str
    start_time: datetime
    end_time: datetime
    status: str
    created_at: datetime


class AdminMetrics(BaseModel):
    total_users: int
    total_vehicles: int
    total_reservations: int
    active_reservations: int
    available_spots: int
    total_spots: int


class AuditLog(BaseModel):
    user_id: str
    action: str
    resource: str
    timestamp: datetime
    details: Optional[dict] = None
