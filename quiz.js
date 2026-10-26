/* ==========================================================
   IT 3203 Milestone 2 - quiz logic for quiz.html
   Handles: starting the quiz, the 10-minute countdown,
   scoring, the results panel, and the retake/reset button.
   ========================================================== */
(function () {
  "use strict";

  /* ---------- Settings ---------- */
  var TIME_LIMIT_SECONDS = 10 * 60;   // 10 minutes
  var POINTS_PER_QUESTION = 10;
  var PASS_PERCENT = 70;

  /* ---------- Answer key ----------
     type "single": one correct radio value
     type "multi":  every correct checkbox value (all-or-nothing)
     type "blank":  list of accepted answers (compared lowercase, trimmed) */
  var QUESTIONS = [
    { id: 1,  type: "single", answer: "b", note: "HTTP/1.0 (1996) added headers and status codes." },
    { id: 2,  type: "blank",  answer: ["transfer"], display: "Transfer", note: "HTTP = HyperText Transfer Protocol." },
    { id: 3,  type: "single", answer: "c", note: "Persistent connections let many requests reuse one TCP connection." },
    { id: 4,  type: "multi",  answer: ["a", "b", "c"], note: "HTTP/2 added binary framing, multiplexing and HPACK. QUIC is HTTP/3." },
    { id: 5,  type: "blank",  answer: ["quic"], display: "QUIC", note: "HTTP/3 uses QUIC, which runs over UDP." },
    { id: 6,  type: "single", answer: "c", note: "404 means Not Found." },
    { id: 7,  type: "multi",  answer: ["a", "b", "c"], note: "TLS gives confidentiality, integrity and authentication, but not guaranteed speed." },
    { id: 8,  type: "blank",  answer: ["stateless"], display: "stateless", note: "HTTP is stateless; cookies, sessions and tokens add memory." },
    { id: 9,  type: "single", answer: "b", note: "Tim Berners-Lee created HTTP at CERN." },
    { id: 10, type: "single", answer: "c", note: "HTTP/3 uses QUIC so a lost packet only delays its own stream." }
  ];

  /* ---------- Page elements ---------- */
  var form = document.getElementById("quiz-form");
  var intro = document.getElementById("quiz-intro");
  var area = document.getElementById("quiz-area");
  var results = document.getElementById("results");
  var timerDisplay = document.getElementById("timer-display");
  var timerBar = document.getElementById("timer-bar");
  var progressDisplay = document.getElementById("progress-display");

  /* ---------- State ---------- */
  var startTime = 0;      // when the quiz started (ms)
  var timerId = null;     // setInterval id
  var finished = false;   // true after submission

  /* ---------- Small helpers ---------- */
  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function formatTime(totalSeconds) {
    return pad(Math.floor(totalSeconds / 60)) + ":" + pad(totalSeconds % 60);
  }

  // Build an element with optional class and text (textContent keeps user input safe)
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text !== undefined) { node.textContent = text; }
    return node;
  }

  // Text of the label next to a radio/checkbox input
  function optionText(input) {
    return input.parentElement.querySelector("span").textContent;
  }

  /* ---------- Timer ---------- */
  function updateTimer() {
    var elapsed = Math.floor((Date.now() - startTime) / 1000);
    var remaining = Math.max(0, TIME_LIMIT_SECONDS - elapsed);
    timerDisplay.textContent = formatTime(remaining);
    // Warn the user in the last minute
    timerBar.classList.toggle("timer-warning", remaining <= 60);
    if (remaining === 0 && !finished) {
      submitQuiz(true);   // time is up: submit automatically
    }
  }

  function startTimer() {
    startTime = Date.now();
    updateTimer();
    timerId = setInterval(updateTimer, 250);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  /* ---------- Progress counter ("3 of 10 answered") ---------- */
  function isAnswered(q) {
    var inputs = form.elements["q" + q.id];
    if (q.type === "blank") { return inputs.value.trim() !== ""; }
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].checked) { return true; }
    }
    return false;
  }

  function updateProgress() {
    var count = QUESTIONS.filter(isAnswered).length;
    progressDisplay.textContent = count + " of " + QUESTIONS.length + " answered";
  }

  /* ---------- Reading a user's answer and grading it ---------- */
  // Returns { correct: boolean, given: text shown in the review }
  function grade(q) {
    var inputs = form.elements["q" + q.id];
    var i, given;

    if (q.type === "blank") {
      var typed = inputs.value.trim();
      return {
        correct: q.answer.indexOf(typed.toLowerCase()) !== -1,
        given: typed === "" ? "(no answer)" : typed
      };
    }

    if (q.type === "single") {
      for (i = 0; i < inputs.length; i++) {
        if (inputs[i].checked) {
          return { correct: inputs[i].value === q.answer, given: optionText(inputs[i]) };
        }
      }
      return { correct: false, given: "(no answer)" };
    }

    // multi-select: the chosen set must exactly match the correct set
    var chosen = [], chosenText = [];
    for (i = 0; i < inputs.length; i++) {
      if (inputs[i].checked) {
        chosen.push(inputs[i].value);
        chosenText.push(optionText(inputs[i]));
      }
    }
    var exact = chosen.length === q.answer.length &&
                q.answer.every(function (v) { return chosen.indexOf(v) !== -1; });
    given = chosenText.length ? chosenText.join("; ") : "(no answer)";
    return { correct: exact, given: given };
  }

  // Text describing the correct answer for the review
  function correctText(q) {
    if (q.type === "blank") { return q.display; }
    var inputs = form.elements["q" + q.id];
    var parts = [];
    for (var i = 0; i < inputs.length; i++) {
      var isRight = q.type === "single" ? inputs[i].value === q.answer
                                        : q.answer.indexOf(inputs[i].value) !== -1;
      if (isRight) { parts.push(optionText(inputs[i])); }
    }
    return parts.join("; ");
  }

  /* ---------- Submit: score, show results ---------- */
  function submitQuiz(timedOut) {
    if (finished) { return; }
    finished = true;
    stopTimer();

    var secondsUsed = Math.min(TIME_LIMIT_SECONDS, Math.floor((Date.now() - startTime) / 1000));
    var total = 0;
    var details = QUESTIONS.map(function (q) {
      var g = grade(q);
      var points = g.correct ? POINTS_PER_QUESTION : 0;
      total += points;
      return { q: q, correct: g.correct, points: points, given: g.given };
    });

    markQuestions(details);
    renderResults(details, total, secondsUsed, timedOut);

    // Lock the inputs so answers cannot be changed after submission
    Array.prototype.forEach.call(form.querySelectorAll("fieldset"), function (fs) { fs.disabled = true; });
    form.querySelector(".form-actions").hidden = true;
    timerBar.hidden = true;

    results.hidden = false;
    results.focus();
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Color each question card and show its feedback line
  function markQuestions(details) {
    details.forEach(function (d) {
      var card = document.getElementById("question-" + d.q.id);
      card.classList.add(d.correct ? "is-correct" : "is-incorrect");
      var fb = card.querySelector(".q-feedback");
      fb.hidden = false;
      fb.textContent = (d.correct ? "Correct. " : "Incorrect. Correct answer: " + correctText(d.q) + ". ") + d.q.note;
    });
  }

  function renderResults(details, total, secondsUsed, timedOut) {
    var max = QUESTIONS.length * POINTS_PER_QUESTION;
    var percent = Math.round((total / max) * 100);
    var passed = percent >= PASS_PERCENT;
    var numCorrect = details.filter(function (d) { return d.correct; }).length;

    results.textContent = "";
    results.className = "results " + (passed ? "results-pass" : "results-fail");

    // Overall banner
    results.appendChild(el("h2", "results-title", passed ? "Result: PASS" : "Result: FAIL"));
    if (timedOut) {
      results.appendChild(el("p", "results-note", "Time ran out, so your quiz was submitted automatically."));
    }

    // Summary numbers: score, percent, correct count, time
    var summary = el("div", "summary-grid");
    [
      ["Total score", total + " / " + max],
      ["Percentage", percent + "% (pass mark " + PASS_PERCENT + "%)"],
      ["Correct answers", numCorrect + " of " + QUESTIONS.length],
      ["Time spent", formatTime(secondsUsed) + " of " + formatTime(TIME_LIMIT_SECONDS)]
    ].forEach(function (pair) {
      var box = el("div", "summary-item");
      box.appendChild(el("span", "summary-label", pair[0]));
      box.appendChild(el("strong", "summary-value", pair[1]));
      summary.appendChild(box);
    });
    results.appendChild(summary);

    // Per-question table: score, result and correct answer
    var table = el("table", "results-table");
    var caption = el("caption", "", "Question-by-question results");
    var thead = el("thead");
    var headRow = el("tr");
    ["Question", "Result", "Score", "Your answer", "Correct answer"].forEach(function (h) {
      var th = el("th", "", h);
      th.scope = "col";
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    var tbody = el("tbody");
    details.forEach(function (d) {
      var row = el("tr", d.correct ? "row-correct" : "row-incorrect");
      row.appendChild(el("td", "", "Q" + d.q.id));
      row.appendChild(el("td", "result-cell", d.correct ? "Correct" : "Incorrect"));
      row.appendChild(el("td", "", d.points + " / " + POINTS_PER_QUESTION));
      row.appendChild(el("td", "", d.given));
      row.appendChild(el("td", "", correctText(d.q)));
      tbody.appendChild(row);
    });
    table.appendChild(caption);
    table.appendChild(thead);
    table.appendChild(tbody);
    results.appendChild(table);

    // Retake button
    var retake = el("button", "btn btn-primary", "Retake Quiz");
    retake.type = "button";
    retake.addEventListener("click", resetQuiz);
    results.appendChild(retake);
  }

  /* ---------- Reset / retake: clear inputs, results and timer ---------- */
  function resetQuiz() {
    stopTimer();
    finished = false;
    form.reset();                              // clears every input
    Array.prototype.forEach.call(form.querySelectorAll("fieldset"), function (fs) {
      fs.disabled = false;
      fs.classList.remove("is-correct", "is-incorrect");
      var fb = fs.querySelector(".q-feedback");
      fb.hidden = true;
      fb.textContent = "";
    });
    results.hidden = true;
    results.textContent = "";
    results.className = "results";
    form.querySelector(".form-actions").hidden = false;
    timerBar.hidden = false;
    timerBar.classList.remove("timer-warning");
    timerDisplay.textContent = formatTime(TIME_LIMIT_SECONDS);
    updateProgress();
    area.hidden = true;                        // back to the start screen
    intro.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- Wire up events ---------- */
  document.getElementById("start-btn").addEventListener("click", function () {
    intro.hidden = true;
    area.hidden = false;
    finished = false;
    startTimer();
    window.scrollTo({ top: 0 });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();                    // stay on the page
    submitQuiz(false);
  });

  // "Reset Answers" during the quiz clears answers but keeps the clock running
  document.getElementById("reset-btn").addEventListener("click", function () {
    form.reset();
    updateProgress();
  });

  form.addEventListener("input", updateProgress);
  form.addEventListener("change", updateProgress);
})();
