console.log("Zetamac UI Loaded");

let currentTab = "Overview";
let scoreChart = null;

// Initialize data stores
window.lifetimeQuestions = window.lifetimeQuestions || [];
window.solvedQuestions = window.solvedQuestions || [];

/* ============================================
   UTILITY FUNCTIONS
============================================ */

function extractScore(game) {
  if (game == null) return 0;
  const raw = typeof game === "object" ? game.score : game;
  const text = String(raw ?? "");
  const match = text.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function getFilteredHistory(history) {
  const range = parseInt(document.getElementById("zm-range")?.value || "999999");
  return history.slice(-range);
}

function avgMs(arr) {
  if (!arr.length) return 0;
  return (arr.reduce((s, q) => s + q.time, 0) / arr.length) * 1000;
}

/* ============================================
   UI CREATION
============================================ */

function createUI() {
  // Clean up any zero-score games
  chrome.storage.local.get("gameHistory", data => {
    const cleaned = (data.gameHistory || []).filter(g => extractScore(g) > 0);
    chrome.storage.local.set({ gameHistory: cleaned });
  });

  const ui = document.createElement("div");
  ui.id = "zetamac-ui";
  ui.innerHTML = `
    <div class="zm-header">
      <h3>Zetamac Stats Tracker</h3>
      <select id="zm-range">
        <option value="1">Past game</option>
        <option value="10">Past 10 games</option>
        <option value="25">Past 25 games</option>
        <option value="50">Past 50 games</option>
        <option value="999999" selected>Lifetime</option>
      </select>
    </div>

    <div id="zetamac-tabs">
      <div class="zm-tab active" data-tab="Overview">Overview</div>
      <div class="zm-tab" data-tab="Addition">+</div>
      <div class="zm-tab" data-tab="Subtraction">−</div>
      <div class="zm-tab" data-tab="Multiplication">×</div>
      <div class="zm-tab" data-tab="Division">÷</div>
    </div>

    <div id="zetamac-content">
      <div class="loading">Loading stats</div>
    </div>

    <canvas id="scoreChart" height="150"></canvas>
  `;
  
  document.body.appendChild(ui);

  // Load initial data
  chrome.storage.local.get("gameHistory", data => {
    window.lifetimeQuestions.push(...(data.gameHistory || []).flatMap(g => g.solved || []));
    updateStatsPanel();
  });

  // Setup event listeners
  setupEventListeners();
  enableDragging();
}

function setupEventListeners() {
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

/* ============================================
   CHART RENDERING
============================================ */

function drawScoreChart(history) {
  const canvas = document.getElementById("scoreChart");
  if (!canvas || typeof Chart === "undefined") {
    return setTimeout(() => drawScoreChart(history), 200);
  }

  if (scoreChart) scoreChart.destroy();

  const scores = history.map(g => extractScore(g));
  const labels = history.map((g, i) => `#${i + 1}`);

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
          backgroundColor: "rgba(74, 144, 226, 0.6)",
          borderColor: "rgba(74, 144, 226, 1)",
          borderWidth: 1,
          yAxisID: "y"
        },
        {
          label: "Running Average",
          data: runningAvg,
          type: "line",
          borderColor: "rgba(240, 173, 78, 1)",
          backgroundColor: "rgba(240, 173, 78, 0.1)",
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 4,
          fill: true,
          yAxisID: "y"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: '#666666'
          },
          grid: {
            color: '#e0e0e0'
          }
        },
        x: {
          ticks: {
            color: '#666666'
          },
          grid: {
            color: '#e0e0e0'
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#333333',
            font: {
              size: 11
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#4a90e2',
          borderWidth: 1
        }
      }
    }
  });
}

/* ============================================
   STATS COMPUTATION
============================================ */

async function computeOverviewStats(history) {
  if (!history.length) {
    return `
      <div class="empty-state">
        <div class="empty-state-text">
          No games played yet.<br>
          Start playing to see your stats!
        </div>
      </div>
    `;
  }

  const scores = history.map(g => extractScore(g));
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const totalGames = history.length;
  const lastScore = extractScore(history[history.length - 1]);

  const topGames = [...history]
    .sort((a, b) => extractScore(b) - extractScore(a))
    .slice(0, 3);

  return `
    <div class="stats-summary">
      <div class="stat-item">
        <span class="stat-value">${totalGames}</span>
        <span class="stat-label">Games</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${avgScore}</span>
        <span class="stat-label">Avg Score</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${lastScore}</span>
        <span class="stat-label">Last Game</span>
      </div>
    </div>

    <div class="section-title">Top Scores</div>
    <div class="top-cards">
      ${topGames.map((g, i) => `
        <div class="top-card rank-${i + 1}">
          <div class="rank-medal">#${i + 1}</div>
          <div class="rank-details">
            <div class="rank-score">${extractScore(g)}</div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function computeOperationStats(data, operation, metadata) {
  const filtered = data.filter(q => q.operation === operation);
  
  if (!filtered.length) {
    return `
      <div class="empty-state">
        <div class="empty-state-text">No ${operation.toLowerCase()} problems solved yet.</div>
      </div>
    `;
  }

  if (operation === "Multiplication" || operation === "Division") {
    return computeTableStats(data, operation, metadata);
  }

  return computeCarryBorrowStats(data, operation, metadata);
}

function computeCarryBorrowStats(data, operation, metadata) {
  const allForOperation = data.filter(q => q.operation === operation);
  const with_ = data.filter(q => q.operation === operation && q[metadata] === "True");
  const without = data.filter(q => q.operation === operation && q[metadata] === "False");

  const withAvg = avgMs(with_);
  const withoutAvg = avgMs(without);
  const overallAvg = avgMs(allForOperation);

  const displayName = metadata.charAt(0).toUpperCase() + metadata.slice(1);

  return `
    <div class="stats-summary" style="margin-bottom: 20px;">
      <div class="stat-item">
        <span class="stat-value">${allForOperation.length}</span>
        <span class="stat-label">Problems</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${Math.round(overallAvg)}</span>
        <span class="stat-label">Avg (ms)</span>
      </div>
    </div>
    <div class="section-title">${operation} Performance</div>
    <div style="margin-top: 16px;">
      <div class="zm-bar-row">
        <div class="zm-bar-label">With ${displayName}</div>
        <div class="zm-bar-bg">
          <div class="zm-bar bar-medium" style="width: ${(withAvg / Math.max(withAvg, withoutAvg)) * 100}%"></div>
        </div>
        <div class="zm-bar-value">${Math.round(withAvg)}ms</div>
      </div>
      <div class="zm-bar-row">
        <div class="zm-bar-label">No ${displayName}</div>
        <div class="zm-bar-bg">
          <div class="zm-bar bar-good" style="width: ${(withoutAvg / Math.max(withAvg, withoutAvg)) * 100}%"></div>
        </div>
        <div class="zm-bar-value">${Math.round(withoutAvg)}ms</div>
      </div>
    </div>
  `;
}

function computeTableStats(data, operation, metadata) {
  const allForOperation = data.filter(q => q.operation === operation);
  const overallAvg = avgMs(allForOperation);
  
  const segments = [];
  const symbol = operation === "Multiplication" ? "×" : "÷";

  for (let i = 2; i <= 12; i++) {
    const arr = data.filter(q => q.operation === operation && q[metadata] === String(i));
    if (!arr.length) continue;
    
    const avg = avgMs(arr);
    segments.push({ label: `${symbol}${i}`, avg, count: arr.length });
  }

  if (!segments.length) {
    return `<div class="empty-state-text">No ${operation.toLowerCase()} data yet.</div>`;
  }

  segments.sort((a, b) => b.avg - a.avg);
  const maxAvg = Math.max(...segments.map(s => s.avg));

  return `
    <div class="stats-summary" style="margin-bottom: 20px;">
      <div class="stat-item">
        <span class="stat-value">${allForOperation.length}</span>
        <span class="stat-label">Problems</span>
      </div>
      <div class="stat-item">
        <span class="stat-value">${Math.round(overallAvg)}</span>
        <span class="stat-label">Avg (ms)</span>
      </div>
    </div>
    <div class="section-title">${operation} Performance</div>
    <div style="margin-top: 16px;">
      ${segments.map(s => {
        const percent = (s.avg / maxAvg) * 100;
        const cls = s.avg > 3500 ? "bar-bad" 
                  : s.avg > 2500 ? "bar-medium" 
                  : "bar-good";
        return `
          <div class="zm-bar-row">
            <div class="zm-bar-label">${s.label}</div>
            <div class="zm-bar-bg">
              <div class="zm-bar ${cls}" style="width: ${percent}%"></div>
            </div>
            <div class="zm-bar-value">${Math.round(s.avg)}ms</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/* ============================================
   MAIN UPDATE FUNCTION
============================================ */

function updateStatsPanel() {
  const contentDisplay = document.getElementById("zetamac-content");
  const chartCanvas = document.getElementById("scoreChart");

  chrome.storage.local.get("gameHistory", async data => {
    const history = getFilteredHistory(data.gameHistory || []);
    const dataPoints = history.flatMap(g => g.solved || []);

    if (currentTab === "Overview") {
      chartCanvas.style.display = "block";
      const html = await computeOverviewStats(history);
      contentDisplay.innerHTML = html;
      drawScoreChart(history);
    } else {
      if (scoreChart) {
        scoreChart.destroy();
        scoreChart = null;
      }
      chartCanvas.style.display = "none";

      let html = "";
      switch (currentTab) {
        case "Addition":
          html = computeOperationStats(dataPoints, "Addition", "carry");
          break;
        case "Subtraction":
          html = computeOperationStats(dataPoints, "Subtraction", "borrow");
          break;
        case "Multiplication":
          html = computeOperationStats(dataPoints, "Multiplication", "table1");
          break;
        case "Division":
          html = computeOperationStats(dataPoints, "Division", "table2");
          break;
      }
      contentDisplay.innerHTML = html;
    }
  });
}

/* ============================================
   DRAGGABLE FUNCTIONALITY
============================================ */

function enableDragging() {
  const panel = document.getElementById("zetamac-ui");
  let offsetX = 0, offsetY = 0;
  let isDragging = false;

  panel.addEventListener("mousedown", (e) => {
    // Don't drag if clicking on select or tabs
    if (e.target.closest('#zm-range, .zm-tab')) return;
    
    isDragging = true;
    offsetX = e.clientX - panel.getBoundingClientRect().left;
    offsetY = e.clientY - panel.getBoundingClientRect().top;
    panel.style.cursor = "grabbing";
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    
    let newX = e.clientX - offsetX;
    let newY = e.clientY - offsetY;
    
    // Keep within viewport
    newX = Math.max(0, Math.min(newX, window.innerWidth - panel.offsetWidth));
    newY = Math.max(0, Math.min(newY, window.innerHeight - panel.offsetHeight));
    
    panel.style.left = `${newX}px`;
    panel.style.top = `${newY}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    panel.style.cursor = "grab";
  });
}

/* ============================================
   INITIALIZATION
============================================ */

// Export for content.js to call
window.updateZetamacUI = updateStatsPanel;

// Initialize UI
createUI();
updateStatsPanel();