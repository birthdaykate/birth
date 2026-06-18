// ============================================================
// TERMINAL INTRO — typing animation for boot sequence
// ============================================================

const BOOT_LINES = [
  { text: "&gt; Initializing Birthday Universe...", delay: 0 },
  { text: "&gt; Creating Stars...", delay: 650 },
  { text: "&gt; Generating Memories...", delay: 1300 },
  { text: "&gt; Building Galaxy...", delay: 1950 },
  { text: "&gt; Status: <span class=\"ok\">READY</span>", delay: 2700 },
];

export function runTerminalIntro({ onStarsBegin, onComplete }) {
  const linesEl = document.getElementById("terminal-lines");
  const enterBtn = document.getElementById("enter-btn");

  BOOT_LINES.forEach((line, i) => {
    setTimeout(() => {
      const div = document.createElement("div");
      div.className = "line";
      div.innerHTML = line.text;
      linesEl.appendChild(div);

      // trigger ambient star spawn as soon as the second line appears
      if (i === 1 && typeof onStarsBegin === "function") onStarsBegin();
    }, line.delay);
  });

  setTimeout(() => {
    enterBtn.classList.add("show");
  }, BOOT_LINES[BOOT_LINES.length - 1].delay + 500);

  enterBtn.addEventListener("click", () => {
    const screen = document.getElementById("terminal-screen");
    screen.style.transition = "opacity 1s ease";
    screen.style.opacity = "0";
    setTimeout(() => {
      screen.style.display = "none";
      if (typeof onComplete === "function") onComplete();
    }, 1000);
  }, { once: true });
}
