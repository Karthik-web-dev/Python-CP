"""
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import pickle

print("🔹 Generating dataset...")

# CONFIG

ROWS = 25000
RANDOM_STATE = 42

np.random.seed(RANDOM_STATE)

# SYNTHETIC DATA GENERATION

amount = np.random.randint(10, 50000, ROWS)
time = np.random.randint(0, 24, ROWS)
frequency = np.random.randint(1, 15, ROWS)

# Encode suspicious time (1 = night hours)
time_encoded = np.where((time >= 1) & (time <= 4), 1, 0)


# FRAUD LABEL LOGIC (GROUND TRUTH)

isFraud = np.where(
    (amount >= 10000) &
    (frequency >= 8) &
    (time_encoded == 1),
    1, 0
)

# DATAFRAME

df = pd.DataFrame({
    "amount": amount,
    "time_encoded": time_encoded,
    "frequency": frequency,
    "isFraud": isFraud
})

print("🔹 Dataset shape:", df.shape)
print("🔹 Fraud cases:", df["isFraud"].sum())


# TRAIN / TEST SPLIT

X = df[["amount", "time_encoded", "frequency"]]
y = df["isFraud"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=RANDOM_STATE,
    stratify=y                  #ensures the fraud-to-genuine ratio remains the same in both sets.
)

# RANDOM FOREST MODEL (FAST)

print("🔹 Training model...")

model = RandomForestClassifier(
    n_estimators=80,
    max_depth=10,              # prevents overfitting
    min_samples_split=10,      # hyperparameter
    n_jobs=-1,                 # -1 for all available CPU cores
    random_state=RANDOM_STATE
)

model.fit(X_train, y_train)

print("✅ Training completed.")

# SAVE MODEL

pickle.dump(model, open("fraud_model.pkl", "wb"))

print("💾 Model saved as fraud_model.pkl")
print("🎯 Ready for Flask backend")
"""

import pickle

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.utils import resample

print("🔹 Generating dataset...")

ROWS = 25000
RANDOM_STATE = 42
np.random.seed(RANDOM_STATE)

amount = np.random.randint(10, 50000, ROWS)
time = np.random.randint(0, 24, ROWS)
frequency = np.random.randint(1, 15, ROWS)
time_encoded = np.where((time >= 1) & (time <= 4), 1, 0)

# BROADER FRAUD LABELS — covers more real patterns
isFraud = np.where(
    # High amount + night + high frequency (original rule)
    ((amount >= 10000) & (frequency >= 8) & (time_encoded == 1))
    |
    # Medium-high amount + night + medium frequency (catches Mumbai case)
    ((amount >= 7000) & (frequency >= 7) & (time_encoded == 1))
    |
    # Very high amount alone is suspicious
    ((amount >= 40000) & (frequency >= 5))
    |
    # Night transaction with any high frequency
    ((time_encoded == 1) & (frequency >= 10)),
    1,
    0,
)

df = pd.DataFrame(
    {
        "amount": amount,
        "time_encoded": time_encoded,
        "frequency": frequency,
        "isFraud": isFraud,
    }
)

print("🔹 Dataset shape:", df.shape)
print("🔹 Fraud cases:", df["isFraud"].sum())
print("🔹 Fraud %:", round(df["isFraud"].mean() * 100, 2), "%")

# BALANCE THE DATASET — this is what was missing before
fraud_df = df[df["isFraud"] == 1]
genuine_df = df[df["isFraud"] == 0]

fraud_upsampled = resample(
    fraud_df, replace=True, n_samples=len(genuine_df), random_state=RANDOM_STATE
)

balanced_df = pd.concat([genuine_df, fraud_upsampled])
print("🔹 Balanced dataset shape:", balanced_df.shape)

X = balanced_df[["amount", "time_encoded", "frequency"]]
y = balanced_df["isFraud"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
)

print("🔹 Training model...")
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    min_samples_split=10,
    n_jobs=-1,
    random_state=RANDOM_STATE,
)
model.fit(X_train, y_train)

# VERIFY before saving
test_cases = pd.DataFrame(
    [
        {"amount": 15000, "time_encoded": 1, "frequency": 10},  # should be fraud
        {"amount": 8000, "time_encoded": 1, "frequency": 9},  # should be fraud
        {"amount": 500, "time_encoded": 0, "frequency": 1},  # should be genuine
        {"amount": 6000, "time_encoded": 0, "frequency": 5},  # should be suspicious
    ]
)

print("\n🧪 Quick sanity check:")
for _, row in test_cases.iterrows():
    pred = model.predict([row])[0]
    prob = model.predict_proba([row])[0][1]
    label = "FRAUD" if pred == 1 else "GENUINE"
    print(
        f"  amount={row.amount:>6}, time={row.time_encoded}, freq={row.frequency} "
        f"→ {label} ({prob * 100:.1f}% fraud prob)"
    )

pickle.dump(model, open("fraud_model.pkl", "wb"))
print("\n💾 Model saved as fraud_model.pkl")
