"""
Retail Demand Forecasting – FastAPI Backend
=============================================
Serves the trained XGBoost model as a REST API.
Users only provide Store ID, Date, and business levers.
Static store features are auto-looked-up from store_lookup.json.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "..", "model")
MODEL_PATH = os.path.join(MODEL_DIR, "demand_model.pkl")
FEATURES_PATH = os.path.join(MODEL_DIR, "feature_columns.json")
STORE_LOOKUP_PATH = os.path.join(BASE_DIR, "store_lookup.json")

# ─── Load model, features & store lookup at startup ───────────────────────────
model = joblib.load(MODEL_PATH)
with open(FEATURES_PATH) as f:
    FEATURE_COLUMNS = json.load(f)
with open(STORE_LOOKUP_PATH) as f:
    STORE_LOOKUP = json.load(f)

# ─── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="Retail Demand Forecasting API",
    description="Predicts expected daily sales for a retail store using XGBoost",
    version="2.0.0",
)

# ── CORS for React dev-server ─────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response schemas ───────────────────────────────────────────────
class PredictionRequest(BaseModel):
    store: int = Field(..., ge=1, le=1115, description="Store ID (1-1115)")
    date: str = Field(..., description="Prediction date in YYYY-MM-DD format")
    promo: int = Field(0, ge=0, le=1, description="Promo active? 0=No, 1=Yes")
    school_holiday: int = Field(0, ge=0, le=1, description="School Holiday? 0=No, 1=Yes")
    is_state_holiday: int = Field(0, ge=0, le=1, description="State Holiday? 0=No, 1=Yes")


class PredictionResponse(BaseModel):
    predicted_sales: float
    store: int
    date: str
    status: str = "success"


# ─── Endpoints ────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "features": FEATURE_COLUMNS,
        "total_stores": len(STORE_LOOKUP),
    }


@app.get("/stores")
def get_stores():
    """Return list of all available store IDs."""
    return {"stores": sorted([int(k) for k in STORE_LOOKUP.keys()])}


@app.post("/predict", response_model=PredictionResponse)
def predict(req: PredictionRequest):
    try:
        # ── Validate store exists in lookup ───────────────────────────────
        store_key = str(req.store)
        if store_key not in STORE_LOOKUP:
            raise HTTPException(
                status_code=404,
                detail=f"Store {req.store} not found in lookup data"
            )

        store_info = STORE_LOOKUP[store_key]

        # ── Parse the date string ─────────────────────────────────────────
        try:
            pred_date = datetime.strptime(req.date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid date format. Use YYYY-MM-DD."
            )

        year = pred_date.year
        month = pred_date.month
        day = pred_date.day
        # isoweekday(): Mon=1 … Sun=7 (matches Rossmann DayOfWeek encoding)
        day_of_week = pred_date.isoweekday()

        # ── Compute dynamic feature: Competitor_Open_Months ───────────────
        comp_open_year = store_info.get("CompetitionOpenSinceYear", 0)
        comp_open_month = store_info.get("CompetitionOpenSinceMonth", 0)

        if comp_open_year > 0 and comp_open_month > 0:
            competitor_open_months = (
                12 * (year - comp_open_year) + (month - comp_open_month)
            )
            competitor_open_months = max(0, competitor_open_months)
        else:
            competitor_open_months = 0

        # ── Build the feature row ─────────────────────────────────────────
        input_data = {
            "Store": req.store,
            "DayOfWeek": day_of_week,
            "Open": 1,  # store is always open when predicting
            "Promo": req.promo,
            "SchoolHoliday": req.school_holiday,
            "StoreType": store_info["StoreType"],
            "Assortment": store_info["Assortment"],
            "CompetitionDistance": store_info["CompetitionDistance"],
            "Promo2": store_info["Promo2"],
            "Promo2SinceWeek": store_info["Promo2SinceWeek"],
            "Promo2SinceYear": store_info["Promo2SinceYear"],
            "Year": year,
            "Month": month,
            "Day": day,
            "Is_StateHoliday": req.is_state_holiday,
            "Competitor_Open_Months": competitor_open_months,
        }

        df = pd.DataFrame([input_data])[FEATURE_COLUMNS]
        prediction = model.predict(df)[0]

        # Ensure prediction is non-negative
        predicted_sales = float(max(0, round(prediction, 2)))

        return PredictionResponse(
            predicted_sales=predicted_sales,
            store=req.store,
            date=req.date,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Run with: uvicorn main:app --reload --port 8000 ─────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
