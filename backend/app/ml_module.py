import logging
import math
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from .models import Product, Sale, Inventory, Supplier

logger = logging.getLogger("ml_module")

try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False
    logger.warning("Prophet not installed. ML module will use seasonal moving average fallback.")

def get_historical_sales(db: Session, product_id: int) -> pd.DataFrame:
    """
    Fetch historical daily sales for a product and return as a pandas DataFrame.
    """
    sales = (
        db.query(Sale)
        .filter(Sale.product_id == product_id)
        .order_by(Sale.sale_date.asc())
        .all()
    )
    
    if not sales:
        return pd.DataFrame(columns=["ds", "y"])
        
    data = []
    for s in sales:
        # Normalize date to YYYY-MM-DD
        date_str = s.sale_date.strftime("%Y-%m-%d")
        data.append({"ds": date_str, "y": s.quantity_sold})
        
    df = pd.DataFrame(data)
    # Group by day to aggregate multiple transactions on the same day
    df = df.groupby("ds", as_index=False).sum()
    df["ds"] = pd.to_datetime(df["ds"])
    return df

def generate_prophet_forecast(df: pd.DataFrame, days: int) -> List[Dict[str, Any]]:
    """
    Generate forecast using Facebook Prophet.
    """
    # Prophet requires 'ds' (datetime) and 'y' (value) columns
    m = Prophet(
        daily_seasonality=False,
        weekly_seasonality=True,
        yearly_seasonality=False,
        interval_width=0.95 # 95% confidence interval
    )
    m.fit(df)
    
    future = m.make_future_dataframe(periods=days)
    forecast = m.predict(future)
    
    # We only want the predicted days (rows after historical data ends)
    pred_df = forecast.tail(days)
    
    results = []
    for _, row in pred_df.iterrows():
        results.append({
            "date": row["ds"].strftime("%Y-%m-%d"),
            "forecast": max(0.0, float(row["yhat"])),
            "lower_bound": max(0.0, float(row["yhat_lower"])),
            "upper_bound": max(0.0, float(row["yhat_upper"]))
        })
    return results

def generate_fallback_forecast(df: pd.DataFrame, days: int) -> List[Dict[str, Any]]:
    """
    Generate forecast using seasonal moving average and exponential smoothing fallback.
    Ideal when Prophet is missing or dataset is small (< 30 records).
    """
    # Calculate base rolling mean & std dev
    if len(df) > 0:
        recent_y = df["y"].values
        mean_sales = float(np.mean(recent_y))
        std_sales = float(np.std(recent_y)) if len(recent_y) > 1 else 1.0
    else:
        mean_sales = 2.0
        std_sales = 1.0

    # Calculate weekly seasonal factors (0 = Monday, 6 = Sunday)
    seasonal_factors = {i: 1.0 for i in range(7)}
    if len(df) >= 7:
        df["weekday"] = df["ds"].dt.weekday
        weekday_means = df.groupby("weekday")["y"].mean()
        overall_mean = df["y"].mean()
        if overall_mean > 0:
            for w in range(7):
                if w in weekday_means:
                    seasonal_factors[w] = float(weekday_means[w] / overall_mean)

    # Let's forecast forward
    last_date = df["ds"].max() if len(df) > 0 else datetime.utcnow()
    results = []
    
    # Introduce a slight trend factor based on the last 30 days vs previous 30 days
    trend = 1.0
    if len(df) >= 30:
        recent_30 = df["y"].tail(15).mean()
        prev_30 = df["y"].iloc[-30:-15].mean()
        if prev_30 > 0:
            trend_val = recent_30 / prev_30
            # Clamp trend to prevent crazy compounding
            trend = max(0.8, min(1.2, trend_val))

    for i in range(1, days + 1):
        fc_date = last_date + timedelta(days=i)
        weekday = fc_date.weekday()
        
        # Forecast value is base mean * trend * seasonal factor
        # Add some progressive uncertainty the further out we predict
        forecast_val = max(0.0, mean_sales * (trend ** (i / 30.0)) * seasonal_factors[weekday])
        
        # Uncertainty band widens over time
        uncertainty = std_sales * (1.0 + 0.1 * math.sqrt(i))
        
        results.append({
            "date": fc_date.strftime("%Y-%m-%d"),
            "forecast": round(forecast_val, 2),
            "lower_bound": round(max(0.0, forecast_val - 1.96 * uncertainty), 2),
            "upper_bound": round(forecast_val + 1.96 * uncertainty, 2)
        })
        
    return results

def detect_anomaly(df: pd.DataFrame, recent_days: int = 7) -> bool:
    """
    Flags whether the actual sales in the recent days deviate significantly (2.5 std devs)
    from the running historical mean.
    """
    if len(df) < 14:
        return False
        
    historical_y = df["y"].iloc[:-recent_days].values
    recent_y = df["y"].iloc[-recent_days:].values
    
    hist_mean = np.mean(historical_y)
    hist_std = np.std(historical_y)
    
    if hist_std == 0:
        hist_std = 1.0
        
    # Check if any recent day sales are anomalies
    for val in recent_y:
        z_score = abs(val - hist_mean) / hist_std
        if z_score > 2.5:
            return True
            
    return False

def calculate_inventory_metrics(
    db: Session, product: Product, df: pd.DataFrame
) -> Tuple[int, int, bool]:
    """
    Calculates safety stock, reorder point, suggested reorder qty, and anomaly flag.
    Returns: (reorder_point, suggested_reorder_qty, anomaly_flag)
    """
    # Fetch lead time from supplier
    lead_time = 7
    if product.supplier:
        lead_time = product.supplier.lead_time_days
        
    # Get current inventory
    current_inventory = sum(item.quantity for item in product.inventory)
    
    # Defaults in case of no data
    if df.empty or len(df) < 5:
        reorder_point = product.reorder_level
        suggested_qty = max(0, (reorder_point * 2) - current_inventory)
        return reorder_point, suggested_qty, False

    # Stats calculations
    avg_daily_sales = float(df["y"].mean())
    std_daily_sales = float(df["y"].std()) if len(df) > 1 else 1.0
    
    # Reorder Point = (Lead Time * Avg Daily Sales) + Safety Stock
    # Safety Stock = Z-score (1.65 for 95% service level) * Std Dev * sqrt(Lead Time)
    safety_stock = max(5.0, 1.65 * std_daily_sales * math.sqrt(lead_time))
    reorder_point = int(math.ceil((lead_time * avg_daily_sales) + safety_stock))
    
    # If current stock is below reorder point, suggest replenishing up to twice the reorder level
    if current_inventory <= reorder_point:
        suggested_qty = int(max(0, (reorder_point * 2) - current_inventory))
    else:
        suggested_qty = 0
        
    # Anomaly flag
    anomaly_flag = detect_anomaly(df, recent_days=5)
    
    return reorder_point, suggested_qty, anomaly_flag

def get_forecast_for_sku(db: Session, sku: str) -> Dict[str, Any]:
    """
    Main entry point for generating forecasting metrics for a SKU.
    """
    product = db.query(Product).filter(Product.sku == sku).first()
    if not product:
        raise ValueError(f"Product with SKU '{sku}' not found.")
        
    df = get_historical_sales(db, product.id)
    current_inventory = sum(item.quantity for item in product.inventory)
    
    # Select forecast algorithm
    forecast_days = 90
    forecast_points = []
    
    if PROPHET_AVAILABLE and len(df) >= 30:
        try:
            forecast_points = generate_prophet_forecast(df, forecast_days)
        except Exception as e:
            logger.error(f"Prophet forecast failed: {e}. Falling back...")
            forecast_points = generate_fallback_forecast(df, forecast_days)
    else:
        forecast_points = generate_fallback_forecast(df, forecast_days)
        
    # Compute aggregate forecast sums
    forecast_7 = sum(pt["forecast"] for pt in forecast_points[:7])
    forecast_30 = sum(pt["forecast"] for pt in forecast_points[:30])
    forecast_90 = sum(pt["forecast"] for pt in forecast_points[:90])
    
    reorder_point, suggested_qty, anomaly_flag = calculate_inventory_metrics(db, product, df)
    
    return {
        "sku": product.sku,
        "product_name": product.name,
        "current_stock": current_inventory,
        "forecast_7_days": round(forecast_7, 2),
        "forecast_30_days": round(forecast_30, 2),
        "forecast_90_days": round(forecast_90, 2),
        "reorder_point": reorder_point,
        "suggested_reorder_qty": suggested_qty,
        "anomaly_flag": anomaly_flag,
        "forecast_data": forecast_points
    }
