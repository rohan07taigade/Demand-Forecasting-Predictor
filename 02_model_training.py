"""
Retail Demand Forecasting - Model Training Script
===================================================
This script trains an XGBoost model on the Rossmann Store Sales data.
It replicates the data cleaning and feature engineering from the EDA notebook,
trains the model, evaluates it, and saves the trained model + feature info.
"""

import pandas as pd
import numpy as np
import json
import os
import joblib
from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

# ─── Configuration ───────────────────────────────────────────────────────────
DATA_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(DATA_DIR, "model")
os.makedirs(MODEL_DIR, exist_ok=True)

TRAIN_CSV = os.path.join(DATA_DIR, "train.csv")
STORE_CSV = os.path.join(DATA_DIR, "store.csv")
MODEL_PATH = os.path.join(MODEL_DIR, "demand_model.pkl")
FEATURES_PATH = os.path.join(MODEL_DIR, "feature_columns.json")


def load_and_prepare_data():
    """Load and merge datasets, then perform feature engineering."""
    print("📂 Loading datasets...")
    train_df = pd.read_csv(TRAIN_CSV, low_memory=False)
    store_df = pd.read_csv(STORE_CSV)

    print(f"   Training Data Shape: {train_df.shape}")
    print(f"   Store Info Shape:    {store_df.shape}")

    # ── Clean store data ──────────────────────────────────────────────────
    store_df['CompetitionDistance'] = store_df['CompetitionDistance'].fillna(
        store_df['CompetitionDistance'].median()
    )
    store_df = store_df.fillna(0)

    # ── Merge ─────────────────────────────────────────────────────────────
    df = pd.merge(train_df, store_df, on='Store', how='left')
    df['Date'] = pd.to_datetime(df['Date'])

    # ── Time features ─────────────────────────────────────────────────────
    df['Year']  = df['Date'].dt.year
    df['Month'] = df['Date'].dt.month
    df['Day']   = df['Date'].dt.day

    # ── Keep only open stores with sales > 0 ──────────────────────────────
    df_open = df[(df['Open'] == 1) & (df['Sales'] > 0)].copy()
    print(f"   After filtering (Open & Sales>0): {df_open.shape}")

    # ── Feature engineering ───────────────────────────────────────────────
    df_open['StateHoliday'] = df_open['StateHoliday'].astype(str)
    df_open['Is_StateHoliday'] = df_open['StateHoliday'].apply(
        lambda x: 0 if x == '0' else 1
    )

    df_open['StoreType']  = df_open['StoreType'].astype('category').cat.codes
    df_open['Assortment'] = df_open['Assortment'].astype('category').cat.codes

    df_open['Competitor_Open_Months'] = (
        12 * (df_open['Year'] - df_open['CompetitionOpenSinceYear'])
        + (df_open['Month'] - df_open['CompetitionOpenSinceMonth'])
    )
    df_open['Competitor_Open_Months'] = df_open['Competitor_Open_Months'].apply(
        lambda x: x if x > 0 else 0
    )

    # ── Drop unnecessary columns ──────────────────────────────────────────
    columns_to_drop = [
        'Date', 'StateHoliday', 'CompetitionOpenSinceYear',
        'CompetitionOpenSinceMonth', 'PromoInterval', 'Customers',
    ]
    df_ml = df_open.drop(columns=columns_to_drop)
    print(f"   Final ML-ready shape: {df_ml.shape}")
    return df_ml


def train_model(df_ml):
    """Train XGBoost with a time-aware split (chronological)."""
    # ── Split features / target ───────────────────────────────────────────
    target = 'Sales'
    feature_cols = [c for c in df_ml.columns if c != target]
    X = df_ml[feature_cols]
    y = df_ml[target]

    # ── Time-aware split: first 80 % for training, last 20 % for test ────
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
    print(f"\n🔀 Train/Test split  →  Train: {X_train.shape[0]}  |  Test: {X_test.shape[0]}")

    # ── Train ─────────────────────────────────────────────────────────────
    print("\n🚀 Training XGBoost model...")
    model = XGBRegressor(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=20,
    )

    # ── Evaluate ──────────────────────────────────────────────────────────
    y_pred = model.predict(X_test)
    mae  = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    print(f"\n📊 Evaluation Metrics:")
    print(f"   MAE  = {mae:.2f}")
    print(f"   RMSE = {rmse:.2f}")

    return model, feature_cols


def save_model(model, feature_cols):
    """Save the trained model and feature column names."""
    joblib.dump(model, MODEL_PATH)
    print(f"\n💾 Model saved  →  {MODEL_PATH}")

    with open(FEATURES_PATH, 'w') as f:
        json.dump(feature_cols, f, indent=2)
    print(f"💾 Features saved →  {FEATURES_PATH}")


# ─── Main ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    df_ml = load_and_prepare_data()
    model, feature_cols = train_model(df_ml)
    save_model(model, feature_cols)
    print("\n✅ Model training complete!")
