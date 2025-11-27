// ===== PARSING FUNCTION =====
function parseQuestion(text) {
  // Detect operator (, -, ×, ÷, *, /)
  const operatorMatch = text.match(/[+\-×÷*/]/);
  if (!operatorMatch) return null;

  const operator = operatorMatch[0];
  
  // Split numbers around operator
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


// ===== MAIN SCRAPING LOGIC =====
const problemEl = document.querySelector('.problem');

if (!problemEl) {
  console.log("Couldn't find problem element! Check the selector.");
} else {
  window.questions = []; // store globally so we can inspect later
  let lastTime = performance.now();
  let lastText = problemEl.textContent.trim();

  const observer = new MutationObserver(() => {
    const now = performance.now();
    const text = problemEl.textContent.trim();

    // Ignore blank / repeated
    if (!text || text === lastText) return;

    lastText = text;
    const timeTaken = now - lastTime;
    lastTime = now;

    const parsed = parseQuestion(text);

    const entry = {
      question: text,
      ...parsed,     // spreads opType, a, b
      timeTakenMs: timeTaken
    };

    questions.push(entry);
    console.log("Captured:", entry);
  });

  observer.observe(problemEl, {
    childList: true,
    subtree: true,
    characterData: true
  });

  console.log("%cObserver attached. Answer questions!", "color: green; font-weight: bold;");
  console.log("%cCheck data anytime with: questions", "color: orange;");
}
