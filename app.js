const DEFAULT_STATE = {
  coffee: 22,
  ratio: 16.5,
  water: 363,
  flavor: "Sweet",
  body: "Medium",
  temperature: 201,
  lastPair: "ratio",
};

const PRESETS = {
  single: { coffee: 15, ratio: 16.5 },
  standard: { coffee: 22, ratio: 16.5 },
  batch: { coffee: 44, ratio: 16.5 },
};

const FLAVOR_SPLITS = {
  Sweet: [0.4, 0.6],
  Balanced: [0.5, 0.5],
  Bright: [0.6, 0.4],
};

const BODY_POURS = {
  Light: 1,
  Medium: 2,
  Heavy: 3,
};

const STEP_SIZES = { coffee: 0.1, water: 5, ratio: 0.1, temperature: 1 };

const CUP_NOTES = {
  "Sweet-Light": "Clear sweetness, lighter texture, soft acidity.",
  "Sweet-Medium": "Round sweetness, moderate weight, smooth acidity.",
  "Sweet-Heavy": "Deep sweetness, fuller body, gentle acidity.",
  "Balanced-Light": "Even flavor, high clarity, clean finish.",
  "Balanced-Medium": "Balanced sweetness and acidity with a steady body.",
  "Balanced-Heavy": "Balanced cup with extra weight and a longer finish.",
  "Bright-Light": "Higher clarity, lighter body, more vivid acidity.",
  "Bright-Medium": "Vivid acidity, moderate body, crisp sweetness.",
  "Bright-Heavy": "Lively acidity with a fuller, more structured body.",
};

const els = {
  coffee: document.querySelector("#coffee"),
  water: document.querySelector("#water"),
  ratio: document.querySelector("#ratio"),
  flavor: document.querySelector("#flavor"),
  body: document.querySelector("#body"),
  temperature: document.querySelector("#temperature"),
  summaryCoffee: document.querySelector("#summary-coffee"),
  summaryWater: document.querySelector("#summary-water"),
  summaryRatio: document.querySelector("#summary-ratio"),
  summaryTemp: document.querySelector("#summary-temp"),
  summaryFlavor: document.querySelector("#summary-flavor"),
  summaryBody: document.querySelector("#summary-body"),
  validationNote: document.querySelector("#validation-note"),
  pourCount: document.querySelector("#pour-count"),
  pourRows: document.querySelector("#pour-rows"),
  timeline: document.querySelector("#timeline"),
  timerLabel: document.querySelector("#timer-label"),
  timerDisplay: document.querySelector("#timer-display"),
  timerPrompt: document.querySelector("#timer-prompt"),
  timerToggle: document.querySelector("#timer-toggle"),
  timerReset: document.querySelector("#timer-reset"),
  cupNotes: document.querySelector("#cup-notes"),
  favorites: document.querySelector("#favorites"),
  toast: document.querySelector("#toast"),
};

let state = { ...DEFAULT_STATE };
let toastTimer;
let timerId;
const timer = {
  running: false,
  elapsedMs: 0,
  startedAt: 0,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value, fallback) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatRatio(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function formatStopwatch(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  const millis = String(milliseconds % 1000).padStart(3, "0");
  return `${minutes}:${seconds}.${millis}`;
}

function currentElapsedMs() {
  if (!timer.running) return timer.elapsedMs;
  return Date.now() - timer.startedAt + timer.elapsedMs;
}

function splitTotal(total, weights) {
  const raw = weights.map((weight) => total * weight);
  const amounts = raw.map(Math.floor);
  let remaining = total - amounts.reduce((sum, amount) => sum + amount, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let i = 0; i < remaining; i += 1) {
    amounts[order[i % order.length].index] += 1;
  }

  return amounts;
}

function getRecipe() {
  const water = Math.round(state.water);
  const firstSection = Math.round(water * 0.4);
  const lastSection = water - firstSection;
  const flavorPours = splitTotal(firstSection, FLAVOR_SPLITS[state.flavor]);
  const bodyCount = BODY_POURS[state.body];
  const bodyWeights = Array.from({ length: bodyCount }, () => 1 / bodyCount);
  const bodyPours = splitTotal(lastSection, bodyWeights);
  const pours = [...flavorPours, ...bodyPours];
  let total = 0;

  return pours.map((amount, index) => {
    total += amount;
    return {
      number: index + 1,
      amount,
      total,
      time: index * 45,
    };
  });
}

function reconcile(changed) {
  const note = [];
  let corrected = false;

  if (changed === "coffee") {
    state.coffee = Math.max(toNumber(els.coffee.value, state.coffee), 0.1);
    if (state.lastPair === "ratio") {
      state.water = Math.round(state.coffee * state.ratio);
    } else {
      state.ratio = state.water / state.coffee;
    }
  }

  if (changed === "water") {
    state.water = Math.max(toNumber(els.water.value, state.water), 1);
    state.ratio = state.water / state.coffee;
    state.lastPair = "water";
  }

  if (changed === "ratio") {
    state.ratio = toNumber(els.ratio.value, state.ratio);
    state.lastPair = "ratio";
    state.water = Math.round(state.coffee * state.ratio);
  }

  if (changed === "temperature") {
    const requestedTemp = toNumber(els.temperature.value, state.temperature);
    state.temperature = Math.round(clamp(requestedTemp, 170, 212));
    corrected = requestedTemp !== state.temperature;
  }

  if (changed === "flavor") {
    state.flavor = els.flavor.value;
  }

  if (changed === "body") {
    state.body = els.body.value;
  }

  if (state.ratio < 10 || state.ratio > 20) {
    state.ratio = clamp(state.ratio, 10, 20);
    state.water = Math.round(state.coffee * state.ratio);
    corrected = true;
    note.push("Ratio kept between 1:10 and 1:20.");
  }

  if (state.water <= 0 || state.coffee <= 0) {
    state.coffee = Math.max(state.coffee, 0.1);
    state.water = Math.max(state.water, 1);
  }

  resetTimer(false);
  els.validationNote.textContent = note.join(" ");
  render(corrected ? undefined : changed);
}

function render(activeField) {
  const pours = getRecipe();
  const roundedCoffee = Math.round(state.coffee * 10) / 10;
  const roundedWater = Math.round(state.water);
  const roundedRatio = Math.round((roundedWater / roundedCoffee) * 10) / 10;

  state.water = roundedWater;
  state.ratio = roundedRatio;

  if (activeField !== "coffee") els.coffee.value = String(roundedCoffee);
  if (activeField !== "water") els.water.value = String(roundedWater);
  if (activeField !== "ratio") els.ratio.value = formatRatio(roundedRatio);
  if (activeField !== "temperature") els.temperature.value = String(state.temperature);
  els.flavor.value = state.flavor;
  els.body.value = state.body;

  els.summaryCoffee.textContent = `${roundedCoffee} g`;
  els.summaryWater.textContent = `${roundedWater} g`;
  els.summaryRatio.textContent = `1:${formatRatio(roundedRatio)}`;
  els.summaryTemp.textContent = `${state.temperature}°F`;
  els.summaryFlavor.textContent = state.flavor;
  els.summaryBody.textContent = state.body;
  els.pourCount.textContent = `${pours.length} pours`;
  els.cupNotes.textContent = CUP_NOTES[`${state.flavor}-${state.body}`];

  els.pourRows.replaceChildren(
    ...pours.map((pour) => {
      const row = document.createElement("div");
      row.className = "table-row";
      row.setAttribute("role", "row");
      row.innerHTML = `
        <strong role="cell">#${pour.number}</strong>
        <strong role="cell">${pour.amount} g</strong>
        <strong role="cell">${pour.total} g</strong>
      `;
      return row;
    }),
  );

  els.timeline.replaceChildren(
    ...pours.map((pour) => {
      const item = document.createElement("li");
      item.dataset.pourTime = String(pour.time);
      item.innerHTML = `<span>${formatTime(pour.time)}</span> Pour #${pour.number} <strong>${pour.amount} g</strong>`;
      return item;
    }),
  );

  updateTimerDisplay();
  renderFavorites();
}

function getTimerStatus(elapsed) {
  const pours = getRecipe();
  const finalTime = pours.length * 45;
  const nextPour = pours.find((pour) => pour.time > elapsed);
  const currentPour = [...pours].reverse().find((pour) => pour.time <= elapsed) || pours[0];

  if (elapsed >= finalTime) {
    return {
      label: "Drawdown",
      prompt: "All pours complete. Let the bed finish draining.",
      activePour: null,
      doneThrough: pours.length,
    };
  }

  if (!timer.running && elapsed === 0) {
    return {
      label: "Stopwatch ready",
      prompt: `Pour #1: ${pours[0].amount} g when you start.`,
      activePour: 1,
      doneThrough: 0,
    };
  }

  if (nextPour) {
    return {
      label: `Pour #${currentPour.number}`,
      prompt: `Now ${currentPour.amount} g. Next: #${nextPour.number} at ${formatTime(nextPour.time)}.`,
      activePour: currentPour.number,
      doneThrough: currentPour.number - 1,
    };
  }

  return {
    label: `Pour #${currentPour.number}`,
    prompt: `Final pour: ${currentPour.amount} g. Target finish around ${formatTime(finalTime)}.`,
    activePour: currentPour.number,
    doneThrough: currentPour.number - 1,
  };
}

function updateTimerDisplay() {
  const elapsedMs = currentElapsedMs();
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const status = getTimerStatus(elapsedSeconds);

  els.timerDisplay.textContent = formatStopwatch(elapsedMs);
  els.timerLabel.textContent = status.label;
  els.timerPrompt.textContent = status.prompt;
  els.timerToggle.textContent = timer.running ? "Pause" : elapsedMs > 0 ? "Resume" : "Start";

  [...els.timeline.children].forEach((item, index) => {
    const pourNumber = index + 1;
    item.classList.toggle("active", status.activePour === pourNumber);
    item.classList.toggle("done", status.doneThrough >= pourNumber);
  });
}

function startTimer() {
  if (timer.running) return;
  timer.running = true;
  timer.startedAt = Date.now();
  timerId = window.setInterval(updateTimerDisplay, 33);
  updateTimerDisplay();
}

function pauseTimer() {
  if (!timer.running) return;
  timer.elapsedMs = currentElapsedMs();
  timer.running = false;
  window.clearInterval(timerId);
  updateTimerDisplay();
}

function resetTimer(showMessage = true) {
  timer.running = false;
  timer.elapsedMs = 0;
  timer.startedAt = 0;
  window.clearInterval(timerId);
  if (showMessage) showToast("Timer reset.");
  updateTimerDisplay();
}

function toggleTimer() {
  if (timer.running) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function recipeText() {
  const pours = getRecipe();
  const lines = [
    "Coffee 4:6 Brew Recipe",
    `Coffee: ${Math.round(state.coffee * 10) / 10} g`,
    `Water: ${Math.round(state.water)} g`,
    `Ratio: 1:${formatRatio(state.ratio)}`,
    `Temperature: ${state.temperature}°F`,
    `Flavor: ${state.flavor}`,
    `Body: ${state.body}`,
    "",
    "Pours:",
    ...pours.map((pour) => `#${pour.number}: ${pour.amount} g, total ${pour.total} g at ${formatTime(pour.time)}`),
    "",
    CUP_NOTES[`${state.flavor}-${state.body}`],
  ];

  return lines.join("\n");
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 1900);
}

async function copyRecipe() {
  try {
    await navigator.clipboard.writeText(recipeText());
    showToast("Recipe copied.");
  } catch {
    showToast("Clipboard unavailable.");
  }
}

async function shareRecipe() {
  const text = recipeText();
  if (navigator.share) {
    try {
      await navigator.share({ title: "Coffee 4:6 Brew Recipe", text });
      return;
    } catch {
      return;
    }
  }
  await copyRecipe();
}

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem("brew46Favorites")) || [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites) {
  localStorage.setItem("brew46Favorites", JSON.stringify(favorites.slice(0, 6)));
}

function saveFavorite() {
  const favorite = {
    ...state,
    id: Date.now(),
  };
  const favorites = [favorite, ...getFavorites().filter((item) => item.id !== favorite.id)];
  saveFavorites(favorites);
  renderFavorites();
  showToast("Favorite saved.");
}

function loadFavorite(favorite) {
  state = { ...DEFAULT_STATE, ...favorite };
  render();
  showToast("Favorite loaded.");
}

function renderFavorites() {
  const favorites = getFavorites();
  if (!favorites.length) {
    els.favorites.innerHTML = `<p class="favorite-item">No saved recipes yet.</p>`;
    return;
  }

  els.favorites.replaceChildren(
    ...favorites.map((favorite) => {
      const item = document.createElement("div");
      item.className = "favorite-item";
      const label = `${favorite.coffee} g / 1:${formatRatio(favorite.ratio)} / ${favorite.flavor}, ${favorite.body}`;
      item.innerHTML = `
        <div>
          <strong>${label}</strong>
          <p>${Math.round(favorite.water)} g at ${favorite.temperature}°F</p>
        </div>
        <button type="button">Load</button>
      `;
      item.querySelector("button").addEventListener("click", () => loadFavorite(favorite));
      return item;
    }),
  );
}

function applyPreset(name) {
  const preset = PRESETS[name];
  state = {
    ...state,
    coffee: preset.coffee,
    ratio: preset.ratio,
    water: Math.round(preset.coffee * preset.ratio),
    lastPair: "ratio",
  };
  render();
}

document.querySelectorAll(".preset").forEach((button) => {
  button.addEventListener("click", () => applyPreset(button.dataset.preset));
});

document.querySelectorAll(".step").forEach((btn) => {
  btn.addEventListener("click", () => {
    const { target, dir } = btn.dataset;
    const delta = STEP_SIZES[target] * Number(dir);
    if (target === "coffee") {
      els.coffee.value = String(Math.round(Math.max(0.1, state.coffee + delta) * 10) / 10);
    } else if (target === "water") {
      els.water.value = String(Math.max(1, Math.round(state.water + delta)));
    } else if (target === "ratio") {
      els.ratio.value = String(Math.round(clamp(state.ratio + delta, 10, 20) * 10) / 10);
    } else if (target === "temperature") {
      els.temperature.value = String(clamp(Math.round(state.temperature + delta), 170, 212));
    }
    reconcile(target);
  });
});

els.coffee.addEventListener("input", () => reconcile("coffee"));
els.water.addEventListener("input", () => reconcile("water"));
els.ratio.addEventListener("change", () => reconcile("ratio"));
els.temperature.addEventListener("change", () => reconcile("temperature"));
els.coffee.addEventListener("blur", () => render());
els.water.addEventListener("blur", () => render());
els.ratio.addEventListener("blur", () => render());
els.temperature.addEventListener("blur", () => render());
els.flavor.addEventListener("change", () => reconcile("flavor"));
els.body.addEventListener("change", () => reconcile("body"));
document.querySelector("#copy").addEventListener("click", copyRecipe);
document.querySelector("#share").addEventListener("click", shareRecipe);
document.querySelector("#save").addEventListener("click", saveFavorite);
document.querySelector("#reset").addEventListener("click", () => {
  state = { ...DEFAULT_STATE };
  resetTimer(false);
  render();
  showToast("Defaults restored.");
});
els.timerToggle.addEventListener("click", toggleTimer);
els.timerReset.addEventListener("click", () => resetTimer());

if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}

render();
