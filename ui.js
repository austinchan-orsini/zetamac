// ------------------------------------------------------------
// UI State
// ------------------------------------------------------------
let currentTab = "Overview";
window.lifetimeQuestions = window.lifetimeQuestions || [];

/* Extract numeric score from "Score: X" display */
function extractScore(game) {
  if (!game.score) return 0;
  const match = game.score.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/* Return only the most recent N games as selected by user */
function getFilteredHistory(history) {
  const selector = document.getElementById("zm-range");
  const range = selector ? parseInt(selector.value, 10) : 999999;
  return history.slice(-range);
}

/* ------------------------------------------------------------
   Create and insert UI panel into the page
------------------------------------------------------------ */
function createUI() {
  const ui = document.createElement("div");
  ui.id = "zetamac-ui";
  ui.innerHTML = `
    <div id="avgTime">Avg: N/A</div>

    <select id="zm-range" style="margin-top:6px; font-size:11px; width:100%;">
      <option value="1">Past 1 game</option>
      <option value="10">Past 10 games</option>
      <option value="100">Past 100 games</option>
      <option value="999999">Lifetime</option>
    </select>

    <div id="zetamac-tabs">
      <div class="zm-tab active" data-tab="Overview">Overview</div>
      <div class="zm-tab" data-tab="Addition">+</div>
      <div class="zm-tab" data-tab="Subtraction">−</div>
      <div class="zm-tab" data-tab="Multiplication">×</div>
      <div class="zm-tab" data-tab="Division">÷</div>
    </div>

    <div id="zetamac-content">Waiting for stats...</div>
  `;

  document.body.appendChild(ui);

  // Load historical stored data on startup
  chrome.storage.local.get("gameHistory", data => {
    const history = data.gameHistory || [];
    const past = history.flatMap(g => g.solved || []);
    window.lifetimeQuestions = (window.lifetimeQuestions || []).concat(past);
    updateStatsPanel();
  });

  /* Tab switching behavior */
  document.querySelectorAll(".zm-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".zm-tab")
        .forEach(t => t.classList.remove("active"));

      tab.classList.add("active");
      currentTab = tab.dataset.tab;
      updateStatsPanel();
    });
  });

  /* Time window drop-down behavior */
  document.getElementById("zm-range")
    .addEventListener("change", updateStatsPanel);
}

/* ------------------------------------------------------------
   Refresh UI content panel with updated game history information
------------------------------------------------------------ */
function updateStatsPanel() {
  const avgDisplay = document.getElementById("avgTime");
  const contentDisplay = document.getElementById("zetamac-content");

  // Update live average time during game
  if (!solvedQuestions.length) {
    avgDisplay.innerText = "Avg Per Question: N/A";
  } else {
    const avgTotal =
      solvedQuestions.reduce((sum, q) => sum + q.time, 0) /
      solvedQuestions.length;

    avgDisplay.innerText = `Avg Per Question: ${avgTotal.toFixed(2)}s`;
  }

  // Fetch stored history and update results view
  chrome.storage.local.get("gameHistory", data => {
    const history = getFilteredHistory(data.gameHistory || []);
    const dataPoints = history.flatMap(g => g.solved || []);

    if (currentTab === "Overview") {
      computeOverviewStats(history).then(html => {
        contentDisplay.innerHTML = html;
      });
    } else {
      contentDisplay.innerHTML = computeFilteredTabStats(dataPoints);
    }
  });
}

/* ------------------------------------------------------------
   Create HTML summary for Overview tab (top scores, averages)
------------------------------------------------------------ */
function computeOverviewStats(history) {
  return new Promise(resolve => {
    const totalGames = history.length;
    if (totalGames === 0) {
      resolve("No completed games yet.");
      return;
    }

    const avgScore = Math.round(
      history.reduce((sum, g) => sum + extractScore(g), 0) / totalGames
    );

    const topGames = [...history]
      .sort((a, b) => extractScore(b) - extractScore(a))
      .slice(0, 3);

    let html = `
      <div><strong>Total Games:</strong> ${totalGames}</div>
      <div><strong>Average Score:</strong> ${avgScore}</div>
      <div><strong>Best Games:</strong></div>
      <ul>
    `;

    topGames.forEach((g, i) => {
      html += `
        <li>#${i + 1}: Score ${extractScore(g)} — Avg ${g.avg?.toFixed(2) ?? "N/A"}s</li>
      `;
    });

    html += "</ul>";
    resolve(html);
  });
}

/* ------------------------------------------------------------
   Compute tab-specific filtered statistics
------------------------------------------------------------ */
function computeFilteredTabStats(data) {
  if (!data.length) return "No data yet";

  switch (currentTab) {
    case "Addition":
      return `
        Avg w/ Carry: ${avg(data.filter(q => q.operation === "Addition" && q.carry === "True"))}<br>
        Avg w/ no Carry: ${avg(data.filter(q => q.operation === "Addition" && q.carry === "False"))}
      `;

    case "Subtraction":
      return `
        Avg w/ Borrow: ${avg(data.filter(q => q.operation === "Subtraction" && q.borrow === "True"))}<br>
        Avg w/ no Borrow: ${avg(data.filter(q => q.operation === "Subtraction" && q.borrow === "False"))}
      `;

    case "Multiplication":
      return tableStats(data, "Multiplication", "table1");

    case "Division":
      return tableStats(data, "Division", "table2");

    default:
      return "No data";
  }
}

/* Average formatting helper */
function avg(arr) {
  if (!arr.length) return "N/A";
  const total = arr.reduce((s, q) => s + q.time, 0);
  return `${(total / arr.length).toFixed(2)}s`;
}

/* Generate multiplication or division table performance view */
function tableStats(data, op, key) {
  const rows = [];

  for (let i = 2; i <= 12; i++) {
    const row = data.filter(q => q.operation === op && q[key] === String(i));
    const avgTime = row.length
      ? row.reduce((s, q) => s + q.time, 0) / row.length
      : null;

    rows.push({ i, avgTime, text: `${i}: ${avg(row)}` });
  }

  rows.sort((a, b) => {
    if (a.avgTime === null) return 1;
    if (b.avgTime === null) return -1;
    return b.avgTime - a.avgTime;
  });

  return rows.map(r => r.text).join("<br>");
}

/* ------------------------------------------------------------
   Allow content.js to force UI refresh
------------------------------------------------------------ */
window.updateZetamacUI = updateStatsPanel;

/* Initialize UI */
createUI();
updateStatsPanel();
