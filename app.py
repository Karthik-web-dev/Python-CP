import pickle

import pandas as pd
from flask import Flask, render_template, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # enables cors for entire flask app

try:
    model = pickle.load(open("fraud_model.pkl", "rb"))
    MODEL_LOADED = True
    print(model.feature_names_in_)

except:
    MODEL_LOADED = False
    print("⚠ Model not found, using rule-based logic")


# HOME


@app.route("/")  # http://127.0.0.1:5000/
def home():
    return render_template("welcome.html")


# FRAUD CHECK API Route

fraud = 0
genuine = 0


@app.route("/checkFraud", methods=["GET", "POST"])
def check_fraud():
    if request.method == "POST":
        data = request.form
        global fraud, genuine
        amount = float(data.get("amount", 0))
        frequency = int(data.get("frequency", 0))
        location = str(data.get("location", "")).lower()

        # Parse time correctly from split inputs
        hours = int(data.get("hours", 12))
        ampm = data.get("ampm", "AM")
        if ampm == "PM" and hours != 12:
            hours += 12
        elif ampm == "AM" and hours == 12:
            hours = 0
        time_encoded = 1 if 1 <= hours <= 4 else 0

        city = location.title()

        if amount >= 10000 and frequency >= 8 and time_encoded == 1:
            fraud += 1
            return render_template(
                "asep.html",
                result="Fraud",
                risk_level="High",
                fraud_probability=0.95,
                city=city,
                fraud_count=fraud,
                genuine_count=genuine,
            )

        prob = 0.0  # default
        if MODEL_LOADED:
            # features = np.array([[amount, time_encoded, frequency]])
            features = pd.DataFrame(
                [[amount, time_encoded, frequency]],
                columns=["amount", "time_encoded", "frequency"],
            )

            print("Features:", features)
            print("Prediction:", model.predict(features)[0])
            print("Probability:", model.predict_proba(features)[0])
            print("Classes:", model.classes_)

            pred = model.predict(features)[0]
            prob = model.predict_proba(features)[0][1]

            print("Raw pred:", pred)
            print("Raw proba:", prob)

            if pred == 1:
                result, risk, fraud = "Fraud", "High", fraud + 1
            elif prob >= 0.4:
                result, risk = "Suspicious", "Medium"
            else:
                result, risk, genuine = "Genuine", "Low", genuine + 1
        else:
            if amount > 5000:
                result, risk, prob = "Suspicious", "Medium", 0.55
            else:
                result, risk, prob = "Genuine", "Low", 0.12

        return render_template(
            "asep.html",
            result=result,
            risk_level=risk,
            fraud_probability=round(float(prob), 2),
            city=city,
            fraud_count=fraud,
            genuine_count=genuine,
        )

    return render_template("asep.html")


@app.route("/tracker")
def tracker():
    return render_template("tracker.html")


@app.route("/checkCreditCard")
def checkCreditCard():
    return render_template("creditcardvalidity.html")


@app.route("/login")
def login():
    return render_template("aseplogin.html")


# RUN SERVER

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
