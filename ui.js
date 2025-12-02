console.log("UI Loaded + Chart Stable");

let currentTab = "Overview";
window.lifetimeQuestions = window.lifetimeQuestions || [];
window.solvedQuestions = window.solvedQuestions || [];

let scoreChart = null;

/* Extract numeric score */
function extractScore(game) {
  if (game == null) return 0;

  // if called as extractScore(gameObj)
  // or extractScore("Score: 7") or extractScore(7)
  const raw = typeof game === "object" ? game.score : game;

  const text = String(raw ?? "");        // <-- always a string now
  const match = text.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}


/* Filter history range */
function getFilteredHistory(history) {
  const range = parseInt(document.getElementById("zm-range")?.value || "999999");
  return history.slice(-range);
}

/* UI Panel */
function createUI() {
  chrome.storage.local.get("gameHistory", data => {
  const cleaned = (data.gameHistory || []).filter(g => extractScore(g) > 0);
  chrome.storage.local.set({ gameHistory: cleaned }, () => {
    console.log("🧹 Removed zero-score games:", data.gameHistory.length - cleaned.length);
  });
});

  const ui = document.createElement("div");
  ui.id = "zetamac-ui";
  ui.innerHTML = `
    <h3>Zetamac Stats Tracker</h3>
    <select id="zm-range" style="margin-top:6px;width:100%;font-size:11px;">
      <option value="1">Past game</option>
      <option value="10">Past 10 games</option>
      <option value="25">Past 25 games</option>
      <option value="50">Past 50 games</option>
      <option value="999999" selected>Lifetime</option>
    </select>

    <div id="zetamac-tabs">
      <div class="zm-tab active" data-tab="Overview">Overview</div>
      <div class="zm-tab" data-tab="Addition">+</div>
      <div class="zm-tab" data-tab="Subtraction">−</div>
      <div class="zm-tab" data-tab="Multiplication">×</div>
      <div class="zm-tab" data-tab="Division">÷</div>
    </div>

    <div id="zetamac-content">Loading stats...</div>

    <canvas id="scoreChart" height="150" style="margin-top:10px;"></canvas>
  `;
  document.body.appendChild(ui);

  chrome.storage.local.get("gameHistory", data => {
    window.lifetimeQuestions.push(...(data.gameHistory || []).flatMap(g => g.solved || []));
    updateStatsPanel();
  });

  document.querySelectorAll(".zm-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".zm-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      currentTab = tab.dataset.tab;
      updateStatsPanel();
    });
  });

  document.getElementById("zm-range").addEventListener("change", updateStatsPanel);
}

/* Chart Rendering */
function drawScoreChart(history) {
  const canvas = document.getElementById("scoreChart");
  if (!canvas) return;
  if (typeof Chart === "undefined") return setTimeout(() => drawScoreChart(history), 200);

  if (scoreChart) scoreChart.destroy();

  const scores = history.map(g => extractScore(g));
  const labels = history.map((g, i) => `Game ${history.length - scores.length + i + 1}`);

  // Running average logic (applies correctly to Past N or Lifetime)
  const runningAvg = scores.map((_, i) => {
    const slice = scores.slice(0, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  const ctx = canvas.getContext("2d");
  scoreChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Score",
          data: scores,
          backgroundColor: "rgba(0,180,255,0.6)",
          yAxisID: "y"
        },
        {
          label: "Running Avg",
          data: runningAvg,
          type: "line",
          borderColor: "orange",
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 3,
          fill: false,
          yAxisID: "y"
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      },
      plugins: {
        legend: {
          labels: { color: "white" }
        }
      }
    }
  });
}


/* Compute tab-specific stats */
function computeOverviewStats(history) {
  return new Promise(resolve => {
    if (!history.length)
      return resolve("No completed games yet.");

    const avgScore = Math.round(history.reduce((a, g) => a + extractScore(g), 0) / history.length);

    const topGames = [...history].sort((a, b) => extractScore(b) - extractScore(a)).slice(0, 3);

    let html = `
      <div><strong>Games:</strong> ${history.length}</div>
      <div><strong>Average Score:</strong> ${avgScore}</div>
      <div><strong>High Scores:</strong></div>
      <ul>
    `;

    topGames.forEach((g, i) => {
      html += `<li>#${i + 1}: Score ${extractScore(g)} — Avg ${(g.avg*1000).toFixed(0)}ms</li>`;
    });

    html += "</ul>";
    resolve(html);
  });
}

function avg(arr) {
  if (!arr.length) return "N/A";
  return `${((arr.reduce((a,b)=>a+b.time,0)/arr.length)*1000).toFixed(0)} ms`;
}

function tableStats(data, op, key) {
  return [...Array(11)].map((_, i) => {
    const num = i + 2;
    const arr = data.filter(q => q.operation === op && q[key] === String(num));
    return `${num}: ${avg(arr)}`;
  }).join("<br>");
}

function computeFilteredTabStats(data) {
  if (!data.length)
    return "No data yet";

  const avgMs = arr =>
    arr.length ? (arr.reduce((s, q) => s + q.time, 0) / arr.length) * 1000 : 0;

  switch (currentTab) {

    /* ==========================
       ADDITION CHART
    ========================== */
    case "Addition": {
      const withCarry = data.filter(q => q.operation === "Addition" && q.carry === "True");
      const noCarry = data.filter(q => q.operation === "Addition" && q.carry === "False");

      const withCarryAvg = avgMs(withCarry);
      const noCarryAvg = avgMs(noCarry);

      const canvasId = "addChartCanvas";

      setTimeout(() => {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === "undefined") return;

        if (window.addChart) window.addChart.destroy();

        window.addChart = new Chart(canvas.getContext("2d"), {
          type: "bar",
          data: {
            labels: [
              `With Carry — ${withCarryAvg.toFixed(0)}ms`,
              `No Carry — ${noCarryAvg.toFixed(0)}ms`
            ],
            datasets: [{
              data: [withCarryAvg, noCarryAvg],
              borderWidth: 1
            }]
          },
          options: {
            plugins: { legend: { display: false }},
            scales: { y: { beginAtZero: true }}
          }
        });
      }, 75);

      return `
        <div><strong>Addition Performance</strong></div>
        <div style="margin-top:10px;">
          <canvas id="${canvasId}" height="140"></canvas>
        </div>
      `;
    }


    /* ==========================
       SUBTRACTION CHART
    ========================== */
    case "Subtraction": {
      const withBorrow = data.filter(q => q.operation === "Subtraction" && q.borrow === "True");
      const noBorrow = data.filter(q => q.operation === "Subtraction" && q.borrow === "False");

      const withBorrowAvg = avgMs(withBorrow);
      const noBorrowAvg = avgMs(noBorrow);

      const canvasId = "subChartCanvas";

      setTimeout(() => {
        const canvas = document.getElementById(canvasId);
        if (!canvas || typeof Chart === "undefined") return;

        if (window.subChart) window.subChart.destroy();

        window.subChart = new Chart(canvas.getContext("2d"), {
          type: "bar",
          data: {
            labels: [
              `With Borrow — ${withBorrowAvg.toFixed(0)}ms`,
              `No Borrow — ${noBorrowAvg.toFixed(0)}ms`
            ],
            datasets: [{
              data: [withBorrowAvg, noBorrowAvg],
              borderWidth: 1
            }]
          },
          options: {
            plugins: { legend: { display: false }},
            scales: { y: { beginAtZero: true }}
          }
        });
      }, 75);

      return `
        <div><strong>Subtraction Performance</strong></div>
        <div style="margin-top:10px;">
          <canvas id="${canvasId}" height="140"></canvas>
        </div>
      `;
    }


case "Multiplication": {
  const segments = [];
  for (let i = 2; i <= 12; i++) {
    const arr = data.filter(q => q.operation === "Multiplication" && q.table1 === String(i));
    if (!arr.length) continue;
    const avgMs = (arr.reduce((s, q) => s + q.time, 0) / arr.length) * 1000;
    segments.push({ label: `x${i}`, avg: avgMs });
  }

  segments.sort((a, b) => b.avg - a.avg);
  const maxAvg = Math.max(...segments.map(s => s.avg));

  const html = `
    <div><strong>Multiplication Analysis</strong></div>
    <div>Difficulty by Table (2–12)</div>
    <div style="margin-top:10px;">
      ${segments.map(s => {
        const percent = (s.avg / maxAvg) * 100;
        const cls = s.avg > 3500 ? "bar-bad"
                : s.avg > 2500 ? "bar-medium"
                : "bar-good";
        return `
          <div class="zm-bar-row">
            <div class="zm-bar-label">${s.label}</div>
            <div class="zm-bar ${cls}" style="width:${percent}%"></div>
            <div class="zm-bar-value">${Math.round(s.avg)}ms</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
  return html;
}



case "Division": {
  const segments = [];

  for (let i = 2; i <= 12; i++) {
    const arr = data.filter(q => q.operation === "Division" && q.table2 === String(i));
    if (!arr.length) continue;

    const avgMs = (arr.reduce((s, q) => s + q.time, 0) / arr.length) * 1000;
    segments.push({ label: `÷${i}`, avg: avgMs });
  }

  if (!segments.length) return "No data yet.";

  segments.sort((a, b) => b.avg - a.avg);
  const maxAvg = Math.max(...segments.map(s => s.avg));

  const html = `
    <div><strong>Division Analysis</strong></div>
    <div>Difficulty by Table (2–12)</div>
    <div style="margin-top:10px;">
      ${segments.map(s => {
        const percent = (s.avg / maxAvg) * 100;
        const cls = s.avg > 3500 ? "bar-bad"
                : s.avg > 2500 ? "bar-medium"
                : "bar-good";
        return `
          <div class="zm-bar-row">
            <div class="zm-bar-label">${s.label}</div>
            <div class="zm-bar-bg">
              <div class="zm-bar ${cls}" style="width:${percent}%"></div>
            </div>
            <div class="zm-bar-value">${Math.round(s.avg)}ms</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
  return html;
}



    default:
      return "No data";
  }
}



/* Main UI Update */
function updateStatsPanel() {
  const contentDisplay = document.getElementById("zetamac-content");


  chrome.storage.local.get("gameHistory", data => {
    const history = getFilteredHistory(data.gameHistory || []);
    const dataPoints = history.flatMap(g => g.solved || []);

if (currentTab === "Overview") {
  document.getElementById("scoreChart").style.display = "block";
  computeOverviewStats(history).then(html => contentDisplay.innerHTML = html);
  drawScoreChart(history);
} else {
  if (scoreChart) {
    scoreChart.destroy();
    scoreChart = null;
  }

  document.getElementById("scoreChart").style.display = "none"; // 🔥 Hide gap

  contentDisplay.innerHTML = computeFilteredTabStats(dataPoints);

  if (currentTab === "Addition") drawAdditionChart(dataPoints);
  if (currentTab === "Subtraction") drawSubtractionChart(dataPoints);
  if (currentTab === "Multiplication") drawMultiplicationChart(buildTableRows(dataPoints, "Multiplication", "table1"));
  if (currentTab === "Division") drawDivisionChart(buildTableRows(dataPoints, "Division", "table2"));
}
  });
}
function drawAdditionChart(data) {
  const canvas = document.getElementById("addChart");
  if (!canvas || typeof Chart === "undefined") return;

  const withCarry = data.filter(q => q.operation === "Addition" && q.carry === "True");
  const noCarry = data.filter(q => q.operation === "Addition" && q.carry === "False");

  const avg = arr =>
    arr.length ? (arr.reduce((s,q)=>s+q.time,0) / arr.length) * 1000 : 0;

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["With Carry", "No Carry"],
      datasets: [{
        data: [avg(withCarry), avg(noCarry)]
      }]
    },
    options: {
      plugins: { legend: { display: false }},
      scales: { y: { beginAtZero: true }}
    }
  });
}

function drawSubtractionChart(data) {
  const canvas = document.getElementById("subChart");
  if (!canvas || typeof Chart === "undefined") return;

  const withBorrow = data.filter(q => q.operation === "Subtraction" && q.borrow === "True");
  const noBorrow = data.filter(q => q.operation === "Subtraction" && q.borrow === "False");

  const avg = arr =>
    arr.length ? (arr.reduce((s,q)=>s+q.time,0) / arr.length) * 1000 : 0;

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["With Borrow", "No Borrow"],
      datasets: [{
        data: [avg(withBorrow), avg(noBorrow)]
      }]
    },
    options: {
      plugins: { legend: { display: false }},
      scales: { y: { beginAtZero: true }}
    }
  });
}

window.updateZetamacUI = updateStatsPanel;

/* Init */
createUI();
updateStatsPanel();
/* -----------------------------------------
   Draggable UI Panel
------------------------------------------ */
(function enableDrag() {
  const panel = document.getElementById("zetamac-ui");
  let offsetX = 0, offsetY = 0;
  let isDragging = false;

  panel.style.position = "fixed"; // ensure fixed position

  panel.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - panel.getBoundingClientRect().left;
    offsetY = e.clientY - panel.getBoundingClientRect().top;
    panel.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    panel.style.left = `${e.clientX - offsetX}px`;
    panel.style.top  = `${e.clientY - offsetY}px`;
    panel.style.transform = "none"; // disable center snap
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    panel.style.cursor = "grab";
  });
})();
