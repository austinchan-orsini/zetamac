console.log("Zetamac Tracker Loaded");

let lastQuestion = null;
let lastTimestamp = null;
window.lifetimeQuestions = window.lifetimeQuestions || [];
window.solvedQuestions = window.solvedQuestions || [];
window.gameEnded = false;

/* -----------------------------------------------------------
   Save the finished game into chrome storage
----------------------------------------------------------- */
function saveGameHistory() {
  const scoreText = findScoreElement()?.textContent?.trim() || "";
  const match = scoreText.match(/\d+/);
  const score = match ? parseInt(match[0], 10) : 0;

  if (score === 0) return;  // ignore empty games

  const gameData = {
    timestamp: Date.now(),
    score,  // numeric
    solved: window.solvedQuestions.map(q => ({
      a: q.a,
      b: q.b,
      operation: q.operation,
      time: q.time,
      carry: q.carry,
      borrow: q.borrow,
      table1: q.table1,
      table2: q.table2
    })),
    duration: window.solvedQuestions.reduce((sum, q) => sum + q.time, 0),
    avg: window.solvedQuestions.length
      ? window.solvedQuestions.reduce((sum, q) => sum + q.time, 0) /
        window.solvedQuestions.length
      : null
  };

  chrome.storage.local.get(["gameHistory"], result => {
    const history = result.gameHistory || [];
    history.push(gameData);

    chrome.storage.local.set({ gameHistory: history }, () => {
      console.log("Game saved", gameData);
      if (window.updateZetamacUI) window.updateZetamacUI();
    });
  });
}



/* -----------------------------------------------------------
   Handle question text parsing and metadata extraction
----------------------------------------------------------- */
function parseQuestion(q) {
  const ops = ["+", "−", "–", "-", "×", "÷", "*", "/"];
  const rawOp = ops.find(op => q.includes(op));
  if (!rawOp) return null;

  const parts = q.split(rawOp);
  if (parts.length < 2) return null;

  const a = parseInt(parts[0].trim(), 10);
  const b = parseInt(parts[1].replace("=", "").trim(), 10);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;

  let op = rawOp;
  if (rawOp === "*") op = "×";
  if (rawOp === "/") op = "÷";
  if (rawOp === "−" || rawOp === "–" || rawOp === "-") op = "-";

  return { a, b, op };
}

/* -----------------------------------------------------------
   Determine carry or borrow for + or -
----------------------------------------------------------- */
function needsCarryBorrow(op, a, b) {
  if (op !== "+" && op !== "-") return false;

  const A = String(a).split("").reverse();
  const B = String(b).split("").reverse();
  const len = Math.max(A.length, B.length);

  if (op === "+") {
    let carry = 0;
    for (let i = 0; i < len; i++) {
      const x = parseInt(A[i] || "0", 10);
      const y = parseInt(B[i] || "0", 10);
      const sum = x + y + carry;
      if (sum >= 10) return true;
      carry = sum >= 10 ? 1 : 0;
    }
    return false;
  }

  if (op === "-") {
    let borrow = 0;
    for (let i = 0; i < len; i++) {
      let x = parseInt(A[i] || "0", 10) - borrow;
      const y = parseInt(B[i] || "0", 10);
      if (x < y) return true;
      borrow = x < y ? 1 : 0;
    }
    return false;
  }

  return false;
}

/* -----------------------------------------------------------
   Log question statistics each time the question changes
----------------------------------------------------------- */
function formatAndLogQuestion(label, questionText, elapsedSeconds) {
  const parsed = parseQuestion(questionText);
  if (!parsed) return;

  const { a, b, op } = parsed;

  let operationName = "";
  let extraLabel = "";
  let extraValue = "";

  if (op === "+") {
    operationName = "Addition";
    extraLabel = "Carry";
    extraValue = needsCarryBorrow(op, a, b) ? "True" : "False";
  } else if (op === "-") {
    operationName = "Subtraction";
    extraLabel = "Borrow";
    extraValue = needsCarryBorrow(op, a, b) ? "True" : "False";
  } else if (op === "×") {
    operationName = "Multiplication";
    extraLabel = "Table1";
    extraValue = (a >= 2 && a <= 12) ? String(a) : "None";
  } else if (op === "÷") {
    operationName = "Division";
    extraLabel = "Table2";
    extraValue = (b >= 2 && b <= 12) ? String(b) : "None";
  }

  window.solvedQuestions.push({
    a,
    b,
    operation: operationName,
    time: elapsedSeconds,
    [extraLabel.toLowerCase()]: extraValue
  });

  window.lifetimeQuestions.push({
    a,
    b,
    operation: operationName,
    time: elapsedSeconds,
    carry: extraLabel === "Carry" ? extraValue : undefined,
    borrow: extraLabel === "Borrow" ? extraValue : undefined,
    table1: extraLabel === "Table1" ? extraValue : undefined,
    table2: extraLabel === "Table2" ? extraValue : undefined
  });

  if (window.updateZetamacUI) window.updateZetamacUI();
}

/* -----------------------------------------------------------
   Watch for question changes during the game
----------------------------------------------------------- */
function startObservingQuestions() {
  const questionElement = document.querySelector(".problem");
  if (!questionElement) {
    requestAnimationFrame(startObservingQuestions);
    return;
  }

  const initialText = questionElement.textContent.trim();
  if (initialText && lastQuestion === null) {
    lastQuestion = initialText;
    lastTimestamp = performance.now();
  }

  const observer = new MutationObserver(() => {
    const newQ = questionElement.textContent.trim();

    if (newQ && newQ !== lastQuestion) {
      if (lastQuestion && lastTimestamp) {
        const elapsed = (performance.now() - lastTimestamp) / 1000;
        formatAndLogQuestion("Q:", lastQuestion, elapsed);
      }

      lastQuestion = newQ;
      lastTimestamp = performance.now();
    }
  });

  observer.observe(questionElement, { childList: true, subtree: true });
}

/* -----------------------------------------------------------
   Detect the end of a game and trigger saving
----------------------------------------------------------- */
function findScoreElement() {
  const all = document.querySelectorAll("body *");
  for (const el of all) {
    const text = el.textContent.trim();
    if (text.startsWith("Score:")) return el;
  }
  return null;
}

function startObservingGameEnd() {
  const timerEl = document.querySelector(".left");
  const questionEl = document.querySelector(".problem");

  let secondsLeft = Infinity;
  if (timerEl) {
    const match = timerEl.textContent.match(/Seconds left:\s*(-?\d+)/);
    if (match) secondsLeft = parseInt(match[1], 10);
  }

  const timerExpired = secondsLeft <= 0;
  const questionGone = !questionEl || !questionEl.textContent.trim();

  if (!window.gameEnded && lastQuestion !== null && (timerExpired || questionGone)) {
    window.gameEnded = true;
    saveGameHistory();
    return;
  }

  requestAnimationFrame(startObservingGameEnd);
}

/* -----------------------------------------------------------
   Initialize event watchers
----------------------------------------------------------- */
function init() {
  startObservingQuestions();
  startObservingGameEnd();
}

init();
