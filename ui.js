console.log("UI Loaded + Chart Stable");

let currentTab = "Overview";
window.lifetimeQuestions = window.lifetimeQuestions || [];
window.solvedQuestions = window.solvedQuestions || [];

let scoreChart = null;

/* Extract numeric score */
function extractScore(game) {
  const match = game.score?.match(/\d+/);
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
      <option value="999999">Lifetime</option>
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
  if (!data.length) return "No data yet";
  switch (currentTab) {
    case "Addition": return `
      Avg w/ Carry: ${avg(data.filter(q => q.operation === "Addition" && q.carry === "True"))}<br>
      Avg w/ no Carry: ${avg(data.filter(q => q.operation === "Addition" && q.carry === "False"))}
    `;
    case "Subtraction": return `
      Avg w/ Borrow: ${avg(data.filter(q => q.operation === "Subtraction" && q.borrow === "True"))}<br>
      Avg w/ no Borrow: ${avg(data.filter(q => q.operation === "Subtraction" && q.borrow === "False"))}
    `;
    case "Multiplication": return tableStats(data, "Multiplication", "table1");
    case "Division": return tableStats(data, "Division", "table2");
  }
}

/* Main UI Update */
function updateStatsPanel() {
  const contentDisplay = document.getElementById("zetamac-content");

  chrome.storage.local.get("gameHistory", data => {
    const history = getFilteredHistory(data.gameHistory || []);
    const dataPoints = history.flatMap(g => g.solved || []);

    if (currentTab === "Overview") {
      computeOverviewStats(history).then(html => contentDisplay.innerHTML = html);
      drawScoreChart(history);
    } else {
      contentDisplay.innerHTML = computeFilteredTabStats(dataPoints);
    }
  });
}

window.updateZetamacUI = updateStatsPanel;

/* Init */
createUI();
updateStatsPanel();
