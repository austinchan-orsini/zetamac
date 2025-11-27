const problemEl = document.querySelector('.problem');

if (!problemEl) {
  console.log("Couldn't find problem element! Check the selector.");
} else {
  const questions = [];
  let lastTime = performance.now();
  let lastText = problemEl.textContent.trim();

  const observer = new MutationObserver(() => {
    const now = performance.now();
    const text = problemEl.textContent.trim();

    if (!text || text === lastText) return;
    lastText = text;

    const timeTaken = now - lastTime;
    lastTime = now;

    const entry = { question: text, timeTakenMs: timeTaken };
    questions.push(entry);

    console.log("New question:", entry);
  });

  observer.observe(problemEl, {
    childList: true,
    subtree: true,
    characterData: true
  });

  console.log("Observer attached. Answer questions and watch the console!");
}
