# 📈 Demand Forecaster: AI-Powered Retail Revenue Prediction Platform

A full-stack machine learning application designed to forecast retail store revenue using predictive analytics. The platform combines an XGBoost forecasting engine with SHAP explainability, interactive scenario analysis, and real-time visualizations to help users understand and optimize future sales performance.

---

## 🚀 Key Features

### 📊 Revenue Forecasting

* Predict future daily revenue for retail stores.
* Generate short-term sales forecasts using historical data.

### 🤖 Machine Learning Engine

* Powered by XGBoost regression models.
* Learns patterns from sales, promotions, holidays, and seasonal trends.

### 🧠 Explainable AI

* SHAP-based feature importance analysis.
* Identifies the key factors influencing each prediction.

### 📈 Interactive Analytics

* Visualize forecast trends through dynamic charts.
* Monitor prediction results in real time.

### ⚖️ What-If Analysis

* Compare revenue outcomes under different business conditions.
* Evaluate the impact of promotions and holidays.

---

## 🛠️ Tech Stack

### Frontend

* React.js
* Tailwind CSS
* Axios
* Recharts
* Lucide React

### Backend

* Python
* FastAPI
* Uvicorn

### Machine Learning

* XGBoost
* SHAP
* Scikit-Learn
* Pandas
* NumPy

---

## 🏗️ System Architecture & Logic

### 1. Data Input

The system accepts store-specific business conditions such as promotions, holidays, and forecast dates.

### 2. Feature Processing

Input data is transformed into machine-learning-ready features through preprocessing and feature engineering.

### 3. Revenue Prediction

The trained XGBoost model analyzes the processed features and generates future revenue forecasts.

### 4. Explainability & Visualization

SHAP values and interactive charts provide insights into the factors driving each prediction and forecast trend.

---

## 🔧 Installation & Setup

### Prerequisites

* Node.js (v16 or higher)
* Python (v3.8 or higher)

### 1. Backend Installation

```bash
cd backend

pip install -r requirements.txt

uvicorn main:app --reload
```

### 2. Frontend Installation

```bash
cd frontend

npm install

npm run dev
```

---

## 📂 Project Structure

```text
RETAIL-DEMAND-PREDICTOR/
│
├── backend/
│   ├── main.py
│   ├── store_lookup.json
│   └── requirements.txt
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   ├── eslint.config.js
│   └── index.html
│
├── model/
│
├── 01_EDA.ipynb
├── 02_model_training.ipynb
├── 02_model_training.py
│
├── train.csv
├── test.csv
├── store.csv
├── sample_submission.csv
│
├── requirements.txt
├── README.md
└── .gitignore
```


