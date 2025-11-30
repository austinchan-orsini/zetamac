console.log("Zetamac Tracker Loaded ");

let lastQuestion = null;
let lastTimestamp = null; // for timing
let gameEnded = false;
window.solvedQuestions = [];

/*************** HELPERS *****************/

// Parse operator + numbers, handling unicode minus and en dash
function parseQuestion(q) {
  // includes Unicode minus "−" and en dash "–"
  const ops = ["+", "−", "–", "-", "×", "÷", "*", "/"];
  const rawOp = ops.find(op => q.includes(op));
  if (!rawOp) return null;

  const parts = q.split(rawOp);
  if (parts.length < 2) return null;

  const a = parseInt(parts[0].trim(), 10);
  const b = parseInt(parts[1].replace("=", "").trim(), 10);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;

  // normalize operator
  let op = rawOp;
  if (rawOp === "*" ) op = "×";
  if (rawOp === "/" ) op = "÷";
  if (rawOp === "−" || rawOp === "–" || rawOp === "-") op = "-";

  return { a, b, op };
}

// full multi-digit carry/borrow
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

// whether this is a times-table fact
// × → row is A; ÷ → row is B
function isTimesTable(op, a, b) {
  if (op === "×") return a >= 2 && a <= 12;
  if (op === "÷") return b >= 2 && b <= 12;
  return false;
}

// make the label strings you want
function formatAndLogQuestion(label, questionText, elapsedSeconds) {
  const parsed = parseQuestion(questionText);
  if (!parsed) {
    console.log(label, "could not parse:", questionText);
    return;
  }

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

  const timeStr = `${elapsedSeconds.toFixed(2)}s`;

  console.log(
    `${label} A: ${a}, B: ${b}, Operation: ${operationName}, Time: ${timeStr}, ${extraLabel}: ${extraValue}`
  );

  window.solvedQuestions.push({
    a, b,
    operation: operationName,
    time: elapsedSeconds,
    [extraLabel.toLowerCase()]: extraValue
  });
  if (window.updateZetamacUI) updateZetamacUI();
}


/*************** QUESTION WATCHER *****************/
function startObservingQuestions() {
  const questionElement = document.querySelector(".problem");

  if (!questionElement) {
    requestAnimationFrame(startObservingQuestions);
    return;
  }

  const initialText = questionElement.textContent.trim();
  if (initialText && lastQuestion === null) {
    console.log(
      "%cInitial Question ➜",
      "color: cyan; font-weight:bold;",
      initialText
    );
    lastQuestion = initialText;
    lastTimestamp = performance.now();
  }

  const observer = new MutationObserver(() => {
    const newQ = questionElement.textContent.trim();

    if (newQ && newQ !== lastQuestion) {
      // log the previous question with all metadata
      if (lastQuestion && lastTimestamp) {
        const elapsed = (performance.now() - lastTimestamp) / 1000;
        formatAndLogQuestion("Q:", lastQuestion, elapsed);
      }

      console.log(
        "%cNew Question ➜",
        "color: yellow; font-weight:bold;",
        newQ
      );
      
      lastQuestion = newQ;
      lastTimestamp = performance.now();
    }
  });

  observer.observe(questionElement, { childList: true, subtree: true });
}

/*************** GAME END WATCHER *****************/

function findScoreElement() {
  const all = document.querySelectorAll("body *");
  for (const el of all) {
    const text = el.textContent.trim();
    if (text.startsWith("Score:")) {
      return el;
    }
  }
  return null;
}

function startObservingGameEnd() {
  const timerEl = document.querySelector(".left");
  const questionEl = document.querySelector(".problem");

  let secondsLeft = Infinity;

  if (timerEl) {
    const match = timerEl.textContent.match(/Seconds left:\s*(-?\d+)/);
    if (match) {
      secondsLeft = parseInt(match[1], 10);
    }
  }

  const timerExpired = secondsLeft <= 0;
  const questionGone = !questionEl || !questionEl.textContent.trim();

  if (!gameEnded && lastQuestion !== null && (timerExpired || questionGone)) {
    gameEnded = true;
    console.log(
      "%cGAME FINISHED 🛑",
      "color:red; font-size:16px; font-weight:bold;"
    );
    console.log(solvedQuestions);
    window.gameEnded = true;
    if (window.updateZetamacUI) updateZetamacUI(); 
    const scoreEl = findScoreElement();
    if (scoreEl) {
      console.log(
        "%cFinal Score ➜",
        "color: orange; font-weight:bold;",
        scoreEl.textContent.trim()
      );
    } else {
      console.log(
        "%cFinal Score ➜ Unable to detect score element.",
        "color: orange;"
      );
    }

    return;
  }

  requestAnimationFrame(startObservingGameEnd);
}

/*************** INIT *****************/
function init() {
  console.log("Waiting for game to start...");
  startObservingQuestions();
  startObservingGameEnd();
}

init();
