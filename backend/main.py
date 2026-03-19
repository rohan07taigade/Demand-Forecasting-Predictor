
import os
import json
import joblib
import numpy as np
import pandas as pd
import shap
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional

#Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "..", "model")
MODEL_PATH = os.path.join(MODEL_DIR, "demand_model.pkl")
FEATURES_PATH = os.path.join(MODEL_DIR, "feature_columns.json")
STORE_LOOKUP_PATH = os.path.join(BASE_DIR, "store_lookup.json")

#Load model, features, store lookup & SHAP explainer at startup
model = joblib.load(MODEL_PATH)
with open(FEATURES_PATH) as f:
    FEATURE_COLUMNS = json.load(f)
with open(STORE_LOOKUP_PATH) as f:
    STORE_LOOKUP = json.load(f)

# SHAP TreeExplainer for XGBoost (fast, exact for tree models)
explainer = shap.TreeExplainer(model)

# Human-friendly feature labels
FEATURE_LABELS = {
    "Store": "Store ID",
    "DayOfWeek": "Day of Week",
    "Open": "Store Open",
    "Promo": "Active Promotion",
    "SchoolHoliday": "School Holiday",
    "StoreType": "Store Type",
    "Assortment": "Assortment Level",
    "CompetitionDistance": "Competitor Proximity",
    "Promo2": "Continuing Promo",
    "Promo2SinceWeek": "Promo2 Start Week",
    "Promo2SinceYear": "Promo2 Start Year",
    "Year": "Year",
    "Month": "Seasonality (Month)",
    "Day": "Day of Month",
    "Is_StateHoliday": "State Holiday",
    "Competitor_Open_Months": "Competitor Duration",
}

#FastAPI App
app = FastAPI(
    title="Retail Demand Forecasting API",
    description="Predicts daily sales using XGBoost with SHAP explainability",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


#Schemas
class PredictionRequest(BaseModel):
    store: int = Field(..., ge=1, le=1115)
    date: str = Field(..., description="YYYY-MM-DD")
    promo: int = Field(0, ge=0, le=1)
    school_holiday: int = Field(0, ge=0, le=1)
    is_state_holiday: int = Field(0, ge=0, le=1)


class DriverItem(BaseModel):
    feature: str
    label: str
    impact: float
    direction: str  # "up" or "down"


class PredictionResponse(BaseModel):
    predicted_sales: float
    store: int
    date: str
    status: str = "success"
    drivers: List[DriverItem] = []


class ForecastDay(BaseModel):
    date: str
    day_name: str
    predicted_sales: float


class ForecastResponse(BaseModel):
    store: int
    start_date: str
    forecast: List[ForecastDay]
    status: str = "success"


class CompareRequest(BaseModel):
    store: int = Field(..., ge=1, le=1115)
    date: str = Field(..., description="YYYY-MM-DD")
    scenario_a: dict = Field(..., description="First scenario overrides")
    scenario_b: dict = Field(..., description="Second scenario overrides")


class ScenarioResult(BaseModel):
    label: str
    predicted_sales: float
    settings: dict


class CompareResponse(BaseModel):
    store: int
    date: str
    scenario_a: ScenarioResult
    scenario_b: ScenarioResult
    difference: float
    status: str = "success"


#Helpers
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _parse_date(date_str: str) -> datetime:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")


def _get_store(store_id: int) -> dict:
    key = str(store_id)
    if key not in STORE_LOOKUP:
        raise HTTPException(status_code=404, detail=f"Store {store_id} not found")
    return STORE_LOOKUP[key]


def _build_features(store_id: int, pred_date: datetime, promo: int,
                    school_holiday: int, is_state_holiday: int) -> dict:
    store = _get_store(store_id)
    year, month, day = pred_date.year, pred_date.month, pred_date.day
    dow = pred_date.isoweekday()

    comp_y = store.get("CompetitionOpenSinceYear", 0)
    comp_m = store.get("CompetitionOpenSinceMonth", 0)
    comp_months = max(0, 12 * (year - comp_y) + (month - comp_m)) if comp_y > 0 and comp_m > 0 else 0

    return {
        "Store": store_id,
        "DayOfWeek": dow,
        "Open": 1,
        "Promo": promo,
        "SchoolHoliday": school_holiday,
        "StoreType": store["StoreType"],
        "Assortment": store["Assortment"],
        "CompetitionDistance": store["CompetitionDistance"],
        "Promo2": store["Promo2"],
        "Promo2SinceWeek": store["Promo2SinceWeek"],
        "Promo2SinceYear": store["Promo2SinceYear"],
        "Year": year,
        "Month": month,
        "Day": day,
        "Is_StateHoliday": is_state_holiday,
        "Competitor_Open_Months": comp_months,
    }


def _predict_single(features: dict) -> float:
    df = pd.DataFrame([features])[FEATURE_COLUMNS]
    return float(max(0, round(model.predict(df)[0], 2)))


def _get_shap_drivers(features: dict, top_n: int = 5) -> list:
    df = pd.DataFrame([features])[FEATURE_COLUMNS]
    shap_values = explainer.shap_values(df)[0]

    indexed = [(FEATURE_COLUMNS[i], shap_values[i]) for i in range(len(FEATURE_COLUMNS))]
    indexed.sort(key=lambda x: abs(x[1]), reverse=True)

    drivers = []
    for feat, impact in indexed[:top_n]:
        if abs(impact) < 1:
            continue
        drivers.append(DriverItem(
            feature=feat,
            label=FEATURE_LABELS.get(feat, feat),
            impact=round(abs(impact), 2),
            direction="up" if impact > 0 else "down",
        ))
    return drivers


#Endpoints
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
    return {"stores": sorted([int(k) for k in STORE_LOOKUP.keys()])}


@app.post("/predict", response_model=PredictionResponse)
def predict(req: PredictionRequest):
    try:
        pred_date = _parse_date(req.date)
        features = _build_features(req.store, pred_date, req.promo,
                                   req.school_holiday, req.is_state_holiday)
        predicted = _predict_single(features)
        drivers = _get_shap_drivers(features)

        return PredictionResponse(
            predicted_sales=predicted,
            store=req.store,
            date=req.date,
            drivers=drivers,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/forecast", response_model=ForecastResponse)
def forecast(req: PredictionRequest):
    """Return predictions for 7 consecutive days starting from the given date."""
    try:
        start = _parse_date(req.date)
        days = []
        for i in range(7):
            d = start + timedelta(days=i)
            features = _build_features(req.store, d, req.promo,
                                       req.school_holiday, req.is_state_holiday)
            predicted = _predict_single(features)
            days.append(ForecastDay(
                date=d.strftime("%Y-%m-%d"),
                day_name=DAY_NAMES[d.weekday()],
                predicted_sales=predicted,
            ))

        return ForecastResponse(store=req.store, start_date=req.date, forecast=days)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/compare", response_model=CompareResponse)
def compare(req: CompareRequest):
    """Compare two scenarios (e.g. promo vs no-promo) for the same store & date."""
    try:
        pred_date = _parse_date(req.date)

        # Defaults
        base = {"promo": 0, "school_holiday": 0, "is_state_holiday": 0}

        a_settings = {**base, **req.scenario_a}
        b_settings = {**base, **req.scenario_b}

        feat_a = _build_features(req.store, pred_date,
                                 a_settings["promo"], a_settings["school_holiday"],
                                 a_settings["is_state_holiday"])
        feat_b = _build_features(req.store, pred_date,
                                 b_settings["promo"], b_settings["school_holiday"],
                                 b_settings["is_state_holiday"])

        sales_a = _predict_single(feat_a)
        sales_b = _predict_single(feat_b)

        return CompareResponse(
            store=req.store,
            date=req.date,
            scenario_a=ScenarioResult(
                label="Scenario A", predicted_sales=sales_a, settings=a_settings
            ),
            scenario_b=ScenarioResult(
                label="Scenario B", predicted_sales=sales_b, settings=b_settings
            ),
            difference=round(sales_b - sales_a, 2),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
