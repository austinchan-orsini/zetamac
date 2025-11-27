// =======================
// PARSE THE QUESTION
// =======================
function parseQuestion(text) {
  // Find operator symbol
  const operatorMatch = text.match(/[+\-×÷*/]/);
  if (!operatorMatch) return null;

  const operator = operatorMatch[0];

  // Split into left and right numbers
  const [left, right] = text.split(operator).map(s => s.trim());

  const a = parseInt(left, 10);
  const b = parseInt(right, 10);

  // Classify math type
  const opType = {
    "+": "addition",
    "-": "subtraction",
    "×": "multiplication",
    "*": "multiplication",
    "÷": "division",
    "/": "division"
  }[operator];

  return { opType, a, b };
}


// =======================
// CHECK CARRY / BORROW
// =======================
function carryBorrowInfo(opType, a, b) {
  const aOnes = a % 10;
  const bOnes = b % 10;

  if (opType === "addition") {
    const carry = (aOnes + bOnes) >= 10;
    return { carry };
  }

  if (opType === "subtraction") {
    const borrow = aOnes < bOnes;
    return { borrow };
  }

  return {};
}


// =======================
// MULTIPLICATION TABLE CATEGORY
// =======================
function tableInfo(opType, a, b) {
  if (opType === "multiplication" || opType === "division") {
    return { tableA: a, tableB: b };
  }
  return {};
}


// =======================
// MAIN SCRAPING LOGIC
// =======================
const problemEl = document.querySelector('.problem');

if (!problemEl) {
  console.log("Couldn't find problem element! Check the selector.");
} else {
  window.questions = []; // Accessible globally for debugging
  let lastTime = performance.now();
  let lastText = problemEl.textContent.trim();

  const observer = new MutationObserver(() => {
    const now = performance.now();
    const text = problemEl.textContent.trim();

    // Ignore blank or repeated text
    if (!text || text === lastText) return;
    lastText = text;

    // Time difference since last question
    const timeTaken = now - lastTime;
    lastTime = now;

    const parsed = parseQuestion(text);
    if (!parsed) return;

    const carryBorrow = carryBorrowInfo(parsed.opType, parsed.a, parsed.b);
    const table = tableInfo(parsed.opType, parsed.a, parsed.b);

    const entry = {
      question: text,
      ...parsed,
      ...carryBorrow,
      ...table,
      timeTakenMs: timeTaken
    };

    window.questions.push(entry);
    console.log("Captured:", entry);
  });

  observer.observe(problemEl, {
    childList: true,
    subtree: true,
    characterData: true
  });

  console.log("%cObserver attached. Do a round and watch data collect!",
              "color: green; font-weight: bold;");
  console.log("%cView results anytime with: questions",
              "color: orange;");
}
