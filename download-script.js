// ===============================
// AUTH + BACK/FORWARD GUARD (FINAL)
// ===============================
const API = window.DATASET_API;
const authToken = sessionStorage.getItem("authToken");

if (!authToken) {
  window.location.replace("/");
}

window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    sessionStorage.removeItem("authToken");
    window.location.replace("/");
  }
});

// ===============================
// STATE
// ===============================
let qaData = {
  crop: '',
  behavior: '',
  pairs: []
};

let pairCounter = 0;

// ===============================
// DOM
// ===============================
const menuBtn = document.getElementById("menuBtn");
const menuDropdown = document.getElementById("menuDropdown");
const viewLogsBtn = document.getElementById("viewLogsBtn");

const logsModal = document.getElementById("logsModal");
const logsContainer = document.getElementById("logsContainer");
const closeLogs = document.getElementById("closeLogs");

const cropSelect = document.getElementById('cropSelect');
const behaviorSelect = document.getElementById('behaviorSelect');

const enterCropBtn = document.getElementById('enterCropBtn');
const resetCropBtn = document.getElementById('resetCropBtn');

const enterBehaviorBtn = document.getElementById('enterBehaviorBtn');
const resetBehaviorBtn = document.getElementById('resetBehaviorBtn');

const qaContainer = document.getElementById('qaContainer');
const addNewBtn = document.getElementById('addNewBtn');
const submitBtn = document.getElementById('submitBtn');
const previewBtn = document.getElementById('previewBtn');
const draftStatus = document.getElementById('draftStatus');
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.onclick = () => {
    sessionStorage.removeItem("authToken");
    window.location.replace("/");
  };
}

// Modals
const confirmModal = document.getElementById('confirmModal');
const successModal = document.getElementById('successModal');
const previewModal = document.getElementById('previewModal');

const confirmSubmit = document.getElementById('confirmSubmit');
const cancelSubmit = document.getElementById('cancelSubmit');
const closePreview = document.getElementById('closePreview');
const closeSuccess = document.getElementById('closeSuccess');

// ===============================
// LOAD CROPS
// ===============================
async function loadCrops() {
  try {
    const res = await fetch(
      `${API}/crops`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (handleAuthError(res)) return;
    const data = await res.json();
    cropSelect.innerHTML = '<option value="">Choose crop...</option>';

    data.crops.forEach(crop => {
      const option = document.createElement("option");
      option.value = crop;
      option.textContent = crop.replaceAll("_", " ");
      cropSelect.appendChild(option);
    });

    // The draft is restored before the crop list arrives; re-apply it now
    // that the option exists, otherwise the saved crop silently disappears.
    if (qaData.crop) {
      cropSelect.value = qaData.crop;
      disableButton(enterCropBtn);
    }
  } catch {
    alert("Failed to load crops");
  }
}

// ===============================
// INIT
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  loadCrops();
  loadDraft();
  renderAllPairs();
  attachEvents();
});

// ===============================
// EVENTS
// ===============================
function attachEvents() {
  enterCropBtn.onclick = () => {
    if (!cropSelect.value) return;
    qaData.crop = cropSelect.value;
    disableButton(enterCropBtn);
    saveDraft();
  };

  resetCropBtn.onclick = () => {
    cropSelect.value = '';
    qaData.crop = '';
    enableButton(enterCropBtn);
    saveDraft();
  };

  enterBehaviorBtn.onclick = () => {
    if (!behaviorSelect.value) return;
    qaData.behavior = behaviorSelect.value;
    disableButton(enterBehaviorBtn);
    saveDraft();
  };

  resetBehaviorBtn.onclick = () => {
    behaviorSelect.value = '';
    qaData.behavior = '';
    enableButton(enterBehaviorBtn);
    saveDraft();
  };

  addNewBtn.onclick = addNewQAPair;
  previewBtn.onclick = showPreview;

  submitBtn.onclick = () => {
    if (!validateBeforeSubmit()) return;
    showConfirm();
  };

  confirmSubmit.onclick = handleSubmit;
  cancelSubmit.onclick = () => confirmModal.classList.remove('active');
  closePreview.onclick = () => previewModal.classList.remove('active');

  closeSuccess.onclick = () => {
    successModal.classList.remove("active");
    localStorage.removeItem("qaDatasetDraft");
    window.location.reload();
  };
}

// ===============================
// CONFIRM MODAL
// ===============================
function showConfirm() {
  document.getElementById('totalPairs').innerText = qaData.pairs.length;
  confirmModal.classList.add('active');
}

// ===============================
// Q/A MANAGEMENT
// ===============================
function addNewQAPair() {
  removeEmptyState();

  const pair = {
    id: crypto.randomUUID(),
    number: qaData.pairs.length + 1,
    turns: [
      { role: "user", text: "" },
      { role: "model", text: "" }
    ]
  };

  qaData.pairs.push(pair);
  pairCounter = qaData.pairs.length;
  renderPair(pair);
  saveDraft();
}

function renderPair(pair) {
  const card = document.createElement('div');
  card.className = 'qa-card';
  card.dataset.id = pair.id;

  card.innerHTML = `
    <div class="qa-header">
      <div class="qa-number">Q${pair.number}</div>
      <button class="btn-delete">Delete</button>
    </div>
    <div class="turns-container"></div>
    <button class="btn-followup">+ Follow-up</button>
  `;

  const turnsContainer = card.querySelector('.turns-container');

  function renderTurns() {
    turnsContainer.innerHTML = "";
    pair.turns.forEach(turn => {
      const textarea = document.createElement("textarea");
      textarea.className = "qa-textarea";
      textarea.placeholder = turn.role === "user" ? "Enter question" : "Enter answer";
      textarea.value = turn.text;

      textarea.oninput = e => {
        turn.text = e.target.value;
        saveDraft();
      };

      turnsContainer.appendChild(textarea);
    });
  }

  renderTurns();

  card.querySelector(".btn-followup").onclick = () => {
    pair.turns.push(
      { role: "user", text: "" },
      { role: "model", text: "" }
    );
    renderTurns();
    saveDraft();
  };

  card.querySelector('.btn-delete').onclick = () => {
    qaData.pairs = qaData.pairs.filter(p => p.id !== pair.id);
    card.remove();
    renumber();
    saveDraft();
    if (!qaData.pairs.length) showEmptyState();
  };

  qaContainer.appendChild(card);
}

function renumber() {
  qaData.pairs.forEach((p, i) => {
    p.number = i + 1;
    const card = document.querySelector(`[data-id="${p.id}"]`);
    if (card) card.querySelector('.qa-number').innerText = `Q${p.number}`;
  });
}

// ===============================
// EMPTY STATE
// ===============================
function showEmptyState() {
  qaContainer.innerHTML = `
    <div id="emptyState" class="empty-state">
      <p>No Q/A pairs yet. Click "+ New Slot" to begin.</p>
    </div>
  `;
}

function removeEmptyState() {
  const el = document.getElementById('emptyState');
  if (el) el.remove();
}

// ===============================
// PREVIEW (FIXED)
// ===============================
function showPreview() {
  document.getElementById('previewCrop').innerText = qaData.crop || '-';
  document.getElementById('previewTopic').innerText = qaData.behavior || '-';
  document.getElementById('previewCount').innerText = qaData.pairs.length;

  const container = document.getElementById('previewContainer');
  container.innerHTML = '';

  // Build nodes with textContent: answers are free text and may contain
  // "<" or markup, which innerHTML would render (or execute).
  qaData.pairs.forEach(p => {
    p.turns.forEach(t => {
      const item = document.createElement("div");
      item.className = "preview-item";
      const label = document.createElement("strong");
      label.textContent = t.role === "user" ? "Q: " : "A: ";
      item.append(label, document.createTextNode(t.text));
      container.appendChild(item);
    });
  });

  previewModal.classList.add('active');
}

// ===============================
// SUBMIT
// ===============================
function handleSubmit() {
  confirmModal.classList.remove('active');

  submitBtn.innerText = 'Submitting...';
  submitBtn.disabled = true;

  fetch(`${API}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      crop: qaData.crop,
      behavior: qaData.behavior,
      turns: qaData.pairs.flatMap(p =>
        p.turns.map(t => ({ role: t.role, text: t.text.trim() }))
      )
    })
  })
    .then(res => {
      if (handleAuthError(res)) return;
      if (!res.ok) throw new Error();
      successModal.classList.add('active');
      localStorage.removeItem('qaDatasetDraft');
    })
    .catch(() => alert('Submission failed'))
    .finally(() => {
      submitBtn.innerText = 'Submit';
      submitBtn.disabled = false;
    });
}

// ===============================
// VALIDATION (FIXED)
// ===============================
function validateBeforeSubmit() {
  if (!qaData.crop || !qaData.behavior) {
    alert('Select crop and question type');
    return false;
  }
  if (!qaData.pairs.length) {
    alert('Add at least one Q/A pair');
    return false;
  }
  const incomplete = qaData.pairs.find(p => p.turns.some(t => !t.text.trim()));
  if (incomplete) {
    alert(`Q${incomplete.number} has an empty question or answer`);
    return false;
  }
  return true;
}

// ===============================
// STORAGE
// ===============================
function saveDraft() {
  localStorage.setItem('qaDatasetDraft', JSON.stringify(qaData));
  draftStatus.classList.add('visible');
  setTimeout(() => draftStatus.classList.remove('visible'), 1000);
}

function loadDraft() {
  const saved = localStorage.getItem('qaDatasetDraft');
  if (!saved) {
    showEmptyState();
    return;
  }
  try {
    qaData = JSON.parse(saved);
  } catch {
    localStorage.removeItem('qaDatasetDraft');   // corrupt draft: start clean
    showEmptyState();
    return;
  }
  behaviorSelect.value = qaData.behavior || '';
  if (qaData.behavior) disableButton(enterBehaviorBtn);
}

function renderAllPairs() {
  if (!qaData.pairs.length) {
    showEmptyState();
    return;
  }
  qaData.pairs.forEach(renderPair);
}

// ===============================
// BUTTON UTILS
// ===============================
function disableButton(btn) {
  btn.style.background = '#e5e7eb';
  btn.style.color = '#111';
  btn.disabled = true;
}

function enableButton(btn) {
  btn.style.background = '';
  btn.style.color = '';
  btn.disabled = false;
}

// ===============================
// MENU & MY SUBMISSIONS
// ===============================
function handleAuthError(res) {
  if (res.status === 401) {
    sessionStorage.removeItem("authToken");
    alert("Session expired. Please log in again.");
    window.location.replace("/");
    return true;
  }
  return false;
}

function renderSubmission(s) {
  const item = document.createElement("div");
  item.className = "log-item";
  const rows = [
    ["Crop", String(s.crop).replaceAll("_", " ")],
    ["Type", s.behavior],
    ["Count", s.count],
  ];
  for (const [label, value] of rows) {
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    item.append(strong, document.createTextNode(value ?? "-"), document.createElement("br"));
  }
  const when = document.createElement("small");
  when.textContent = new Date(s.timestamp).toLocaleString();
  item.appendChild(when);
  return item;
}

if (menuBtn && menuDropdown) {
  menuBtn.onclick = () => menuDropdown.classList.toggle("hidden");
}

if (viewLogsBtn) {
  viewLogsBtn.onclick = async () => {
    logsContainer.textContent = "Loading...";
    logsModal.classList.add("active");
    menuDropdown.classList.add("hidden");

    try {
      const res = await fetch(`${API}/my-submissions`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (handleAuthError(res)) return;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      logsContainer.textContent = "";
      if (!data.submissions || !data.submissions.length) {
        logsContainer.textContent = "No submissions yet.";
        return;
      }
      data.submissions.forEach(s => logsContainer.appendChild(renderSubmission(s)));
    } catch (err) {
      logsContainer.textContent = `Could not load submissions (${err.message}).`;
    }
  };
}

if (closeLogs) {
  closeLogs.onclick = () => logsModal.classList.remove("active");
}
