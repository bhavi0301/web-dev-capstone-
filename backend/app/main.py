import csv
import io
import os
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Query, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

# Database and Model Imports
from .database import engine, Base, get_db
from . import models, schemas, auth
from .auth import get_current_user, RoleChecker
from .ml_module import get_forecast_for_sku

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI-Based Smart Inventory Management System API",
    description="API backend supporting inventory, sales analytics, purchase orders, and demand prediction.",
    version="1.0.0"
)

# CORS configuration
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
if allowed_origins_env == "*":
    allowed_origins = ["*"]
else:
    allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# AUTHENTICATION ROUTING
# ==========================================

@app.post("/auth/signup", response_model=schemas.UserOut, tags=["Authentication"])
def signup(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    Create a new user. Default role is staff unless created by an admin.
    """
    db_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    hashed_password = auth.get_password_hash(user_in.password)
    new_user = models.User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hashed_password,
        role=user_in.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/auth/login", response_model=schemas.Token, tags=["Authentication"])
async def login(request: Request, db: Session = Depends(get_db)):
    """
    Authenticate user and return JWT token.
    Supports both JSON payloads (React frontend) and Form Data (OAuth2 standard for Swagger docs).
    """
    content_type = request.headers.get("content-type", "")
    email = None
    password = None

    if "application/x-www-form-urlencoded" in content_type:
        form_data = await request.form()
        email = form_data.get("username")  # OAuth2 uses 'username' field for login identifier
        password = form_data.get("password")
    else:
        try:
            json_data = await request.json()
            email = json_data.get("email")
            password = json_data.get("password")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid request format. Expected JSON or Form Data."
            )

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required"
        )

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not auth.verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(data={"sub": user.email, "role": user.role})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name
    }

@app.post("/auth/logout", tags=["Authentication"])
async def logout(
    token: str = Depends(auth.oauth2_scheme),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Invalidate the current JWT token by adding it to the blacklist.
    """
    from jose import jwt, JWTError
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        exp = payload.get("exp")
        # Keep the blacklist token until its expiration time
        expires_at = datetime.utcfromtimestamp(exp) if exp else datetime.utcnow() + timedelta(days=1)
    except JWTError:
        expires_at = datetime.utcnow() + timedelta(days=1)

    # Save to blacklisted tokens
    db_blacklist = models.BlacklistedToken(token=token, expires_at=expires_at)
    db.add(db_blacklist)
    db.commit()
    return {"detail": "Successfully logged out and session revoked"}

@app.get("/auth/me", response_model=schemas.UserOut, tags=["Authentication"])
def get_me(current_user: models.User = Depends(get_current_user)):
    """
    Get current logged-in user profile.
    """
    return current_user


# ==========================================
# PRODUCTS MANAGEMENT (RBAC restricted)
# ==========================================

@app.get("/products", response_model=List[schemas.ProductOut], tags=["Products"])
def list_products(
    search: Optional[str] = None,
    category: Optional[str] = None,
    supplier_id: Optional[int] = None,
    sort_by: str = "id", # name, sku, category, selling_price
    sort_order: str = "asc", # asc, desc
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    List, search, filter and sort products with pagination.
    """
    query = db.query(models.Product)
    
    # Filter
    if search:
        query = query.filter(
            (models.Product.name.like(f"%{search}%")) | 
            (models.Product.sku.like(f"%{search}%"))
        )
    if category:
        query = query.filter(models.Product.category == category)
    if supplier_id:
        query = query.filter(models.Product.supplier_id == supplier_id)
        
    # Sort
    sort_column = getattr(models.Product, sort_by, models.Product.id)
    if sort_order.lower() == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())
        
    return query.offset(offset).limit(limit).all()

@app.post("/products", response_model=schemas.ProductOut, status_code=201, tags=["Products"])
def create_product(
    product_in: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["admin", "manager"]))
):
    """
    Create a new product. (Admin and Manager only)
    """
    # Check SKU uniqueness
    existing_sku = db.query(models.Product).filter(models.Product.sku == product_in.sku).first()
    if existing_sku:
        raise HTTPException(status_code=400, detail="SKU already exists.")
        
    # Verify supplier exists
    supplier = db.query(models.Supplier).filter(models.Supplier.id == product_in.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=400, detail="Supplier not found.")
        
    new_product = models.Product(**product_in.model_dump())
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    
    # Initialize inventory as 0 for this product in all warehouses
    warehouses = db.query(models.Warehouse).all()
    for w in warehouses:
        inv = models.Inventory(product_id=new_product.id, warehouse_id=w.id, quantity=0)
        db.add(inv)
    db.commit()
    
    return new_product

@app.put("/products/{id}", response_model=schemas.ProductOut, tags=["Products"])
def update_product(
    id: int,
    product_in: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["admin", "manager"]))
):
    """
    Update product details. (Admin and Manager only)
    """
    product = db.query(models.Product).filter(models.Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
        
    update_data = product_in.model_dump(exclude_unset=True)
    
    if "sku" in update_data and update_data["sku"] != product.sku:
        existing_sku = db.query(models.Product).filter(models.Product.sku == update_data["sku"]).first()
        if existing_sku:
            raise HTTPException(status_code=400, detail="SKU already exists.")
            
    if "supplier_id" in update_data:
        supplier = db.query(models.Supplier).filter(models.Supplier.id == update_data["supplier_id"]).first()
        if not supplier:
            raise HTTPException(status_code=400, detail="Supplier not found.")
            
    for key, val in update_data.items():
        setattr(product, key, val)
        
    db.commit()
    db.refresh(product)
    return product

@app.delete("/products/{id}", status_code=204, tags=["Products"])
def delete_product(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["admin"]))
):
    """
    Delete a product from inventory. (Admin only)
    """
    product = db.query(models.Product).filter(models.Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
    db.delete(product)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ==========================================
# INVENTORY & STOCK MANAGEMENT
# ==========================================

@app.get("/inventory", response_model=List[schemas.InventoryOut], tags=["Inventory"])
def list_inventory(
    warehouse_id: Optional[int] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Get inventory items with details. Optional filters by warehouse and product category.
    """
    query = db.query(models.Inventory).join(models.Product)
    if warehouse_id:
        query = query.filter(models.Inventory.warehouse_id == warehouse_id)
    if category:
        query = query.filter(models.Product.category == category)
    return query.all()

@app.post("/inventory/transaction", response_model=schemas.InventoryTransactionOut, tags=["Inventory"])
def record_inventory_transaction(
    trans_in: schemas.InventoryTransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Record stock movement (Stock In / Stock Out). Updates the current inventory numbers.
    Attributed to the active user.
    """
    product = db.query(models.Product).filter(models.Product.id == trans_in.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
        
    warehouse = db.query(models.Warehouse).filter(models.Warehouse.id == trans_in.warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found.")
        
    # Check if stock out violates current levels
    inventory_item = db.query(models.Inventory).filter(
        models.Inventory.product_id == trans_in.product_id,
        models.Inventory.warehouse_id == trans_in.warehouse_id
    ).first()
    
    current_qty = inventory_item.quantity if inventory_item else 0
    new_qty = current_qty + trans_in.quantity_change
    
    if new_qty < 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient inventory in warehouse {warehouse.name}. Current: {current_qty}, Request: {trans_in.quantity_change}"
        )
        
    # Write Transaction
    new_trans = models.InventoryTransaction(
        product_id=trans_in.product_id,
        warehouse_id=trans_in.warehouse_id,
        quantity_change=trans_in.quantity_change,
        transaction_type=trans_in.transaction_type,
        user_id=current_user.id,
        timestamp=datetime.utcnow()
    )
    db.add(new_trans)
    
    # Update inventory balance
    if inventory_item:
        inventory_item.quantity = new_qty
    else:
        inventory_item = models.Inventory(
            product_id=trans_in.product_id,
            warehouse_id=trans_in.warehouse_id,
            quantity=new_qty
        )
        db.add(inventory_item)
        
    db.commit()
    db.refresh(new_trans)
    return new_trans

@app.get("/inventory/transactions", response_model=List[schemas.InventoryTransactionOut], tags=["Inventory"])
def get_transaction_history(
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Fetch log of stock movements (transactions).
    """
    return (
        db.query(models.InventoryTransaction)
        .order_by(models.InventoryTransaction.timestamp.desc())
        .limit(limit)
        .all()
    )

@app.get("/warehouses", response_model=List[schemas.WarehouseOut], tags=["Inventory"])
def list_warehouses(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Warehouse).all()

@app.get("/suppliers", response_model=List[schemas.SupplierOut], tags=["Inventory"])
def list_suppliers(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Supplier).all()


# ==========================================
# SALES & ANALYTICS
# ==========================================

@app.get("/sales", response_model=List[schemas.SaleOut], tags=["Sales"])
def list_sales(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    List sales records, optionally filtered by date range.
    """
    query = db.query(models.Sale)
    if start_date:
        query = query.filter(models.Sale.sale_date >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        # Include the whole end day
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        query = query.filter(models.Sale.sale_date < end_dt)
    return query.order_by(models.Sale.sale_date.desc()).all()

@app.post("/sales", response_model=schemas.SaleOut, tags=["Sales"])
def record_sale(
    sale_in: schemas.SaleCreate,
    warehouse_id: int = Query(..., description="Warehouse to subtract stock from"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Log a product sale. Checks/deducts stock from the specified warehouse and registers a transaction.
    """
    # 1. Deduct Stock (calls transaction helper internally)
    trans_schema = schemas.InventoryTransactionCreate(
        product_id=sale_in.product_id,
        warehouse_id=warehouse_id,
        quantity_change=-sale_in.quantity_sold,
        transaction_type="sale"
    )
    # Check/reduce stock via inventory handler
    record_inventory_transaction(trans_schema, db, current_user)
    
    # 2. Log Sale
    new_sale = models.Sale(
        product_id=sale_in.product_id,
        quantity_sold=sale_in.quantity_sold,
        revenue=sale_in.revenue,
        sale_date=sale_in.sale_date or datetime.utcnow()
    )
    db.add(new_sale)
    db.commit()
    db.refresh(new_sale)
    return new_sale

@app.get("/sales/analytics", response_model=schemas.KPIMetrics, tags=["Sales"])
def get_sales_analytics(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["admin", "manager"]))
):
    """
    Compute KPI dashboard metrics: revenue, profit, margins, sales counts.
    """
    sales_query = db.query(models.Sale).join(models.Product)
    
    if start_date:
        sales_query = sales_query.filter(models.Sale.sale_date >= datetime.strptime(start_date, "%Y-%m-%d"))
    if end_date:
        end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        sales_query = sales_query.filter(models.Sale.sale_date < end_dt)
        
    sales = sales_query.all()
    
    total_rev = sum(s.revenue for s in sales)
    total_cost = sum(s.quantity_sold * s.product.cost_price for s in sales)
    total_prof = total_rev - total_cost
    units_sold = sum(s.quantity_sold for s in sales)
    
    margin = (total_prof / total_rev) * 100 if total_rev > 0 else 0.0
    
    # Low stock count
    products = db.query(models.Product).all()
    low_stock = 0
    for p in products:
        total_inv = sum(inv.quantity for inv in p.inventory)
        if total_inv < p.reorder_level:
            low_stock += 1
            
    return {
        "total_revenue": round(total_rev, 2),
        "total_profit": round(total_prof, 2),
        "profit_margin": round(margin, 2),
        "units_sold": units_sold,
        "low_stock_count": low_stock
    }

@app.get("/sales/trends", response_model=List[schemas.SalesTrendPoint], tags=["Sales"])
def get_sales_trends(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["admin", "manager"]))
):
    """
    Aggregated revenue and profit grouped by day/date.
    """
    # Set default date range to last 30 days if not provided
    if not start_date:
        start_date = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%d")
    if not end_date:
        end_date = datetime.utcnow().strftime("%Y-%m-%d")
        
    s_date = datetime.strptime(start_date, "%Y-%m-%d")
    e_date = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
    
    # Query database and group by date string
    sales = (
        db.query(
            func.date(models.Sale.sale_date).label("date"),
            func.sum(models.Sale.revenue).label("revenue"),
            func.sum(models.Sale.quantity_sold * models.Product.cost_price).label("cost")
        )
        .join(models.Product)
        .filter(models.Sale.sale_date >= s_date)
        .filter(models.Sale.sale_date < e_date)
        .group_by(func.date(models.Sale.sale_date))
        .order_by("date")
        .all()
    )
    
    results = []
    for s in sales:
        revenue = float(s.revenue or 0.0)
        cost = float(s.cost or 0.0)
        profit = revenue - cost
        results.append({
            "date": s.date,
            "revenue": round(revenue, 2),
            "profit": round(profit, 2)
        })
        
    return results

@app.get("/sales/top-bottom", tags=["Sales"])
def get_top_bottom_selling(
    limit: int = 5,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["admin", "manager"]))
):
    """
    Get top and bottom selling products (by quantity).
    """
    # Group by product, sum quantities sold
    sales_grouped = (
        db.query(
            models.Product.name.label("name"),
            models.Product.sku.label("sku"),
            func.sum(models.Sale.quantity_sold).label("units"),
            func.sum(models.Sale.revenue).label("revenue")
        )
        .join(models.Sale)
        .group_by(models.Product.id)
        .all()
    )
    
    all_products = []
    for row in sales_grouped:
        all_products.append({
            "product_name": row.name,
            "sku": row.sku,
            "units_sold": int(row.units or 0),
            "revenue": round(float(row.revenue or 0.0), 2)
        })
        
    # Sort
    sorted_products = sorted(all_products, key=lambda x: x["units_sold"], reverse=True)
    
    top_products = sorted_products[:limit]
    bottom_products = sorted_products[::-1][:limit] # Reverse order
    
    return {
        "top": top_products,
        "bottom": bottom_products
    }

@app.get("/sales/category", response_model=List[schemas.CategorySalesItem], tags=["Sales"])
def get_category_sales(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["admin", "manager"]))
):
    """
    Get sales breakdown by product category.
    """
    # Sum revenue per category
    cat_sales = (
        db.query(
            models.Product.category.label("category"),
            func.sum(models.Sale.revenue).label("revenue")
        )
        .join(models.Sale)
        .group_by(models.Product.category)
        .all()
    )
    
    total_revenue = sum(float(row.revenue or 0.0) for row in cat_sales)
    
    results = []
    for row in cat_sales:
        rev = float(row.revenue or 0.0)
        pct = (rev / total_revenue) * 100 if total_revenue > 0 else 0.0
        results.append({
            "category": row.category,
            "revenue": round(rev, 2),
            "percentage": round(pct, 2)
        })
        
    return results


# ==========================================
# AI STOCK PREDICTION / FORECASTING
# ==========================================

@app.get("/predict/{sku}", response_model=schemas.PredictionResponse, tags=["AI Forecast"])
def predict_stock_demand(sku: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Trigger demand forecasting model (Prophet with fallback) for the selected product SKU.
    """
    try:
        forecast_result = get_forecast_for_sku(db, sku)
        return forecast_result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting engine error: {str(e)}")


# ==========================================
# ALERTS & NOTIFICATIONS
# ==========================================

@app.get("/alerts", tags=["Alerts"])
def get_inventory_alerts(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Generate inventory alerts for low-stock and over-stock levels.
    """
    products = db.query(models.Product).all()
    alerts = []
    
    for p in products:
        total_inv = sum(item.quantity for item in p.inventory)
        
        # Low Stock alert
        if total_inv < p.reorder_level:
            severity = "critical" if total_inv == 0 else "warning"
            alerts.append({
                "product_id": p.id,
                "product_name": p.name,
                "sku": p.sku,
                "category": p.category,
                "current_stock": total_inv,
                "reorder_level": p.reorder_level,
                "type": "low_stock",
                "severity": severity,
                "message": f"Stock level for '{p.name}' is low ({total_inv} left, reorder level is {p.reorder_level})."
            })
            
        # Over-stock alert: inventory is more than 5 times the reorder level AND reorder level > 0
        elif p.reorder_level > 0 and total_inv > p.reorder_level * 5:
            alerts.append({
                "product_id": p.id,
                "product_name": p.name,
                "sku": p.sku,
                "category": p.category,
                "current_stock": total_inv,
                "reorder_level": p.reorder_level,
                "type": "overstock",
                "severity": "info",
                "message": f"Potential overstock for '{p.name}' ({total_inv} units, reorder level is {p.reorder_level})."
            })
            
    return alerts


# ==========================================
# PURCHASE ORDERS
# ==========================================

@app.get("/purchase-orders", response_model=List[schemas.PurchaseOrderOut], tags=["Purchase Orders"])
def list_purchase_orders(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    List all generated purchase orders.
    """
    return db.query(models.PurchaseOrder).order_by(models.PurchaseOrder.order_date.desc()).all()

@app.post("/purchase-orders", response_model=schemas.PurchaseOrderOut, status_code=201, tags=["Purchase Orders"])
def create_purchase_order(
    po_in: schemas.PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["admin", "manager"]))
):
    """
    Generate a new purchase order. (Admin and Manager only)
    """
    product = db.query(models.Product).filter(models.Product.id == po_in.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
        
    new_po = models.PurchaseOrder(
        product_id=po_in.product_id,
        quantity=po_in.quantity,
        status=po_in.status, # pending, ordered
        expected_date=po_in.expected_date,
        order_date=datetime.utcnow()
    )
    db.add(new_po)
    db.commit()
    db.refresh(new_po)
    return new_po

@app.put("/purchase-orders/{id}", response_model=schemas.PurchaseOrderOut, tags=["Purchase Orders"])
def update_purchase_order_status(
    id: int,
    po_update: schemas.PurchaseOrderUpdate,
    warehouse_id: Optional[int] = Query(None, description="Warehouse to receive stock into. Required if status is received"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["admin", "manager"]))
):
    """
    Update purchase order status. If marked as 'received', stock is automatically added to the target warehouse.
    """
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found.")
        
    old_status = po.status
    new_status = po_update.status.lower()
    
    if old_status == "received":
        raise HTTPException(status_code=400, detail="Purchase order is already received. Cannot change status.")
        
    if new_status == "received":
        if not warehouse_id:
            # Fallback: check if we have any warehouse
            first_w = db.query(models.Warehouse).first()
            if not first_w:
                raise HTTPException(status_code=400, detail="No warehouses exist to receive stock into.")
            warehouse_id = first_w.id
            
        # Add stock transaction
        trans_schema = schemas.InventoryTransactionCreate(
            product_id=po.product_id,
            warehouse_id=warehouse_id,
            quantity_change=po.quantity,
            transaction_type="received"
        )
        record_inventory_transaction(trans_schema, db, current_user)
        
    po.status = new_status
    db.commit()
    db.refresh(po)
    return po


# ==========================================
# REPORTS EXPORTS (CSV / PDF)
# ==========================================

@app.get("/reports/export", tags=["Reports"])
def export_report(
    type: str = Query(..., description="Report type: 'sales' or 'inventory'"),
    format: str = Query(..., description="Format: 'csv' or 'pdf'"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.RoleChecker(["admin", "manager"]))
):
    """
    Export reports as CSV or PDF. (Admin and Manager only)
    """
    if format.lower() == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        
        if type.lower() == "sales":
            # Header
            writer.writerow(["Sale ID", "Date", "SKU", "Product Name", "Category", "Quantity Sold", "Cost Price", "Selling Price", "Revenue", "Profit"])
            sales = db.query(models.Sale).join(models.Product).order_by(models.Sale.sale_date.desc()).all()
            for s in sales:
                cost = s.quantity_sold * s.product.cost_price
                profit = s.revenue - cost
                writer.writerow([
                    s.id,
                    s.sale_date.strftime("%Y-%m-%d %H:%M:%S"),
                    s.product.sku,
                    s.product.name,
                    s.product.category,
                    s.quantity_sold,
                    s.product.cost_price,
                    s.product.selling_price,
                    s.revenue,
                    round(profit, 2)
                ])
                
        elif type.lower() == "inventory":
            # Header
            writer.writerow(["Product ID", "SKU", "Product Name", "Category", "Supplier", "Reorder Level", "Warehouse", "Stock Quantity", "Stock Value (at Cost)", "Stock Value (at Retail)"])
            inventory_items = db.query(models.Inventory).join(models.Product).join(models.Warehouse).all()
            for item in inventory_items:
                val_cost = item.quantity * item.product.cost_price
                val_retail = item.quantity * item.product.selling_price
                writer.writerow([
                    item.product_id,
                    item.product.sku,
                    item.product.name,
                    item.product.category,
                    item.product.supplier.name if item.product.supplier else "N/A",
                    item.product.reorder_level,
                    item.warehouse.name,
                    item.quantity,
                    round(val_cost, 2),
                    round(val_retail, 2)
                ])
        else:
            raise HTTPException(status_code=400, detail="Invalid report type. Use 'sales' or 'inventory'")
            
        csv_data = output.getvalue()
        output.close()
        
        headers = {
            "Content-Disposition": f"attachment; filename={type}_report_{datetime.now().strftime('%Y%m%d')}.csv"
        }
        return Response(content=csv_data, media_type="text/csv", headers=headers)
        
    elif format.lower() == "pdf":
        # Generate a structured HTML/CSS layout and convert to PDF or write standard PDF streams using ReportLab.
        # ReportLab lets us write canvas streams dynamically.
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib import colors
            
            pdf_buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                pdf_buffer,
                pagesize=letter,
                rightMargin=30,
                leftMargin=30,
                topMargin=30,
                bottomMargin=30
            )
            
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'ReportTitle',
                parent=styles['Heading1'],
                fontSize=20,
                leading=24,
                textColor=colors.HexColor("#1e293b"),
                spaceAfter=15
            )
            meta_style = ParagraphStyle(
                'ReportMeta',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor("#64748b"),
                spaceAfter=20
            )
            
            story = []
            
            # Title
            story.append(Paragraph(f"Smart Inventory System - {type.capitalize()} Report", title_style))
            story.append(Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Admin access logs verified", meta_style))
            story.append(Spacer(1, 10))
            
            if type.lower() == "sales":
                sales = db.query(models.Sale).join(models.Product).order_by(models.Sale.sale_date.desc()).limit(100).all()
                
                # Table Data
                data = [["Date", "SKU", "Product Name", "Qty", "Revenue", "Profit"]]
                total_rev = 0
                total_profit = 0
                
                for s in sales:
                    cost = s.quantity_sold * s.product.cost_price
                    profit = s.revenue - cost
                    total_rev += s.revenue
                    total_profit += profit
                    
                    data.append([
                        s.sale_date.strftime("%Y-%m-%d"),
                        s.product.sku,
                        s.product.name[:25],
                        str(s.quantity_sold),
                        f"Rs. {s.revenue:,.2f}",
                        f"Rs. {profit:,.2f}"
                    ])
                    
                # Add summary row
                data.append(["TOTALS", "", "", "", f"Rs. {total_rev:,.2f}", f"Rs. {total_profit:,.2f}"])
                
                t = Table(data, colWidths=[70, 70, 180, 50, 80, 80])
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0f172a")),
                    ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
                    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0,0), (-1,0), 10),
                    ('BOTTOMPADDING', (0,0), (-1,0), 6),
                    ('BACKGROUND', (0,1), (-1,-2), colors.HexColor("#f8fafc")),
                    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
                    ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
                    ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#e2e8f0")),
                ]))
                story.append(t)
                
            elif type.lower() == "inventory":
                inventory_items = db.query(models.Inventory).join(models.Product).join(models.Warehouse).all()
                data = [["SKU", "Product Name", "Warehouse", "Stock Level", "Reorder Lvl", "Est Cost Value"]]
                
                total_qty = 0
                total_cost_val = 0
                
                for item in inventory_items:
                    cost_val = item.quantity * item.product.cost_price
                    total_qty += item.quantity
                    total_cost_val += cost_val
                    
                    data.append([
                        item.product.sku,
                        item.product.name[:25],
                        item.warehouse.name,
                        str(item.quantity),
                        str(item.product.reorder_level),
                        f"Rs. {cost_val:,.2f}"
                    ])
                    
                data.append(["TOTALS", "", "", str(total_qty), "", f"Rs. {total_cost_val:,.2f}"])
                
                t = Table(data, colWidths=[75, 175, 100, 70, 70, 90])
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0f172a")),
                    ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
                    ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                    ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0,0), (-1,0), 10),
                    ('BOTTOMPADDING', (0,0), (-1,0), 6),
                    ('BACKGROUND', (0,1), (-1,-2), colors.HexColor("#f8fafc")),
                    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
                    ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
                    ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#e2e8f0")),
                ]))
                story.append(t)
            else:
                raise HTTPException(status_code=400, detail="Invalid report type.")
                
            doc.build(story)
            pdf_bytes = pdf_buffer.getvalue()
            pdf_buffer.close()
            
            headers = {
                "Content-Disposition": f"attachment; filename={type}_report_{datetime.now().strftime('%Y%m%d')}.pdf"
            }
            return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
            
        except ImportError:
            # Fallback if ReportLab is not available on user system
            logger.error("ReportLab not installed. Unable to export PDF. Return text preview.")
            text_fallback = f"Smart Inventory Management System - {type.upper()} PDF REPORT FALLBACK\n"
            text_fallback += f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
            text_fallback += "Please install 'reportlab' using requirements.txt to enable fully formatted PDF files.\n\n"
            
            if type.lower() == "sales":
                text_fallback += "DATE\t\tSKU\t\tPRODUCT\t\tQTY\tREVENUE\n"
                sales = db.query(models.Sale).join(models.Product).order_by(models.Sale.sale_date.desc()).limit(20).all()
                for s in sales:
                    text_fallback += f"{s.sale_date.strftime('%Y-%m-%d')}\t{s.product.sku}\t{s.product.name[:15]}\t{s.quantity_sold}\tRs. {s.revenue:.2f}\n"
            else:
                text_fallback += "SKU\t\tPRODUCT\t\tWAREHOUSE\tQTY\tREORDER LEVEL\n"
                inventory_items = db.query(models.Inventory).join(models.Product).join(models.Warehouse).all()
                for item in inventory_items:
                    text_fallback += f"{item.product.sku}\t{item.product.name[:15]}\t{item.warehouse.name[:10]}\t{item.quantity}\t{item.product.reorder_level}\n"
                    
            headers = {
                "Content-Disposition": f"attachment; filename={type}_report_{datetime.now().strftime('%Y%m%d')}.txt"
            }
            return Response(content=text_fallback, media_type="text/plain", headers=headers)
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Use 'csv' or 'pdf'")
