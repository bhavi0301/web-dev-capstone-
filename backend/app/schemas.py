from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import List, Optional

# --- User Schemas ---
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str = "staff" # admin, manager, staff

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class UserOut(UserBase):
    id: int
    model_config = {"from_attributes": True}


# --- Supplier Schemas ---
class SupplierBase(BaseModel):
    name: str
    contact: str
    lead_time_days: int = 7

class SupplierCreate(SupplierBase):
    pass

class SupplierOut(SupplierBase):
    id: int
    model_config = {"from_attributes": True}


# --- Warehouse Schemas ---
class WarehouseBase(BaseModel):
    name: str
    location: str

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseOut(WarehouseBase):
    id: int
    model_config = {"from_attributes": True}


# --- Product Schemas ---
class ProductBase(BaseModel):
    name: str
    sku: str
    category: str
    cost_price: float
    selling_price: float
    reorder_level: int = 10
    supplier_id: int

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    cost_price: Optional[float] = None
    selling_price: Optional[float] = None
    reorder_level: Optional[int] = None
    supplier_id: Optional[int] = None

class ProductOut(ProductBase):
    id: int
    supplier: Optional[SupplierOut] = None
    model_config = {"from_attributes": True}


# --- Inventory Schemas ---
class InventoryBase(BaseModel):
    product_id: int
    warehouse_id: int
    quantity: int

class InventoryCreate(InventoryBase):
    pass

class InventoryUpdate(BaseModel):
    quantity: int

class InventoryOut(InventoryBase):
    id: int
    updated_at: datetime
    product: Optional[ProductOut] = None
    warehouse: Optional[WarehouseOut] = None
    model_config = {"from_attributes": True}

class InventoryLevel(BaseModel):
    warehouse_name: str
    quantity: int
    model_config = {"from_attributes": True}


# --- Inventory Transaction Schemas ---
class InventoryTransactionBase(BaseModel):
    product_id: int
    warehouse_id: int
    quantity_change: int
    transaction_type: str # stock_in, stock_out, sale, adjustment, received

class InventoryTransactionCreate(InventoryTransactionBase):
    pass

class InventoryTransactionOut(InventoryTransactionBase):
    id: int
    timestamp: datetime
    user_id: int
    user: Optional[UserOut] = None
    product: Optional[ProductOut] = None
    warehouse: Optional[WarehouseOut] = None
    model_config = {"from_attributes": True}


# --- Sale Schemas ---

class SaleBase(BaseModel):
    product_id: int
    quantity_sold: int
    revenue: float
    sale_date: Optional[datetime] = None

class SaleCreate(SaleBase):
    pass

class SaleOut(SaleBase):
    id: int
    product: Optional[ProductOut] = None
    model_config = {"from_attributes": True}


# --- Purchase Order Schemas ---
class PurchaseOrderBase(BaseModel):
    product_id: int
    quantity: int
    status: str = "pending" # pending, ordered, received
    expected_date: datetime

class PurchaseOrderCreate(PurchaseOrderBase):
    pass

class PurchaseOrderUpdate(BaseModel):
    status: str # pending, ordered, received

class PurchaseOrderOut(PurchaseOrderBase):
    id: int
    order_date: datetime
    product: Optional[ProductOut] = None
    model_config = {"from_attributes": True}


# --- Prediction Schemas ---
class ForecastDataPoint(BaseModel):
    date: str
    forecast: float
    lower_bound: float
    upper_bound: float

class PredictionResponse(BaseModel):
    sku: str
    product_name: str
    current_stock: int
    forecast_7_days: float
    forecast_30_days: float
    forecast_90_days: float
    reorder_point: int
    suggested_reorder_qty: int
    anomaly_flag: bool
    forecast_data: List[ForecastDataPoint]


# --- Analytics & KPI Schemas ---
class KPIMetrics(BaseModel):
    total_revenue: float
    total_profit: float
    profit_margin: float
    units_sold: int
    low_stock_count: int

class SalesTrendPoint(BaseModel):
    date: str
    revenue: float
    profit: float

class TopProductItem(BaseModel):
    product_name: str
    sku: str
    units_sold: int
    revenue: float

class CategorySalesItem(BaseModel):
    category: str
    revenue: float
    percentage: float
