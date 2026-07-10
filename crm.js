/* YOULAB мини-CRM: канбан заказов на Supabase (доступ только админу) */

const $ = (id) => document.getElementById(id);
const fmt = (n) => (n || 0).toLocaleString("ru-RU") + " ₽";

const COLUMNS = [
  { key: "new",       name: "Новый",            color: "#e24b4a" },
  { key: "confirmed", name: "В работе",         color: "#ef9f27" },
  { key: "link_sent", name: "Ссылка отправлена", color: "#378add" },
  { key: "paid",      name: "Оплачено",         color: "#639922" },
  { key: "done",      name: "Выполнен",         color: "#1d9e75" },
  { key: "cancelled", name: "Отменён",          color: "#b4b2a9" },
];
const STATUS_NAME = Object.fromEntries(COLUMNS.map((c) => [c.key, c.name]));

let ORDERS = [];

async function boot() {
  if (!window.sb) { $("notConfigured").hidden = false; return; }
  const { data: { session } } = await sb.auth.getSession();
  session ? enter() : ($("loginGate").hidden = false);
}

$("crmLoginForm").onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  $("crmLoginBtn").disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email: f.get("email"), password: f.get("password") });
  $("crmLoginBtn").disabled = false;
  if (error) {
    $("crmLoginError").textContent = error.message.includes("Invalid") ? "Неверный email или пароль" : error.message;
    $("crmLoginError").hidden = false;
    return;
  }
  $("loginGate").hidden = true;
  enter();
};

async function enter() {
  const { data: { user } } = await sb.auth.getUser();
  const { data: profile } = await sb.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile || !profile.is_admin) {
    $("noAccess").hidden = false;
    return;
  }
  $("board").hidden = false;
  await loadOrders();
}

async function loadOrders() {
  const { data, error } = await sb.from("orders").select("*").order("created_at", { ascending: false });
  if (error) { alert("Ошибка загрузки: " + error.message); return; }
  ORDERS = data || [];
  render();
}

function render() {
  const box = $("columns");
  box.innerHTML = "";
  for (const col of COLUMNS) {
    const list = ORDERS.filter((o) => o.status === col.key);
    const el = document.createElement("div");
    el.className = "crm-col";
    el.innerHTML = `
      <div class="crm-col-head">
        <span class="crm-col-name"><span class="crm-dot" style="background:${col.color}"></span>${col.name}</span>
        <span class="crm-col-count">${list.length}</span>
      </div>
      <div class="crm-col-body" data-status="${col.key}"></div>`;
    const body = el.querySelector(".crm-col-body");
    if (!list.length) body.innerHTML = `<div class="crm-col-empty">пусто</div>`;
    list.forEach((o) => body.appendChild(cardEl(o)));
    setupDrop(body);
    box.appendChild(el);
  }
  const newCount = ORDERS.filter((o) => o.status === "new").length;
  $("newCounter").textContent = newCount ? `${newCount} новых` : "нет новых заказов";
}

function cardEl(o) {
  const el = document.createElement("div");
  el.className = "crm-card";
  el.draggable = true;
  el.dataset.id = o.id;
  const items = (o.items || []).map((i) => `${i.name} ×${i.qty}`).join(", ");
  el.innerHTML = `
    <div class="crm-card-top">
      <span class="crm-card-id">№${o.id}</span>
      <span class="crm-card-total">${fmt(o.total)}</span>
    </div>
    <div class="crm-card-name">${o.name || "Без имени"}</div>
    <div class="crm-card-items">${items || "—"}</div>
    <div class="crm-card-foot">
      <span class="crm-card-date">${new Date(o.created_at).toLocaleDateString("ru-RU")}</span>
      ${o.user_id ? `<span class="crm-card-user">клиент сайта</span>` : ""}
    </div>`;
  el.onclick = () => openCard(o);
  el.ondragstart = (e) => { el.classList.add("dragging"); e.dataTransfer.setData("id", o.id); };
  el.ondragend = () => el.classList.remove("dragging");
  return el;
}

function setupDrop(body) {
  body.ondragover = (e) => { e.preventDefault(); body.classList.add("drag-over"); };
  body.ondragleave = () => body.classList.remove("drag-over");
  body.ondrop = async (e) => {
    e.preventDefault();
    body.classList.remove("drag-over");
    const id = +e.dataTransfer.getData("id");
    const status = body.dataset.status;
    await setStatus(id, status);
  };
}

async function setStatus(id, status) {
  const order = ORDERS.find((o) => o.id === id);
  if (!order || order.status === status) return;
  const { error } = await sb.from("orders").update({ status }).eq("id", id);
  if (error) { alert("Не удалось сменить статус: " + error.message); return; }
  order.status = status;
  render();
  if ($("cardDrawer").classList.contains("open") && currentCardId === id) openCard(order);
}

/* --- Детальная карточка --- */
let currentCardId = null;
const backdrop = $("cardBackdrop");
function closeCard() { $("cardDrawer").classList.remove("open"); backdrop.hidden = true; currentCardId = null; }
$("cardClose").onclick = closeCard;
backdrop.onclick = closeCard;

function openCard(o) {
  currentCardId = o.id;
  $("cardTitle").textContent = `Заказ №${o.id}`;
  const items = (o.items || []).map((i) =>
    `<tr><td>${i.name} ×${i.qty}</td><td>${fmt((i.price || 0) * i.qty)}</td></tr>`).join("");
  const contact = (label, value, href) => value
    ? `<div class="crm-field"><div class="crm-field-label">${label}</div><div class="crm-field-value">${href ? `<a class="crm-contact-link" href="${href}">${value}</a>` : value}</div></div>` : "";

  $("cardBody").innerHTML = `
    <div class="crm-field">
      <div class="crm-field-label">Статус</div>
      <div class="crm-status-btns" id="statusBtns"></div>
    </div>
    <div class="crm-field">
      <div class="crm-field-label">Состав</div>
      <table class="crm-items-table">${items || "<tr><td>—</td></tr>"}</table>
      <div class="crm-total-row"><span>Итого</span><span>${fmt(o.total)}</span></div>
    </div>
    ${contact("Имя", o.name)}
    ${contact("Телефон", o.phone, o.phone ? "tel:" + o.phone.replace(/[^+\d]/g, "") : null)}
    ${contact("Email", o.email, o.email ? "mailto:" + o.email : null)}
    ${contact("Адрес", o.address)}
    ${contact("Комментарий клиента", o.comment)}
    ${contact("Создан", new Date(o.created_at).toLocaleString("ru-RU"))}
    <div class="crm-field">
      <div class="crm-field-label">Заметка менеджера (клиент не видит)</div>
      <textarea class="crm-note" id="noteInput" rows="3" placeholder="Например: перезвонить после 18:00">${o.manager_note || ""}</textarea>
      <div style="margin-top:8px;display:flex;gap:10px;align-items:center">
        <button class="btn btn-dark crm-btn" id="saveNote">Сохранить заметку</button>
        <span class="crm-saved" id="noteSaved" hidden>Сохранено ✓</span>
      </div>
    </div>`;

  const btns = $("statusBtns");
  for (const col of COLUMNS) {
    const b = document.createElement("button");
    b.className = "crm-status-btn" + (o.status === col.key ? " active" : "");
    b.textContent = col.name;
    b.onclick = () => setStatus(o.id, col.key);
    btns.appendChild(b);
  }
  $("saveNote").onclick = async () => {
    const note = $("noteInput").value;
    const { error } = await sb.from("orders").update({ manager_note: note }).eq("id", o.id);
    if (error) { alert("Ошибка: " + error.message); return; }
    o.manager_note = note;
    $("noteSaved").hidden = false;
    setTimeout(() => { $("noteSaved").hidden = true; }, 2000);
  };

  $("cardDrawer").classList.add("open");
  backdrop.hidden = false;
}

/* --- CSV экспорт --- */
$("exportBtn").onclick = () => {
  const head = ["id", "дата", "статус", "имя", "телефон", "email", "адрес", "сумма", "состав", "комментарий", "заметка"];
  const rows = ORDERS.map((o) => [
    o.id, new Date(o.created_at).toLocaleDateString("ru-RU"), STATUS_NAME[o.status] || o.status,
    o.name, o.phone, o.email, o.address, o.total,
    (o.items || []).map((i) => `${i.name} x${i.qty}`).join("; "),
    o.comment, o.manager_note,
  ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
  const csv = "﻿" + [head.join(","), ...rows].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = "youlab-orders.csv"; a.click();
  URL.revokeObjectURL(url);
};

$("refreshBtn").onclick = loadOrders;
$("crmLogout").onclick = async () => { await sb.auth.signOut(); location.reload(); };
$("noAccessLogout").onclick = async () => { await sb.auth.signOut(); location.reload(); };

boot();
