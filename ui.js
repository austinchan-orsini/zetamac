// UI state
let currentTab = "Addition";

function createUI() {
  const ui = document.createElement("div");
  ui.id = "zetamac-ui";
  ui.innerHTML = `
    <div id="avgTime">Avg: N/A</div>
    <div id="zetamac-tabs">
      <div class="zm-tab active" data-tab="Addition">+</div>
      <div class="zm-tab" data-tab="Subtraction">−</div>
      <div class="zm-tab" data-tab="Multiplication">×</div>
      <div class="zm-tab" data-tab="Division">÷</div>
    </div>
    <div id="zetamac-content">Waiting for stats...</div>
  `;
  document.body.appendChild(ui);

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

  // If no questions solved yet:
  if (!window.solvedQuestions || solvedQuestions.length === 0) {
    avgDisplay.innerText = "Avg Per Question: N/A"; // Keep this
    contentDisplay.innerText = ""; // ← Don't show "Waiting for stats"
    return;
  }

  // Update overall average live
  const avgTotal = solvedQuestions.reduce((sum, q) => sum + q.time, 0) / solvedQuestions.length;
  avgDisplay.innerText = `Avg Per Question: ${avgTotal.toFixed(2)}s`;

  // Do NOT show stats until game ends — so leave tab content minimal
  if (window.gameEnded) {
  contentDisplay.innerHTML = computeTabStats();
} else {
  contentDisplay.innerHTML = `${currentTab} stats coming after game ends 🔍`;
}
}
function computeTabStats() {
  if (!window.solvedQuestions || solvedQuestions.length === 0)
    return "No data yet";

  const data = solvedQuestions;
  let filtered;

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
  let html = "";
  for (let i = 2; i <= 12; i++) {
    const row = data.filter(q => q.operation === op && q[key] === String(i));
    html += `${i}: ${avg(row)}<br>`;
  }
  return html;
}


// Expose function to content.js
window.updateZetamacUI = updateStatsPanel;

// Create UI immediately
createUI();
updateStatsPanel();
