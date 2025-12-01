// UI state
let currentTab = "Overview";
window.lifetimeQuestions = window.lifetimeQuestions || [];
function extractScore(game) {
  if (!game.score) return 0;
  const match = game.score.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function createUI() {
  const ui = document.createElement("div");
  ui.id = "zetamac-ui";
  ui.innerHTML = `
    <div id="avgTime">Avg: N/A</div>
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
  // Load historical data from storage
chrome.storage.local.get("gameHistory", data => {
  const history = data.gameHistory || [];

  const past = history.flatMap(g => g.solved || []); // <- 'solved', not 'questions'
  window.lifetimeQuestions = (window.lifetimeQuestions || []).concat(past);

  updateStatsPanel();
});
  document.querySelectorAll(".zm-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".zm-tab")
        .forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      currentTab = tab.dataset.tab;
      updateStatsPanel(); // refresh UI instantly
    });
  });
}

function updateStatsPanel() {
  const avgDisplay = document.getElementById("avgTime");
  const contentDisplay = document.getElementById("zetamac-content");

  // Live avg update (even if game hasn't finished)
  if (!solvedQuestions.length) {
    avgDisplay.innerText = "Avg Per Question: N/A";
  } else {
    const avgTotal = solvedQuestions.reduce((sum, q) => sum + q.time, 0) / solvedQuestions.length;
    avgDisplay.innerText = `Avg Per Question: ${avgTotal.toFixed(2)}s`;
  }

  // Always show stats for active tab
  if (currentTab === "Overview") {
    computeOverviewStats().then(html => {
      contentDisplay.innerHTML = html;
    });
  } else {
    contentDisplay.innerHTML = computeTabStats();
  }
}


function computeOverviewStats() {
  if (!chrome || !chrome.storage) return "Storage not available.";

  return new Promise(resolve => {
    chrome.storage.local.get("gameHistory", data => {
      const history = data.gameHistory || [];

      const totalGames = history.length;
      const avgScore = Math.round(
  history.reduce((sum, g) => sum + extractScore(g), 0) / totalGames
);
      if (totalGames === 0) {
        resolve("No completed games yet.");
        return;
      }

      // Sort best → worst by score number
      const topGames = [...history]
  .sort((a, b) => extractScore(b) - extractScore(a))
  .slice(0, 3);

      let summaryHTML = `
        <div><strong>Total Games:</strong> ${totalGames}</div>
        <div><strong>Average Score:</strong> ${avgScore}</div>

        <div><strong>Best Games:</strong></div>
        <ul>
      `;

      topGames.forEach((g, i) => {
        summaryHTML += `
  <li>#${i + 1}: Score ${extractScore(g)} — Avg ${g.avg?.toFixed(2) ?? "N/A"}s</li>
`;
      });

      summaryHTML += "</ul>";

      resolve(summaryHTML);
    });
  });
}

function computeTabStats() {
  const data = window.lifetimeQuestions || [];
  if (!data.length) return "No data yet";

  switch (currentTab) {
    case "Addition":
      const addCarry = data.filter(q => q.operation === "Addition" && q.carry === "True");
      const addNoCarry = data.filter(q => q.operation === "Addition" && q.carry === "False");
      return `
        Avg w/ Carry: ${avg(addCarry)}<br>
        Avg w/ no Carry: ${avg(addNoCarry)}
      `;

    case "Subtraction":
      const subBorrow = data.filter(q => q.operation === "Subtraction" && q.borrow === "True");
      const subNoBorrow = data.filter(q => q.operation === "Subtraction" && q.borrow === "False");
      return `
        Avg w/ Borrow: ${avg(subBorrow)}<br>
        Avg w/ no Borrow: ${avg(subNoBorrow)}
      `;

    case "Multiplication":
      return tableStats(data, "Multiplication", "table1");

    case "Division":
      return tableStats(data, "Division", "table2");
  }

  return "No data";
}



// helper avg formatting
function avg(arr) {
  if (!arr.length) return "N/A";
  const total = arr.reduce((s, q) => s + q.time, 0);
  return `${(total / arr.length).toFixed(2)}s`;
}

// helper table stats (2-12 only)
function tableStats(data, op, key) {
  const rows = [];

  for (let i = 2; i <= 12; i++) {
    const row = data.filter(q => q.operation === op && q[key] === String(i));
    const avgTime = row.length
      ? row.reduce((s, q) => s + q.time, 0) / row.length
      : null;

    rows.push({ i, avgTime, text: `${i}: ${avg(row)}` });
  }

  // Sort: slowest (worst) first, fastest last
  rows.sort((a, b) => {
    if (a.avgTime === null) return 1;
    if (b.avgTime === null) return -1;
    return b.avgTime - a.avgTime;
  });

  return rows.map(r => r.text).join("<br>");
}



// Expose function to content.js
window.updateZetamacUI = updateStatsPanel;

// Create UI immediately
createUI();
updateStatsPanel();
