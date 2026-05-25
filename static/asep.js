/* ============================================================
   asep.js  —  AI Fraud Detection  (fully fixed)
   ============================================================ */

/* ================= GLOBAL STATE ================= */
// Source of truth comes from Python via window globals.
// JS never double-increments — Python already updated the counts.
let fraud = window.fraud_count || 0;
let genuine = window.genuine_count || 0;

/* Chart instances — kept globally so we can destroy before re-init */
let fraudDoughnutChart = null;
let fraudPieChart = null;

/* Map globals — declared here, initialised inside window.onload */
let fraudMap = null;
let genuineHeatLayer = null;
let fraudHeatLayer = null;
let genuinePoints = [];
let fraudPoints = [];

/* ================= CITY COORDS ================= */
const cityCoords = {
  pune: [18.5204, 73.8567],
  mumbai: [19.076, 72.8777],
  delhi: [28.7041, 77.1025],
  bangalore: [12.9716, 77.5946],
  chennai: [13.0827, 80.2707],
  hyderabad: [17.385, 78.4867],
  kolkata: [22.5726, 88.3639],
  ahmedabad: [23.0225, 72.5714],
  jaipur: [26.9124, 75.7873],
  surat: [21.1702, 72.8311],
};

/* ================= THEME ================= */
function toggleTheme() {
  document.body.classList.toggle("light");
  /* Re-draw charts so legend colour matches new theme */
  if (fraudDoughnutChart) {
    initDoughnutChart();
  }
}

/* ================= INIT ================= */
window.onload = function() {
  checkLoginStatus();
  initMap();
  updateStats();

  /* Show result if Python returned one */
  if (window.result) {
    showResult(window.result, window.city, window.fraud_probability);
  }

  if (document.getElementById("fraudChart")) {
    initDoughnutChart();
  }
};

/* ================= RESULT UI HANDLER ================= */
function showResult(result, city, fraudProb) {
  const resultBox = document.getElementById("resultBox");
  const resultText = document.getElementById("result");
  const probText = document.getElementById("fraudProbText");
  const cityText = document.getElementById("cityText");

  if (!resultBox || !resultText) return;

  resultBox.classList.remove("hidden");

  if (result === "Fraud") {
    resultBox.style.background = "rgba(255,0,0,.4)";
    resultText.innerHTML = "⚠ Fraudulent Transaction Detected";
    addFraudPoint(city);
  } else if (result === "Suspicious") {
    resultBox.style.background = "rgba(255,165,0,.4)";
    resultText.innerHTML = "⚠ Suspicious Transaction";
  } else {
    resultBox.style.background = "rgba(0,255,0,.4)";
    resultText.innerHTML = "✔ Genuine Transaction";
  }

  if (probText) {
    probText.textContent =
      "Fraud Probability: " + (fraudProb * 100).toFixed(0) + "%";
  }
  if (cityText && city) {
    cityText.textContent = "City: " + city;
  }

  updateStats();
  animateFraudPieChart(fraudProb);

  /* Pan map to city */
  if (city) scrollToLocation(city);
}

/* ================= STATS ================= */
function updateStats() {
  const total = fraud + genuine;
  const totalEl = document.getElementById("totalCount");
  const fraudEl = document.getElementById("fraudCount");
  const genuineEl = document.getElementById("genuineCount");

  if (totalEl) totalEl.textContent = total;
  if (fraudEl) fraudEl.textContent = fraud;
  if (genuineEl) genuineEl.textContent = genuine;

  /* Update doughnut live */
  if (fraudDoughnutChart) {
    fraudDoughnutChart.data.datasets[0].data = [fraud, genuine];
    fraudDoughnutChart.update();
  }
}

/* ================= DOUGHNUT CHART (dashboard) ================= */
function initDoughnutChart() {
  const canvas = document.getElementById("fraudChart");
  if (!canvas) return;

  /* Destroy previous instance before re-creating */
  if (fraudDoughnutChart) {
    fraudDoughnutChart.destroy();
    fraudDoughnutChart = null;
  }

  const labelColor = document.body.classList.contains("light")
    ? "#111"
    : "#fff";

  fraudDoughnutChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Fraud", "Genuine"],
      datasets: [
        {
          data: [fraud, genuine],
          backgroundColor: ["#ff2222", "#4dff4d"],
          borderWidth: 2,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          labels: {
            color: labelColor,
            font: { size: 14, weight: "bold" },
          },
        },
      },
    },
  });
}

/* ================= PIE CHART (result box) ================= */
function animateFraudPieChart(prob) {
  const canvas = document.getElementById("fraudReportChart");
  const percentageEl = document.getElementById("fraudPercentage");
  if (!canvas) return;

  /* prob arrives as 0.0–1.0 float → convert to 0–100 */
  const probPercent = Math.round(prob * 100);

  /* Destroy previous instance on same canvas */
  if (fraudPieChart) {
    fraudPieChart.destroy();
    fraudPieChart = null;
  }

  /* Animated counter */
  if (percentageEl) {
    let current = 0;
    const timer = setInterval(() => {
      current++;
      if (current >= probPercent) {
        current = probPercent;
        clearInterval(timer);
      }
      percentageEl.textContent = current + "%";
    }, 20);
  }

  const labelColor = document.body.classList.contains("light")
    ? "#111"
    : "#fff";

  fraudPieChart = new Chart(canvas.getContext("2d"), {
    type: "pie",
    data: {
      labels: ["Fraud Risk", "Safe"],
      datasets: [
        {
          data: [probPercent, 100 - probPercent],
          backgroundColor: ["#ff2222", "#4dff4d"],
          borderWidth: 2,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          labels: {
            color: labelColor,
            font: { size: 13 },
          },
        },
      },
    },
  });
}

/* ================= MAP ================= */
function initMap() {
  const mapEl = document.getElementById("fraudMap");
  if (!mapEl) return;

  fraudMap = L.map("fraudMap").setView([20.5937, 78.9629], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(fraudMap);

  genuineHeatLayer = L.heatLayer([], {
    radius: 40,
    gradient: { 0.1: "green", 0.5: "lime", 1: "lightgreen" },
  }).addTo(fraudMap);

  fraudHeatLayer = L.heatLayer([], {
    radius: 40,
    gradient: { 0.1: "orange", 0.5: "red", 1: "darkred" },
  }).addTo(fraudMap);

  /* Force Leaflet to recalculate size after layout paint */
  setTimeout(() => fraudMap.invalidateSize(), 300);
}

/* ================= FRAUD POINT ================= */
function addFraudPoint(city) {
  const key = city ? city.toLowerCase().trim() : "";
  if (!cityCoords[key] || !fraudHeatLayer) return;

  fraudPoints.push({
    lat: cityCoords[key][0],
    lng: cityCoords[key][1],
    intensity: 1.5,
  });
  updateHeat();
}

function addGenuinePoint(city) {
  const key = city ? city.toLowerCase().trim() : "";
  if (!cityCoords[key] || !genuineHeatLayer) return;

  genuinePoints.push({
    lat: cityCoords[key][0],
    lng: cityCoords[key][1],
    intensity: 1.0,
  });
  updateHeat();
}

/* ================= HEATMAP UPDATE ================= */
function updateHeat() {
  if (genuineHeatLayer) {
    genuineHeatLayer.setLatLngs(
      genuinePoints.map((p) => [p.lat, p.lng, p.intensity]),
    );
  }
  if (fraudHeatLayer) {
    fraudHeatLayer.setLatLngs(
      fraudPoints.map((p) => [p.lat, p.lng, p.intensity]),
    );
  }
}

/* ================= MAP FOCUS ================= */
function scrollToLocation(city) {
  const key = city ? city.toLowerCase().trim() : "";
  if (cityCoords[key] && fraudMap) {
    fraudMap.setView(cityCoords[key], 8);
  }
}

/* ================= LOGIN ================= */
function goToLogin() {
  window.location.href = "aseplogin.html";
}

function checkLoginStatus() {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user"));
  } catch (e) {
    /* ignore */
  }

  const loginBtn = document.getElementById("loginBtn");
  const userInfo = document.getElementById("userInfo");
  const usernameSpan = document.getElementById("username");

  if (user) {
    if (loginBtn) loginBtn.classList.add("hidden");
    if (userInfo) userInfo.classList.remove("hidden");
    if (usernameSpan) usernameSpan.textContent = user.name || "";
  } else {
    if (loginBtn) loginBtn.classList.remove("hidden");
    if (userInfo) userInfo.classList.add("hidden");
  }
}

function logout() {
  localStorage.removeItem("user");
  location.reload();
}
