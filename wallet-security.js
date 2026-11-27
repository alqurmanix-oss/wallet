const AQX_WALLET_API = "https://fkiokwwztbyztleeuwks.supabase.co/functions/v1/aqx-wallet-security";
const AQX_WALLET_ANON = "sb_publishable_4DCXObCqPUoNnI8ANOo8dA_nRAg0y5_";

function aqxIdentityJwt() {
  const direct = ["aqx_wallet_identity_jwt", "aqx_identity_access_token", "aqx_access_token"];
  for (const key of direct) {
    const v = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (v && v.split(".").length === 3) return v;
  }
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
    try {
      const value = JSON.parse(localStorage.getItem(key) || "{}");
      if (value.access_token && value.access_token.split(".").length === 3) return value.access_token;
    } catch {}
  }
  return "";
}

async function aqxWalletApi(action, payload = {}, walletToken = "") {
  const jwt = aqxIdentityJwt();
  const headers = { "Content-Type": "application/json", apikey: AQX_WALLET_ANON };
  if (jwt) headers.Authorization = "Bearer " + jwt;
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
    email_not_verified: "يجب تفعيل البريد الإلكتروني في حساب AQX أولًا.",
    phone_not_verified: "يجب تفعيل رقم الهاتف في حساب AQX أولًا.",
    wallet_unavailable: "المحفظة غير متاحة حاليًا. تواصل مع دعم AQX.",
    wallet_password_already_set: "تم إنشاء كلمة مرور المحفظة بالفعل. انتقل إلى صفحة الدخول.",
    wallet_password_not_set: "لم يتم إنشاء كلمة مرور المحفظة بعد.",
    bot_check_failed: "تحقق البوتات غير صحيح أو انتهت صلاحيته. أعد المحاولة.",
    invalid_password: "كلمة المرور غير صحيحة.",
    temporarily_locked: "تم إيقاف محاولات الدخول مؤقتًا لحماية المحفظة.",
    password_policy_or_confirmation_failed: "تأكد من تطابق كلمتي المرور وأن تكون كلمة المرور 12 حرفًا على الأقل.",
    security_service_unavailable: "خدمة الحماية غير متاحة مؤقتًا. حاول لاحقًا."
  };
  return messages[code] || "تعذر إكمال العملية. حاول مرة أخرى.";
}

async function aqxNewChallenge(target) {
  const c = await aqxWalletApi("challenge");
  target.textContent = c.question;
  return c.token;
}
