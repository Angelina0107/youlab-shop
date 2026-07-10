/* Личный кабинет YOULAB: вход, профиль, заказы, бонусы (Supabase) */

const fmtP = (n) => n.toLocaleString("ru-RU") + " ₽";
const $ = (id) => document.getElementById(id);

let mode = "login";

async function boot() {
  if (!window.sb) { $("notConfigured").hidden = false; return; }
  const { data: { session } } = await sb.auth.getSession();
  session ? showCabinet() : showAuth();
}

function showAuth() {
  $("authBlock").hidden = false;
  $("cabinet").hidden = true;
}

/* Переключение вход/регистрация */
$("tabLogin").onclick = () => setMode("login");
$("tabSignup").onclick = () => setMode("signup");
function setMode(m) {
  mode = m;
  $("tabLogin").classList.toggle("active", m === "login");
  $("tabSignup").classList.toggle("active", m === "signup");
  $("authForm").name.hidden = m === "login";
  $("authSubmit").textContent = m === "login" ? "Войти" : "Зарегистрироваться";
  $("authError").hidden = true;
}

$("authForm").onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const email = f.get("email"), password = f.get("password");
  $("authSubmit").disabled = true;
  const { data, error } = mode === "login"
    ? await sb.auth.signInWithPassword({ email, password })
    : await sb.auth.signUp({ email, password, options: { data: { name: f.get("name") || "" } } });
  $("authSubmit").disabled = false;
  if (error) {
    const map = {
      "Invalid login credentials": "Неверный email или пароль",
      "User already registered": "Такой email уже зарегистрирован — попробуйте войти",
      "Email not confirmed": "Почта не подтверждена — проверьте письмо со ссылкой",
    };
    $("authError").textContent = map[error.message] ||
      (error.message.includes("is invalid") ? "Проверьте, правильно ли написан email" : error.message);
    $("authError").hidden = false;
    return;
  }
  if (!data.session) {
    $("authError").textContent = "Почти готово! Мы отправили письмо на " + email + " — перейдите по ссылке из него и войдите.";
    $("authError").hidden = false;
    setMode("login");
    return;
  }
  showCabinet();
};

$("logoutBtn").onclick = async () => { await sb.auth.signOut(); location.reload(); };

async function showCabinet() {
  $("authBlock").hidden = true;
  $("cabinet").hidden = false;
  const { data: { user } } = await sb.auth.getUser();

  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
  if (profile) {
    $("helloTitle").textContent = profile.name ? `Привет, ${profile.name}!` : "Кабинет";
    $("bonusBalance").textContent = profile.bonus_balance.toLocaleString("ru-RU");
    $("profileForm").name.value = profile.name || "";
    $("profileForm").phone.value = profile.phone || "";
    if (profile.is_admin) {
      const link = document.createElement("a");
      link.href = "crm.html";
      link.className = "btn btn-light";
      link.style.marginLeft = "10px";
      link.textContent = "Открыть CRM";
      $("logoutBtn").after(link);
    }
  }

  const { data: orders } = await sb.from("orders").select("*")
    .eq("user_id", user.id).order("created_at", { ascending: false });
  if (orders && orders.length) {
    const ST = { new: "Новый", confirmed: "Подтверждён", paid: "Оплачен", done: "Выполнен", cancelled: "Отменён" };
    $("ordersList").innerHTML = orders.map((o) => `
      <div class="order-row">
        <div>
          <p class="order-title">Заказ №${o.id} · ${new Date(o.created_at).toLocaleDateString("ru-RU")}</p>
          <p class="muted order-items">${o.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}</p>
        </div>
        <div class="order-right">
          <span class="order-status st-${o.status}">${ST[o.status] || o.status}</span>
          <strong>${fmtP(o.total)}</strong>
        </div>
      </div>`).join("");
  }

  const { data: txs } = await sb.from("bonus_transactions").select("*")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
  if (txs && txs.length) {
    $("bonusList").innerHTML = txs.map((t) => `
      <div class="order-row">
        <div>
          <p class="order-title">${t.reason || "Операция"}</p>
          <p class="muted order-items">${new Date(t.created_at).toLocaleDateString("ru-RU")}</p>
        </div>
        <strong class="${t.amount > 0 ? "tx-plus" : "tx-minus"}">${t.amount > 0 ? "+" : ""}${t.amount}</strong>
      </div>`).join("");
  }
}

$("profileForm").onsubmit = async (e) => {
  e.preventDefault();
  const { data: { user } } = await sb.auth.getUser();
  const f = new FormData(e.target);
  await sb.from("profiles").update({ name: f.get("name"), phone: f.get("phone") }).eq("id", user.id);
  $("profileSaved").hidden = false;
  setTimeout(() => { $("profileSaved").hidden = true; }, 2000);
  $("helloTitle").textContent = f.get("name") ? `Привет, ${f.get("name")}!` : "Кабинет";
};

boot();
