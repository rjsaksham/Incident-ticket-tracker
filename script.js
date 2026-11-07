// Incident Ticket Tracker - tickets are stored in the browser (localStorage).

const STORAGE_KEY = "incident_tickets_v1";
const STATUSES = ["Open", "Acknowledged", "Investigating", "Escalated", "Resolved"];
// Sample SLA targets in minutes
const SLA = {
  P1: { respond: 15, resolve: 240 },
  P2: { respond: 30, resolve: 480 },
  P3: { respond: 240, resolve: 1440 },
  P4: { respond: 480, resolve: 4320 }
};

let tickets = loadTickets();
const openIds = new Set();

const listEl = document.getElementById("ticketList");
const form = document.getElementById("ticketForm");

function loadTickets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveTickets() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

function esc(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function nextId() {
  const max = tickets.reduce((m, t) => Math.max(m, parseInt(t.id.slice(4), 10)), 0);
  return "INC-" + String(max + 1).padStart(4, "0");
}

function formatTime(ms) {
  return new Date(ms).toLocaleString();
}

function formatDuration(ms) {
  const mins = Math.floor(Math.abs(ms) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? h + "h " + m + "m" : m + "m";
}

function addLog(ticket, text) {
  ticket.timeline.push({ time: Date.now(), text: text });
}

function createTicket(data, createdAt) {
  const t = {
    id: nextId(),
    title: data.title,
    category: data.category,
    severity: data.severity,
    service: data.service,
    reporter: data.reporter,
    description: data.description,
    status: "Open",
    createdAt: createdAt || Date.now(),
    acknowledgedAt: null,
    resolvedAt: null,
    bridgeStarted: false,
    timeline: []
  };
  t.timeline.push({ time: t.createdAt, text: "Ticket created by " + t.reporter + " with severity " + t.severity });
  tickets.unshift(t);
  return t;
}

// ---------- SLA ----------
function slaText(t) {
  const target = SLA[t.severity];
  const respondDue = t.createdAt + target.respond * 60000;
  const resolveDue = t.createdAt + target.resolve * 60000;
  const now = Date.now();
  let respond, resolve;

  if (t.acknowledgedAt) {
    const took = t.acknowledgedAt - t.createdAt;
    respond = took <= target.respond * 60000
      ? "<span class='ok'>Responded in " + formatDuration(took) + " (within SLA)</span>"
      : "<span class='bad'>Responded in " + formatDuration(took) + " (SLA missed)</span>";
  } else if (now > respondDue) {
    respond = "<span class='bad'>Response SLA breached by " + formatDuration(now - respondDue) + "</span>";
  } else {
    respond = "Response due in " + formatDuration(respondDue - now);
  }

  if (t.resolvedAt) {
    const took = t.resolvedAt - t.createdAt;
    resolve = took <= target.resolve * 60000
      ? "<span class='ok'>Resolved in " + formatDuration(took) + " (within SLA)</span>"
      : "<span class='bad'>Resolved in " + formatDuration(took) + " (SLA missed)</span>";
  } else if (now > resolveDue) {
    resolve = "<span class='bad'>Resolution SLA breached by " + formatDuration(now - resolveDue) + "</span>";
  } else {
    resolve = "Resolution due in " + formatDuration(resolveDue - now);
  }
  return respond + " | " + resolve;
}

function updateSlaTexts() {
  document.querySelectorAll(".sla[data-id]").forEach(el => {
    const t = tickets.find(x => x.id === el.getAttribute("data-id"));
    if (t) el.innerHTML = slaText(t);
  });
}

// ---------- Rendering ----------
function renderStats() {
  const active = t => t.status !== "Resolved";
  document.getElementById("statOpen").textContent = tickets.filter(active).length;
  document.getElementById("statP1").textContent = tickets.filter(t => active(t) && t.severity === "P1").length;
  document.getElementById("statP2").textContent = tickets.filter(t => active(t) && t.severity === "P2").length;
  document.getElementById("statResolved").textContent = tickets.filter(t => !active(t)).length;
}

function ticketHtml(t) {
  const isBridge = t.severity === "P1" || t.severity === "P2";
  const statusOptions = STATUSES.map(s => "<option" + (s === t.status ? " selected" : "") + ">" + s + "</option>").join("");
  const timeline = t.timeline.slice().reverse()
    .map(e => "<li><span class='t'>" + formatTime(e.time) + "</span>" + esc(e.text) + "</li>").join("");
  const bridgeButton = isBridge
    ? "<button data-action='bridge' data-id='" + t.id + "'>" + (t.bridgeStarted ? "Bridge call running" : "Start bridge call") + "</button>"
    : "";

  return "<details class='ticket sev" + t.severity + (t.status === "Resolved" ? " resolved" : "") + "' data-id='" + t.id + "'" +
    (openIds.has(t.id) ? " open" : "") + ">" +
    "<summary><span class='badge'>" + t.severity + "</span><b>" + t.id + "</b> - " + esc(t.title) +
    "<span class='status'>" + t.status + "</span></summary>" +
    "<div class='body'>" +
    "<p class='meta'>" + esc(t.category) + " | Service: " + esc(t.service) + " | Reported by: " + esc(t.reporter) + " | Created: " + formatTime(t.createdAt) + "</p>" +
    "<p>" + esc(t.description) + "</p>" +
    "<p class='sla' data-id='" + t.id + "'>" + slaText(t) + "</p>" +
    "<div class='actions'>" +
      "<select data-role='status' data-id='" + t.id + "'>" + statusOptions + "</select>" +
      "<button data-action='status' data-id='" + t.id + "'>Update status</button>" +
      "<select data-role='escalate' data-id='" + t.id + "'><option>L2 support team</option><option>Vendor</option><option>Leadership</option></select>" +
      "<button data-action='escalate' data-id='" + t.id + "'>Escalate</button>" +
      bridgeButton +
      "<button data-action='copy' data-id='" + t.id + "'>Copy stakeholder update</button>" +
    "</div>" +
    "<div class='actions'>" +
      "<input type='text' data-role='note' data-id='" + t.id + "' placeholder='Add a note to the timeline'>" +
      "<button data-action='note' data-id='" + t.id + "'>Add note</button>" +
    "</div>" +
    "<ul class='timeline'>" + timeline + "</ul>" +
    "</div></details>";
}

function render() {
  renderStats();
  const q = document.getElementById("search").value.trim().toLowerCase();
  const status = document.getElementById("statusFilter").value;
  const sev = document.getElementById("sevFilter").value;
  const shown = tickets
    .filter(t => status === "All" || t.status === status)
    .filter(t => sev === "All" || t.severity === sev)
    .filter(t => !q || t.id.toLowerCase().includes(q) || t.title.toLowerCase().includes(q));
  listEl.innerHTML = shown.length
    ? shown.map(ticketHtml).join("")
    : "<p class='empty'>No tickets to show. Create one or load the sample tickets.</p>";
}

// ---------- Actions ----------
function stakeholderUpdate(t) {
  const last = t.timeline[t.timeline.length - 1];
  const next = t.severity === "P1" ? "30 minutes" : t.severity === "P2" ? "1 hour" : "4 hours";
  return "[" + t.severity + "] " + t.id + " - " + t.title + "\n" +
    "Status: " + t.status + "\n" +
    "Category: " + t.category + " | Service affected: " + t.service + "\n" +
    "Latest update: " + last.text + "\n" +
    "Next update in: " + next;
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => alert("Update copied. Paste it in email or chat."))
      .catch(() => window.prompt("Copy this update:", text));
  } else {
    window.prompt("Copy this update:", text);
  }
}

listEl.addEventListener("click", e => {
  const action = e.target.getAttribute("data-action");
  if (!action) return;
  const id = e.target.getAttribute("data-id");
  const t = tickets.find(x => x.id === id);
  if (!t) return;
  const field = role => listEl.querySelector("[data-role='" + role + "'][data-id='" + id + "']");

  if (action === "status") {
    const newStatus = field("status").value;
    if (newStatus !== t.status) {
      t.status = newStatus;
      if (newStatus === "Acknowledged" && !t.acknowledgedAt) t.acknowledgedAt = Date.now();
      if (newStatus === "Resolved") t.resolvedAt = Date.now();
      addLog(t, "Status changed to " + newStatus);
    }
  } else if (action === "escalate") {
    const to = field("escalate").value;
    t.status = "Escalated";
    if (!t.acknowledgedAt) t.acknowledgedAt = Date.now();
    addLog(t, "Escalated to " + to);
  } else if (action === "bridge") {
    if (!t.bridgeStarted) {
      t.bridgeStarted = true;
      addLog(t, "Bridge call started for " + t.severity + " incident");
    }
  } else if (action === "note") {
    const input = field("note");
    if (!input.value.trim()) return;
    addLog(t, "Note: " + input.value.trim());
  } else if (action === "copy") {
    copyText(stakeholderUpdate(t));
    return;
  }
  saveTickets();
  render();
});

listEl.addEventListener("toggle", e => {
  const id = e.target.getAttribute("data-id");
  if (!id) return;
  if (e.target.open) openIds.add(id); else openIds.delete(id);
}, true);

form.addEventListener("submit", e => {
  e.preventDefault();
  const t = createTicket({
    title: document.getElementById("title").value.trim(),
    category: document.getElementById("category").value,
    severity: document.getElementById("severity").value,
    service: document.getElementById("service").value.trim(),
    reporter: document.getElementById("reporter").value.trim(),
    description: document.getElementById("description").value.trim()
  });
  openIds.add(t.id);
  saveTickets();
  form.reset();
  render();
});

document.getElementById("sampleBtn").addEventListener("click", () => {
  const minsAgo = m => Date.now() - m * 60000;
  const a = createTicket({
    title: "Branch router not reachable", category: "Network", severity: "P1",
    service: "Branch WAN link", reporter: "NOC monitoring",
    description: "Core router stopped responding to ping. Users at the branch cannot reach the internet."
  }, minsAgo(40));
  const b = createTicket({
    title: "Video conference room codec offline", category: "Video", severity: "P3",
    service: "Meeting Room 1", reporter: "Service desk",
    description: "Codec shows no signal. Restart tried by the user without success."
  }, minsAgo(90));
  a.timeline.push({ time: minsAgo(25), text: "Acknowledged and initial triage started" });
  a.status = "Acknowledged";
  a.acknowledgedAt = minsAgo(25);
  b.timeline.push({ time: minsAgo(60), text: "Note: checked cable and power, both fine" });
  saveTickets();
  render();
});

document.getElementById("clearBtn").addEventListener("click", () => {
  if (confirm("Delete all tickets?")) {
    tickets = [];
    saveTickets();
    render();
  }
});

["search", "statusFilter", "sevFilter"].forEach(id => {
  document.getElementById(id).addEventListener("input", render);
});

setInterval(updateSlaTexts, 30000);
render();
