// ===== PARSING FUNCTION =====
function parseQuestion(text) {
  const operatorMatch = text.match(/[+\-×÷*/]/);
  if (!operatorMatch) return null;

  const operator = operatorMatch[0];
  const [left, right] = text.split(operator).map(s => s.trim());

  const a = parseInt(left, 10);
  const b = parseInt(right, 10);

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

// ===== CARRY / BORROW =====
function carryBorrowInfo(opType, a, b) {
  const aOnes = a % 10;
  const bOnes = b % 10;
  if (opType === "addition") return { carry: aOnes + bOnes >= 10 };
  if (opType === "subtraction") return { borrow: aOnes < bOnes };
  return {};
}

// ===== MULTIPLICATION / DIVISION TABLE =====
function tableInfo(opType, a, b) {
  if (opType === "multiplication" || opType === "division") {
    return { tableA: a, tableB: b };
  }
  return {};
}


// ===== MAIN SCRAPING LOGIC =====
const problemEl = document.querySelector('.problem');
const answerEl = document.querySelector('.answer');

if (!problemEl || !answerEl) {
  console.log("Couldn't find problem or answer element!");
} else {
  window.questions = [];
  let lastTime = performance.now();
  let lastText = problemEl.textContent.trim();

  function handleNewQuestion() {
    const now = performance.now();
    const newText = problemEl.textContent.trim();

    if (!newText || newText === lastText) return;

    const timeTaken = now - lastTime;
    lastTime = now;

    const parsed = parseQuestion(lastText);
    if (parsed) {
      const entry = {
        question: lastText,
        ...parsed,
        ...carryBorrowInfo(parsed.opType, parsed.a, parsed.b),
        ...tableInfo(parsed.opType, parsed.a, parsed.b),
        timeTakenMs: timeTaken
      };
      questions.push(entry);
      console.log("Captured:", entry);
    }

    lastText = newText;
  }

  // Observe problem text changes
  const problemObserver = new MutationObserver(handleNewQuestion);
  problemObserver.observe(problemEl, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  // Observe input clearing (answer accepted)
  const inputObserver = new MutationObserver(() => {
    if (answerEl.value === "") {
      handleNewQuestion();
    }
  });
  inputObserver.observe(answerEl, {
    attributes: true,
    attributeFilter: ["value"],
  });

  console.log("%cTracking started — solve questions!", "color: green; font-weight: bold;");
  console.log("%cType `questions` to review captured data", "color: orange;");
}
