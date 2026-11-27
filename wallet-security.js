const AQX_WALLET_API = "https://fkiokwwztbyztleeuwks.supabase.co/functions/v1/aqx-wallet-security";
const AQX_WALLET_ANON = "sb_publishable_4DCXObCqPUoNnI8ANOo8dA_nRAg0y5_";
const AQX_WALLET_PARENT_ORIGIN = "https://id.alqurmanix.com";
let aqxWalletHandoffResolve;
const aqxWalletHandoffReady = new Promise(resolve => { aqxWalletHandoffResolve = resolve; });
window.addEventListener("message", event => {
  if (event.origin !== AQX_WALLET_PARENT_ORIGIN || event.source !== window.opener) return;
  const data = event.data;
  if (!data || data.type !== "AQX_WALLET_IDENTITY_HANDOFF" ||
      typeof data.access_token !== "string" || data.access_token.split(".").length !== 3 ||
      typeof data.aqx_session_token !== "string" || data.aqx_session_token.length < 20 ||
      typeof data.nonce !== "string" || data.nonce.length > 128) return;
  sessionStorage.setItem("aqx_identity_access_token", data.access_token);
  sessionStorage.setItem("aqx_session_token", data.aqx_session_token);
  if (typeof data.aqx_session_id === "string") sessionStorage.setItem("aqx_session_id", data.aqx_session_id);
  aqxWalletHandoffResolve(true);
  window.opener.postMessage({ type: "AQX_WALLET_HANDOFF_ACK", nonce: data.nonce }, AQX_WALLET_PARENT_ORIGIN);
});
if (window.opener) window.opener.postMessage({ type: "AQX_WALLET_READY" }, AQX_WALLET_PARENT_ORIGIN);

function aqxIdentityJwt() {
  const handed = sessionStorage.getItem("aqx_identity_access_token") || "";
  if (handed && handed.split(".").length === 3) return handed;
  const direct = ["aqx_wallet_identity_jwt", "aqx_access_token"];
  for (const key of direct) {
    const v = sessionStorage.getItem(key) || localStorage.getItem(key);
    if (v && v.split(".").length === 3) return v;
  }
  return "";
}

async function aqxWalletApi(action, payload = {}, walletToken = "") {
  let jwt = aqxIdentityJwt();
  let aqxSessionToken = sessionStorage.getItem("aqx_session_token") || "";
  if ((!jwt || !aqxSessionToken) && window.opener) {
    await Promise.race([aqxWalletHandoffReady, new Promise(resolve => setTimeout(resolve, 8000))]);
    jwt = aqxIdentityJwt();
    aqxSessionToken = sessionStorage.getItem("aqx_session_token") || "";
  }
  if (!jwt || !aqxSessionToken) throw Object.assign(new Error("aqx_identity_session_required"), { data: { error: "aqx_identity_session_required" } });
  const headers = { "Content-Type": "application/json", apikey: AQX_WALLET_ANON, "x-aqx-session": aqxSessionToken };
  headers.Authorization = "Bearer " + jwt;
  const response = await fetch(AQX_WALLET_API, {
    method: "POST", headers,
    body: JSON.stringify({ action, ...payload, ...(walletToken ? { wallet_token: walletToken } : {}) }),
    cache: "no-store", credentials: "omit"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw Object.assign(new Error(data.error || "request_failed"), { data, status: response.status });
  return data;
}

function aqxWalletError(code) {
  const messages = {
    aqx_account_session_required: "افتح المحفظة من داخل حساب AQX بعد تسجيل الدخول.",
    aqx_identity_session_required: "افتح المحفظة من لوحة التحكم المركزية بعد تسجيل الدخول.",
    aqx_identity_session_invalid: "انتهت جلسة حساب AQX أو لم تعد صالحة. سجّل الدخول من جديد.",
    email_not_verified: "يجب تأكيد البريد الإلكتروني في حساب AQX أولًا.",
    phone_not_verified: "يجب تأكيد رقم الهاتف في حساب AQX أولًا.",
    wallet_unavailable: "المحفظة غير متاحة حاليًا. تواصل مع دعم AQX.",
    wallet_password_already_set: "تم إنشاء كلمة مرور المحفظة بالفعل. انتقل إلى صفحة الدخول.",
    wallet_password_not_set: "لم يتم إنشاء كلمة مرور المحفظة بعد.",
    bot_check_failed: "تحقق البوتات غير صحيح أو انتهت صلاحيته. أعد المحاولة.",
    invalid_password: "كلمة المرور غير صحيحة.",
    temporarily_locked: "تم إيقاف محاولات الدخول مؤقتًا لحماية المحفظة.",
    password_policy_or_confirmation_failed: "كلمة المرور يجب أن تكون 12 حرفًا على الأقل، وتحتوي على حرف صغير وحرف كبير ورقم ورمز خاص، مع تطابق التأكيد.",
    wallet_maintenance: "دخول المحفظة متوقف مؤقتًا لحين اكتمال تجهيز الواجهة وربط الأنظمة.",
    security_service_unavailable: "خدمة الحماية غير متاحة مؤقتًا. حاول لاحقًا."
  };
  return messages[code] || "تعذر إكمال العملية. حاول مرة أخرى.";
}

async function aqxNewChallenge(target) {
  const c = await aqxWalletApi("challenge");
  target.textContent = c.question;
  return c.token;
}
