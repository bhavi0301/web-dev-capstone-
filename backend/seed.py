import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import engine, SessionLocal, Base
from app import models, auth

def seed_database():
    db: Session = SessionLocal()
    
    # 1. Clean existing database contents (if any)
    print("Recreating database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    print("Seeding users...")
    users_data = [
        {"name": "Admin User", "email": "admin@company.com", "password": "admin123", "role": "admin"},
        {"name": "Manager User", "email": "manager@company.com", "password": "manager123", "role": "manager"},
        {"name": "Staff User", "email": "staff@company.com", "password": "staff123", "role": "staff"},
    ]
    
    users = []
    for u in users_data:
        new_user = models.User(
            name=u["name"],
            email=u["email"],
            password_hash=auth.get_password_hash(u["password"]),
            role=u["role"]
        )
        db.add(new_user)
        users.append(new_user)
    db.commit()
    # Refresh users to get IDs
    for u in users:
        db.refresh(u)
    admin_user_id = users[0].id
    
    print("Seeding suppliers...")
    suppliers_data = [
        {"name": "Apex Electronics Supply", "contact": "sales@apexelectronics.com", "lead_time_days": 5},
        {"name": "Global Tech Distributors", "contact": "orders@globaltech.com", "lead_time_days": 8},
        {"name": "Prime Office Solutions", "contact": "support@primeoffice.com", "lead_time_days": 4},
        {"name": "Summit Apparel Wholesalers", "contact": "logistics@summitapparel.com", "lead_time_days": 10},
        {"name": "Sterling Logistics Group", "contact": "contact@sterlinglog.com", "lead_time_days": 6},
    ]
    suppliers = []
    for s in suppliers_data:
        new_sup = models.Supplier(
            name=s["name"],
            contact=s["contact"],
            lead_time_days=s["lead_time_days"]
        )
        db.add(new_sup)
        suppliers.append(new_sup)
    db.commit()
    for s in suppliers:
        db.refresh(s)
        
    print("Seeding warehouses...")
    warehouses_data = [
        {"name": "Main Warehouse", "location": "Sector 5, Industrial Area"},
        {"name": "East Coast Hub", "location": "Dockside Boulevard, New York"},
        {"name": "West Coast Depot", "location": "Gateway Logistics Park, Seattle"}
    ]
    warehouses = []
    for w in warehouses_data:
        new_wh = models.Warehouse(
            name=w["name"],
            location=w["location"]
        )
        db.add(new_wh)
        warehouses.append(new_wh)
    db.commit()
    for w in warehouses:
        db.refresh(w)
        
    print("Seeding 50+ products...")
    categories = ["Electronics", "Office Supplies", "Apparel", "Home & Kitchen", "Accessories"]
    
    product_pool = [
        # Electronics
        ("Smart LED Monitor 27\"", "ELEC-001", "Electronics", 150.0, 249.99, 15, 0),
        ("Mechanical Keyboard RGB", "ELEC-002", "Electronics", 45.0, 89.99, 20, 0),
        ("Wireless Noise-Cancelling Headphones", "ELEC-003", "Electronics", 80.0, 159.99, 12, 1),
        ("Ergonomic Wireless Mouse", "ELEC-004", "Electronics", 20.0, 39.99, 25, 1),
        ("Dual Band Wi-Fi 6 Router", "ELEC-005", "Electronics", 60.0, 119.99, 10, 0),
        ("HD Webcam with Microphone", "ELEC-006", "Electronics", 25.0, 49.99, 15, 1),
        ("External Hard Drive 2TB SSD", "ELEC-007", "Electronics", 75.0, 129.99, 18, 0),
        ("USB-C Multi-port Hub", "ELEC-008", "Electronics", 15.0, 29.99, 30, 4),
        ("Smart Home Assistant Speaker", "ELEC-009", "Electronics", 35.0, 59.99, 20, 1),
        ("Bluetooth Soundbar 80W", "ELEC-010", "Electronics", 55.0, 99.99, 8, 0),
        # Office Supplies
        ("Standing Desk Frame", "OFF-001", "Office Supplies", 120.0, 199.99, 10, 2),
        ("Ergonomic Mesh Chair", "OFF-002", "Office Supplies", 90.0, 179.99, 8, 2),
        ("Dry Erase Whiteboard 3x4'", "OFF-003", "Office Supplies", 18.0, 34.99, 15, 2),
        ("Steel Filing Cabinet 3-Drawer", "OFF-004", "Office Supplies", 50.0, 99.99, 5, 4),
        ("LED Desk Lamp with Qi Charger", "OFF-005", "Office Supplies", 15.0, 29.99, 20, 2),
        ("Heavy Duty Paper Shredder", "OFF-006", "Office Supplies", 40.0, 79.99, 8, 4),
        ("Premium Notebook Pack of 5", "OFF-007", "Office Supplies", 6.0, 12.99, 40, 2),
        ("Gel Pens Assorted Colors 24-Pack", "OFF-008", "Office Supplies", 5.0, 9.99, 50, 2),
        ("Desk Organizer Tray", "OFF-009", "Office Supplies", 8.0, 15.99, 35, 4),
        ("Under-Desk Foot Rest", "OFF-010", "Office Supplies", 12.0, 24.99, 15, 2),
        # Apparel
        ("Classic Crewneck Sweatshirt", "APP-001", "Apparel", 12.0, 29.99, 25, 3),
        ("Premium Slim-Fit Jeans", "APP-002", "Apparel", 18.0, 44.99, 20, 3),
        ("All-Weather Windbreaker Jacket", "APP-003", "Apparel", 22.0, 49.99, 15, 3),
        ("Activewear Running Shorts", "APP-004", "Apparel", 8.0, 19.99, 30, 3),
        ("Athletic Training Shoes", "APP-005", "Apparel", 30.0, 69.99, 15, 4),
        ("Cotton T-Shirt Multipack (3)", "APP-006", "Apparel", 9.0, 19.99, 40, 3),
        ("Polarized Sports Sunglasses", "APP-007", "Apparel", 10.0, 24.99, 20, 4),
        ("Leather Dress Belt", "APP-008", "Apparel", 11.0, 24.99, 15, 3),
        ("Performance Crew Socks 6-Pack", "APP-009", "Apparel", 5.0, 11.99, 50, 3),
        ("Knitted Beanie Hat", "APP-010", "Apparel", 4.0, 9.99, 30, 3),
        # Home & Kitchen
        ("Stainless Steel Electric Kettle", "HOME-001", "Home & Kitchen", 14.0, 29.99, 20, 4),
        ("Programmable Drip Coffee Maker", "HOME-002", "Home & Kitchen", 28.0, 59.99, 12, 4),
        ("Non-Stick Cookware Set 10pc", "HOME-003", "Home & Kitchen", 65.0, 119.99, 8, 4),
        ("Digital Food Kitchen Scale", "HOME-004", "Home & Kitchen", 6.0, 14.99, 30, 4),
        ("Personal Countertop Blender", "HOME-005", "Home & Kitchen", 16.0, 34.99, 15, 4),
        ("Insulated Stainless Water Bottle", "HOME-006", "Home & Kitchen", 8.0, 17.99, 25, 4),
        ("Air Fryer Max 5.8 Quart", "HOME-007", "Home & Kitchen", 45.0, 89.99, 10, 4),
        ("Chef's Knife 8-Inch Carbon Steel", "HOME-008", "Home & Kitchen", 18.0, 39.99, 15, 4),
        ("Silicone Cooking Utensils Set", "HOME-009", "Home & Kitchen", 11.0, 22.99, 20, 4),
        ("Food Storage Containers 24pc", "HOME-010", "Home & Kitchen", 13.0, 24.99, 18, 4),
        # Accessories / Travel
        ("Water-Resistant Laptop Backpack", "ACC-001", "Accessories", 20.0, 39.99, 25, 1),
        ("Leather Bi-Fold Wallet RFID", "ACC-002", "Accessories", 12.0, 24.99, 20, 1),
        ("Universal Travel Adapter Plug", "ACC-003", "Accessories", 7.0, 14.99, 35, 1),
        ("Folding Travel Umbrella Compact", "ACC-004", "Accessories", 6.0, 12.99, 25, 1),
        ("Hardside Carry-On Luggage 20\"", "ACC-005", "Accessories", 40.0, 79.99, 12, 4),
        ("Memory Foam Neck Pillow", "ACC-006", "Accessories", 8.0, 16.99, 20, 1),
        ("Luggage Scale Digital", "ACC-007", "Accessories", 5.0, 9.99, 30, 1),
        ("Tech Organizer Travel Pouch", "ACC-008", "Accessories", 9.0, 19.99, 25, 1),
        ("Car Key Fob Faraday Bag", "ACC-009", "Accessories", 4.0, 8.99, 40, 1),
        ("RFID Passport Holder Wallet", "ACC-010", "Accessories", 5.0, 9.99, 35, 1),
        # Low Stock trigger items explicitly seeded below
        ("Core Intel Core i9 Processor", "ELEC-999", "Electronics", 350.0, 529.99, 10, 0),
        ("Office Paper Box A4 Pack of 5", "OFF-999", "Office Supplies", 14.0, 24.99, 20, 2),
    ]
    
    products = []
    for p_tuple in product_pool:
        sup_idx = p_tuple[6]
        supplier_id = suppliers[sup_idx].id
        new_prod = models.Product(
            name=p_tuple[0],
            sku=p_tuple[1],
            category=p_tuple[2],
            cost_price=p_tuple[3],
            selling_price=p_tuple[4],
            reorder_level=p_tuple[5],
            supplier_id=supplier_id
        )
        db.add(new_prod)
        products.append(new_prod)
    db.commit()
    for p in products:
        db.refresh(p)
        
    print("Seeding product inventory levels across warehouses...")
    for idx, p in enumerate(products):
        # We will make some items fall below their reorder level to trigger alerts:
        # If the SKU ends in '999', let's seed tiny stock (e.g. 1 or 2 units).
        # For standard items, seed random inventory (e.g., 10 to 60 units per warehouse).
        is_low_stock = p.sku.endswith("999")
        
        for w in warehouses:
            if is_low_stock:
                qty = random.randint(0, 3) # critically low stock
            else:
                qty = random.randint(15, 60)
                
            inv = models.Inventory(
                product_id=p.id,
                warehouse_id=w.id,
                quantity=qty,
                updated_at=datetime.utcnow() - timedelta(days=random.randint(1, 30))
            )
            db.add(inv)
            
            # Add transaction tracking entry for initial stock
            if qty > 0:
                trans = models.InventoryTransaction(
                    product_id=p.id,
                    warehouse_id=w.id,
                    quantity_change=qty,
                    transaction_type="stock_in",
                    timestamp=datetime.utcnow() - timedelta(days=90),
                    user_id=admin_user_id
                )
                db.add(trans)
    db.commit()
    
    print("Seeding 6 months of historical daily sales...")
    # Seed historical sales.
    # To make Prophet forecast look stunning, we will generate daily/weekly sales for 180 days.
    # We will pick 10 top products to have solid, continuous daily sales.
    # The other 42 products will have sporadic sales (sales every few days).
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=180)
    
    # Track top SKUs for high frequency sales
    top_product_ids = [p.id for p in products[:8]]
    other_product_ids = [p.id for p in products[8:]]
    
    current_date = start_date
    sales_count = 0
    
    while current_date <= end_date:
        # Determine daily multiplier based on weekday (Friday/Saturday has peak sales, Tuesday has lower sales)
        weekday = current_date.weekday()
        if weekday in [4, 5]: # Fri, Sat
            day_multiplier = 1.4
        elif weekday == 1: # Tue
            day_multiplier = 0.7
        else:
            day_multiplier = 1.0
            
        # Add a positive growth trend over the 6 months (growing from 0.85 to 1.15)
        days_since_start = (current_date - start_date).days
        trend_multiplier = 0.85 + (0.3 * (days_since_start / 180.0))
        
        # 1. High frequency products: sales almost every day
        for pid in top_product_ids:
            prod = next(p for p in products if p.id == pid)
            # base quantity
            base_qty = random.randint(2, 6)
            qty_sold = int(round(base_qty * day_multiplier * trend_multiplier))
            if qty_sold > 0:
                revenue = qty_sold * prod.selling_price
                new_sale = models.Sale(
                    product_id=pid,
                    quantity_sold=qty_sold,
                    revenue=round(revenue, 2),
                    sale_date=current_date.replace(hour=random.randint(9, 20), minute=random.randint(0, 59))
                )
                db.add(new_sale)
                sales_count += 1
                
                # Write matching transaction log
                # For sales history, we don't strictly subtract from the inventory since we pre-seeded
                # inventory with current numbers (we treat sales history as a background seed).
                # We can write transaction log for sales
                trans = models.InventoryTransaction(
                    product_id=pid,
                    warehouse_id=warehouses[random.randint(0, 2)].id,
                    quantity_change=-qty_sold,
                    transaction_type="sale",
                    timestamp=new_sale.sale_date,
                    user_id=admin_user_id
                )
                db.add(trans)
                
        # 2. Sporadic products: sales on some days (approx 30% chance per day)
        for pid in other_product_ids:
            if random.random() < 0.25:
                prod = next(p for p in products if p.id == pid)
                base_qty = random.randint(1, 3)
                qty_sold = int(round(base_qty * day_multiplier * trend_multiplier))
                if qty_sold > 0:
                    revenue = qty_sold * prod.selling_price
                    new_sale = models.Sale(
                        product_id=pid,
                        quantity_sold=qty_sold,
                        revenue=round(revenue, 2),
                        sale_date=current_date.replace(hour=random.randint(9, 20), minute=random.randint(0, 59))
                    )
                    db.add(new_sale)
                    sales_count += 1
                    
                    trans = models.InventoryTransaction(
                        product_id=pid,
                        warehouse_id=warehouses[random.randint(0, 2)].id,
                        quantity_change=-qty_sold,
                        transaction_type="sale",
                        timestamp=new_sale.sale_date,
                        user_id=admin_user_id
                    )
                    db.add(trans)
                    
        # Commit in batches of 10 days to keep memory usage low
        if days_since_start % 10 == 0:
            db.commit()
            
        current_date += timedelta(days=1)
        
    db.commit()
    print(f"Seeded {sales_count} sales transactions.")
    
    print("Seeding Purchase Orders...")
    # Add some active purchase orders
    po_data = [
        {"prod_idx": 50, "qty": 100, "status": "pending", "days_lead": 5}, # low stock item Elec-999
        {"prod_idx": 51, "qty": 150, "status": "ordered", "days_lead": 8}, # low stock item Off-999
        {"prod_idx": 2, "qty": 50, "status": "received", "days_lead": -3}, # completed PO
        {"prod_idx": 15, "qty": 30, "status": "pending", "days_lead": 4},
    ]
    
    for item in po_data:
        p = products[item["prod_idx"]]
        lead_days = item["days_lead"]
        order_dt = datetime.utcnow() - timedelta(days=abs(lead_days) + 2)
        expected_dt = order_dt + timedelta(days=abs(lead_days))
        
        new_po = models.PurchaseOrder(
            product_id=p.id,
            quantity=item["qty"],
            status=item["status"],
            order_date=order_dt,
            expected_date=expected_dt
        )
        db.add(new_po)
    db.commit()
    
    db.close()
    print("Database seeding completed successfully!")

if __name__ == "__main__":
    seed_database()
