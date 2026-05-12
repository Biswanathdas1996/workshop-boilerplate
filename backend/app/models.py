from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str


class VehicleCreate(BaseModel):
    license_plate: str = Field(min_length=2, max_length=20)
    make: str
    model: str
    color: Optional[str] = None


class VehicleResponse(BaseModel):
    id: str
    user_id: str
    license_plate: str
    make: str
    model: str
    color: Optional[str]
    created_at: datetime


class ParkingSpot(BaseModel):
    id: str
    spot_number: str
    floor: int
    is_occupied: bool
    reserved: bool
    last_updated: datetime


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
    spot_number: Optional[str] = None
    vehicle_plate: Optional[str] = None
