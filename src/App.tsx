import { useEffect, useMemo, useState } from "react";

type ApiResult = { answer?: string } | string | null;

const WEBHOOK_URL = import.meta.env.VITE_RAG_WEBHOOK_URL as string | undefined;

// Office email (fixed)
const OFFICE_EMAIL = "rsjprwjp@st.ritsumei.ac.jp";

// Cooldown (anti-spam)
const COOLDOWN_SECONDS = 8;

const DISCLAIMER = {
  ja: "※この回答は参考情報です。最終的な判断・公式回答は、必ずプログラムコーディネーター（事務局）に確認してください。",
  en: "Note: This answer is for reference only. For an official and final answer, please confirm with the program coordinator (office).",
  zh: "提示：本回答仅供参考。最终判断与正式答复请务必向项目协调员（事务局）确认。",
  ko: "안내: 이 답변은 참고용입니다. 최종 판단 및 공식 안내는 반드시 프로그램 코디네이터(사무국)에게 확인해 주세요。",
};

type QuickTemplate = { label: string; text: string };

const QUICK_TEMPLATES: { title: string; items: QuickTemplate[] }[] = [
  {
    title: "Popular topics",
    items: [
      { label: "Fees", text: "RSJP/RWJP（Regular/Express）の費用はいくらですか？宿泊費は含まれますか？" },
      { label: "Schedule", text: "初日の集合場所と時間、持ち物を教えてください。" },
      { label: "Payment", text: "支払い方法と支払い期限を教えてください。クレジットカードは使えますか？" },
      { label: "Absence", text: "体調不良で欠席/遅刻しそうです。手続きと連絡方法を教えてください。" },
      { label: "Housing", text: "宿泊先（寮/ホテル）の情報とチェックイン方法を教えてください。" },
      { label: "Wi-Fi", text: "寮や教室でWi-Fiは使えますか？SIMやポケットWi-Fiは必要ですか？" },
    ],
  },
  {
    title: "Language samples",
    items: [
      { label: "EN", text: "How much is the program fee for RSJP/RWJP (Regular/Express)? Is accommodation included?" },
      { label: "中文", text: "RSJP/RWJP（普通/Express）的费用是多少？是否包含住宿费？" },
      { label: "한국어", text: "RSJP/RWJP(일반/Express) 프로그램 비용은 얼마인가요? 숙박비가 포함되나요?" },
      { label: "日本語", text: "RSJP/RWJP（通常/Express）の費用はいくらですか？宿泊費は含まれますか？" },
    ],
  },
];

/** ---------- Static FAQs (no API) ---------- **/

type StaticFaqGroup = {
  title: string;
  q: { ja: string[]; en: string[] };
  a: { ja: string; en: string };
};

const STATIC_FAQ_GROUPS: StaticFaqGroup[] = [
  {
    title: "Official / Disclaimer",
    q: {
      ja: [
        "このサイトの回答は公式ですか？",
        "この回答は正しいですか？",
        "AIの回答は信用できますか？",
        "このFAQサイトの情報は確定ですか？",
        "ここに書いてある内容は最終回答ですか？",
        "このサイトの回答をそのまま信じていいですか？",
        "AI回答は最新ですか？",
      ],
      en: [
        "Is the answer on this site official?",
        "Is this answer correct?",
        "Can I trust the AI answer?",
        "Is this information final?",
        "Is the AI answer up to date?",
        "Is this the official answer?",
      ],
    },
    a: {
      ja: "いいえ。ここに表示される回答は参考情報です。最終的な判断・公式回答は、必ずプログラムコーディネーター（事務局）に確認してください。",
      en: "No. The answer shown here is for reference only. For an official and final answer, please confirm with the program coordinator (office).",
    },
  },
  {
    title: "Fees / Payment / Schedule may change",
    q: {
      ja: [
        "費用や支払いなど、毎年変わる情報はどう確認すればいいですか？",
        "費用は毎年変わりますか？",
        "支払い期限はどこで確認できますか？",
        "スケジュールや日程はどこで確認できますか？",
        "料金・日程の最新情報はどこですか？",
        "案内資料はどこで見られますか？",
        "最新版の資料で確認したいです。",
      ],
      en: [
        "How should I confirm information that may change each year (fees, payment, schedule, etc.)?",
        "Do fees change each year?",
        "Where can I check the payment deadline?",
        "Where can I find the latest schedule?",
        "Where can I find the latest official information?",
        "Where can I see the official guide?",
      ],
    },
    a: {
      ja: "費用・支払い期限・日程などは年度によって変わる可能性があります。最新の案内資料を確認し、不明点は事務局へメールしてください（下の「Email the office」）。",
      en: "Fees, payment deadlines, and schedules may change by year. Please check the latest official information. If you are not sure, email the office (use “Email the office” below).",
    },
  },
  {
    title: "Absence / Late",
    q: {
      ja: [
        "欠席や遅刻をする場合、どうすればいいですか？",
        "体調不良で欠席したいです。",
        "遅刻しそうです。どうしたらいいですか？",
        "早退したい場合はどうすればいいですか？",
        "病院に行く必要があります。欠席連絡は必要ですか？",
        "急に参加できなくなりました。どう連絡すればいいですか？",
      ],
      en: [
        "What should I do if I will be absent or late?",
        "I am sick and may be absent. What should I do?",
        "I will be late. Who should I contact?",
        "I need to leave early. What should I do?",
        "I need to go to a hospital. How should I contact the office?",
      ],
    },
    a: {
      ja: "原則、できるだけ早く事務局へ連絡してください。緊急の場合はメール送信後、可能なら電話等も検討してください（手段は年度の案内に従ってください）。",
      en: "In general, please contact the office as early as possible. In urgent cases, after sending an email, please consider calling as well if available (follow the official guidance for your year).",
    },
  },
  {
    title: "Accommodation included?",
    q: {
      ja: [
        "宿泊（寮/ホテル）はプログラム費用に含まれますか？",
        "宿泊は含まれますか？",
        "寮費はプログラム費用に入っていますか？",
        "ホテル代は別ですか？",
        "宿泊費は自分で払いますか？",
        "どこに泊まりますか？（寮/ホテル）",
      ],
      en: [
        "Is accommodation included in the program fee?",
        "Is housing included?",
        "Is the dorm fee included?",
        "Do I need to pay for the hotel separately?",
        "Do I pay accommodation by myself?",
      ],
    },
    a: {
      ja: "年度・プログラム形態により異なります。必ず公式案内資料を確認してください。不明な場合は事務局へメールしてください。",
      en: "It depends on the year and program type. Please check the official information. If you are not sure, email the office.",
    },
  },
  {
    title: "Wi-Fi / SIM",
    q: {
      ja: [
        "Wi-FiやSIMは必要ですか？",
        "寮にWi-Fiはありますか？",
        "教室でWi-Fiは使えますか？",
        "SIMカードは必要ですか？",
        "ポケットWi-Fiは必要ですか？",
        "インターネット環境はどうなっていますか？",
      ],
      en: [
        "Do I need Wi-Fi or a SIM card?",
        "Is Wi-Fi available in the dorm?",
        "Is Wi-Fi available in the classroom?",
        "Do I need a SIM card?",
        "Do I need a pocket Wi-Fi?",
      ],
    },
    a: {
      ja: "滞在先や教室のWi-Fi環境は年度・施設により異なります。必要に応じてSIM/ポケットWi-Fiの準備を検討してください。不安なら事務局へ確認してください。",
      en: "Wi-Fi availability depends on the year and facilities. If needed, consider preparing a SIM or pocket Wi-Fi. If you are not sure, please confirm with the office.",
    },
  },
];

function pickDisclaimerBlock() {
  // 1行ずつ確実に改行させる
  return [DISCLAIMER.ja, DISCLAIMER.en, DISCLAIMER.zh, DISCLAIMER.ko].join("\n");
}

/** ---------- API ---------- **/

async function callRag(question: string): Promise<string> {
  if (!WEBHOOK_URL) throw new Error("VITE_RAG_WEBHOOK_URL is not set.");

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error: ${res.status} ${res.statusText}\n${text}`);
  }

  const data: ApiResult = await res.json();

  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data) as { answer?: string };
      return (parsed.answer || "").trim();
    } catch {
      return data.trim();
    }
  }

  return ((data && (data as any).answer) || "").trim();
}

/** ---------- Email helpers ---------- **/

function nowStampLocal() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function clip(s: string, n: number) {
  const t = (s || "").trim();
  if (t.length <= n) return t;
  return t.slice(0, n) + "\n...(truncated)";
}

function buildEmailBody(question: string, answer: string) {
  const ts = nowStampLocal();
  const a = clip(answer, 800);

  return [
    "Hello RSJP/RWJP Office,",
    "",
    "Please fill in [1] and [3] before sending.",
    "",
    "Please help me with the question below.",
    "",
    `[Time] ${ts}`,
    "",
    "[1] Your information",
    "- Full name:",
    "- Email:",
    "- Program: (RSJP / RWJP / RSJP Express / RWJP Express / Not sure)",
    "- Campus: (OIC / Kinugasa / BKC / Not sure)",
    "",
    "[2] Your question",
    `- Question: ${question || ""}`,
    "",
    "[3] What is unclear (please write in one line)",
    "- What I still do not understand:",
    "",
    "[Urgency]",
    "- Today / This week / Not urgent",
    "",
    "[4] AI answer (for reference only)",
    `- AI answer: ${a || ""}`,
    "",
    "Thank you.",
    "",
    "----",
    "Sent from RSJP/RWJP FAQ site (MVP)",
  ].join("\n");
}

function buildMailtoUrl(question: string, answer: string) {
  const subject = "[RSJP/RWJP FAQ] Question (please confirm)";
  const body = buildEmailBody(question, answer);

  return (
    `mailto:${encodeURIComponent(OFFICE_EMAIL)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`
  );
}

/** ---------- Similarity ---------- **/

function normalizeText(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[。．，、,.;:!?()\[\]{}"“”'’\-_/\\|]/g, " ")
    .trim();
}

function hasJapaneseLike(s: string) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(s);
}

function charBigrams(s: string) {
  const t = normalizeText(s).replace(/\s/g, "");
  const grams: string[] = [];
  for (let i = 0; i < Math.max(0, t.length - 1); i++) grams.push(t.slice(i, i + 2));
  return grams;
}

function diceCoeff(a: string, b: string) {
  const A = charBigrams(a);
  const B = charBigrams(b);
  if (A.length === 0 || B.length === 0) return 0;
  const map = new Map<string, number>();
  for (const g of A) map.set(g, (map.get(g) || 0) + 1);

  let inter = 0;
  for (const g of B) {
    const c = map.get(g) || 0;
    if (c > 0) {
      inter++;
      map.set(g, c - 1);
    }
  }
  return (2 * inter) / (A.length + B.length);
}

function wordTokens(s: string) {
  const t = normalizeText(s);
  const parts = t.split(" ").filter(Boolean);
  return parts.filter((w) => w.length >= 3);
}

function jaccard(a: string, b: string) {
  const A = new Set(wordTokens(a));
  const B = new Set(wordTokens(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function similarity(input: string, candidate: string) {
  if (hasJapaneseLike(input) || hasJapaneseLike(candidate)) return diceCoeff(input, candidate);
  return jaccard(input, candidate);
}

type FaqMatch = {
  groupIdx: number;
  lang: "ja" | "en";
  bestQ: string;
  score: number;
};

function findBestStaticFaqGroup(question: string): FaqMatch | null {
  let best: FaqMatch | null = null;

  for (let gi = 0; gi < STATIC_FAQ_GROUPS.length; gi++) {
    const g = STATIC_FAQ_GROUPS[gi];

    for (const q of g.q.ja) {
      const s = similarity(question, q);
      if (!best || s > best.score) best = { groupIdx: gi, lang: "ja", bestQ: q, score: s };
    }
    for (const q of g.q.en) {
      const s = similarity(question, q);
      if (!best || s > best.score) best = { groupIdx: gi, lang: "en", bestQ: q, score: s };
    }
  }

  return best;
}

/** ---------- Cache ---------- **/

type CacheEntry = {
  k: string;
  q: string;
  a: string;
  t: number;
};

const LS_CACHE_KEY = "rsjpfaq_cache_v2";
const CACHE_MAX = 40;

function cacheKeyFromQuestion(question: string) {
  return normalizeText(question);
}

function loadCache(): CacheEntry[] {
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as CacheEntry[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.k === "string" && typeof x.q === "string" && typeof x.a === "string")
      .sort((a, b) => b.t - a.t);
  } catch {
    return [];
  }
}

function saveCache(entries: CacheEntry[]) {
  try {
    localStorage.setItem(LS_CACHE_KEY, JSON.stringify(entries.slice(0, CACHE_MAX)));
  } catch {
    // ignore
  }
}

function getCachedAnswerExact(question: string): string | null {
  const k = cacheKeyFromQuestion(question);
  if (!k) return null;
  const list = loadCache();
  const hit = list.find((x) => x.k === k);
  return hit ? hit.a : null;
}

function putCachedAnswer(question: string, answer: string) {
  const k = cacheKeyFromQuestion(question);
  const a = (answer || "").trim();
  if (!k || !a) return;

  const now = Date.now();
  const list = loadCache();
  const filtered = list.filter((x) => x.k !== k);

  const next: CacheEntry[] = [{ k, q: question.trim(), a, t: now }, ...filtered].slice(0, CACHE_MAX);
  saveCache(next);
}

function formatDateTime(ms: number) {
  try {
    const d = new Date(ms);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
  } catch {
    return "";
  }
}

type CacheSuggest = {
  entry: CacheEntry;
  score: number;
};

function findSimilarCacheSuggestion(question: string): CacheSuggest | null {
  const qq = (question || "").trim();
  if (!qq) return null;

  const isJP = hasJapaneseLike(qq);
  const qLen = qq.length;

  const list = loadCache();
  if (list.length === 0) return null;

  let best: CacheSuggest | null = null;

  for (const e of list) {
    const eIsJP = hasJapaneseLike(e.q);
    if (eIsJP !== isJP) continue;

    const eLen = (e.q || "").length;
    if (eLen === 0) continue;
    const ratio = qLen / eLen;
    if (ratio < 0.8 || ratio > 1.25) continue;

    const s = similarity(qq, e.q);
    if (!best || s > best.score) best = { entry: e, score: s };
  }

  if (!best) return null;

  const TH_JP = 0.92;
  const TH_EN = 0.85;
  const th = isJP ? TH_JP : TH_EN;

  if (best.score < th) return null;
  return best;
}

/** ---------- UI helpers ---------- **/

function Badge({ children }: { children: string }) {
  return <span className="badge">{children}</span>;
}

function PillButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="pill" onClick={onClick} type="button">
      {label}
    </button>
  );
}

export default function App() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState<string>("");

  // Static FAQ suggestion
  const [faqSuggest, setFaqSuggest] = useState<FaqMatch | null>(null);
  const [pendingAsk, setPendingAsk] = useState<string>("");

  // Cache status + safe fuzzy suggestion
  const [cacheNote, setCacheNote] = useState<string>("");
  const [cacheSuggest, setCacheSuggest] = useState<CacheSuggest | null>(null);
  const [pendingAskForCache, setPendingAskForCache] = useState<string>("");

  // Cooldown
  const [cooldownLeft, setCooldownLeft] = useState<number>(0);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = window.setInterval(() => {
      setCooldownLeft((v) => (v <= 1 ? 0 : v - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldownLeft]);

  const disclaimerText = useMemo(() => pickDisclaimerBlock(), []);
  const isBlockingDecision = Boolean(faqSuggest || cacheSuggest);

  const canAsk = q.trim().length > 0 && !loading && cooldownLeft === 0 && !isBlockingDecision;

  const startCooldown = () => setCooldownLeft(COOLDOWN_SECONDS);

  const resetResultArea = () => {
    setError("");
    setAnswer("");
    setCopied("");
    setCacheNote("");
    setFaqSuggest(null);
    setPendingAsk("");
    setCacheSuggest(null);
    setPendingAskForCache("");
  };

  const doAskAi = async (question: string) => {
    resetResultArea();

    const qq = (question || "").trim();
    if (!qq) return;

    // (A) Exact cache hit -> auto use (safe)
    const exact = getCachedAnswerExact(qq);
    if (exact) {
      setAnswer(`(Cache hit — no API call)\n\n${exact}`);
      setCacheNote("Exact cache hit (no API call).");
      return;
    }

    // (B) Fuzzy cache -> suggest ONLY (no auto)
    const sug = findSimilarCacheSuggestion(qq);
    if (sug) {
      setCacheSuggest(sug);
      setPendingAskForCache(qq);
      return;
    }

    // (C) No cache -> call API
    try {
      setLoading(true);
      const a = await callRag(qq);
      const final = a || "(No answer returned)";
      setAnswer(final);
      putCachedAnswer(qq, final);
      setCacheNote("Saved to cache.");
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const onAsk = async () => {
    const question = q.trim();
    if (!question) return;

    startCooldown();

    const best = findBestStaticFaqGroup(question);
    const THRESHOLD = 0.45;

    if (best && best.score >= THRESHOLD) {
      resetResultArea();
      setFaqSuggest(best);
      setPendingAsk(question);
      return;
    }

    await doAskAi(question);
  };

  const onUseFaq = (lang: "ja" | "en") => {
    if (!faqSuggest) return;
    const g = STATIC_FAQ_GROUPS[faqSuggest.groupIdx];
    const a = lang === "ja" ? g.a.ja : g.a.en;

    resetResultArea();
    setAnswer(`(Top FAQ — no API call)\n\n${a}`);
    setCacheNote("Top FAQ used (no API call).");
  };

  const onAskAnywayFromFaq = async () => {
    const q2 = pendingAsk || q.trim();
    setFaqSuggest(null);
    setPendingAsk("");
    await doAskAi(q2);
  };

  const onUseFuzzyCache = () => {
    if (!cacheSuggest) return;
    const e = cacheSuggest.entry;
    resetResultArea();
    setAnswer(
      `(Similar cache — NO API call)\n` +
        `Matched question: ${e.q}\n` +
        `Saved at: ${formatDateTime(e.t)}\n` +
        `Similarity: ${cacheSuggest.score.toFixed(2)}\n\n` +
        `${e.a}`
    );
    setCacheNote("Used similar cache (no API call).");
  };

  const onAskAiInstead = async () => {
    const qq = pendingAskForCache || q.trim();
    setCacheSuggest(null);
    setPendingAskForCache("");

    try {
      setLoading(true);
      const a = await callRag(qq);
      const final = a || "(No answer returned)";
      setAnswer(final);
      putCachedAnswer(qq, final);
      setCacheNote("Saved to cache.");
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const onCopyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied("Copied.");
      setTimeout(() => setCopied(""), 1300);
    } catch {
      setCopied("Copy failed.");
      setTimeout(() => setCopied(""), 1600);
    }
  };

  const onCopyEmailText = async () => {
    const pack = buildEmailBody(q.trim(), answer);
    try {
      await navigator.clipboard.writeText(pack);
      setCopied("Email text copied.");
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setCopied("Copy failed.");
      setTimeout(() => setCopied(""), 1600);
    }
  };

  const mailtoUrl = useMemo(() => buildMailtoUrl(q.trim(), answer), [q, answer]);

  const insertTemplate = (text: string) => {
    setQ(text);
    resetResultArea();
    const el = document.getElementById("ask");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const scopeNote = "RSJP / RWJP only. We cannot answer questions about other Ritsumeikan programs.";

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <div className="brandTitle">
            <span className="brandStrong">RSJP</span>
            <span className="brandSlash">/</span>
            <span className="brandStrong">RWJP</span>
            <span className="brandSub">FAQ</span>
          </div>
          <div className="brandMeta">
            <Badge>MVP</Badge>
            <span className="dot">•</span>
            <span className="muted">For international students</span>
          </div>
        </div>

        <div className="headerActions">
          <a className="btn btnGhost" href={`mailto:${OFFICE_EMAIL}`} title={`Email: ${OFFICE_EMAIL}`}>
            Email
          </a>
          <a className="btn btnPrimary" href="#ask">
            Ask a question
          </a>
        </div>
      </header>

      <div className="shell">
        {/* LEFT */}
        <div className="mainCol">
          <section className="hero">
            <div className="heroCard">
              <div className="heroTop">
                <h1 className="heroTitle">
                  Ask about <span className="em">RSJP</span> / <span className="em">RWJP</span>
                </h1>
                <p className="heroLead">
                  This site gives a quick answer using AI + internal information. Please treat it as reference only and
                  confirm the official answer with the office if needed.
                </p>

                <div className="note">
                  <span className="scopePill">{scopeNote}</span>
                </div>
              </div>

              <div id="ask" className="askCard">
                <div className="askRow">
                  <textarea
                    className="askInput"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Type your question here (日本語 / English / 中文 / 한국어)"
                    rows={4}
                  />
                  <div className="askSide">
                    <button className="btn btnPrimary btnBig btnFull" onClick={onAsk} disabled={!canAsk} type="button">
                      {loading ? "Asking..." : "Ask"}
                    </button>

                    <div className="askHint">
                      {cooldownLeft > 0 && !loading && <span className="muted">Please wait: {cooldownLeft}s</span>}
                      {isBlockingDecision && cooldownLeft === 0 && <span className="muted">Please choose an option below.</span>}
                      {!isBlockingDecision && cooldownLeft === 0 && (
                        <span className="muted">Tip: Add year / program / campus for a better answer.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {faqSuggest && (
            <div className="banner bannerInfo">
              <div className="bannerHead">
                <div className="bannerTitle">This looks like a Top FAQ (no API call).</div>
                <div className="bannerMeta">
                  Similarity: {faqSuggest.score.toFixed(2)} / Matched: “{faqSuggest.bestQ}”
                </div>
              </div>

              <div className="bannerActions">
                <button className="btn btnPrimary" onClick={() => onUseFaq("ja")} type="button">
                  Use FAQ (JP)
                </button>
                <button className="btn btnPrimary" onClick={() => onUseFaq("en")} type="button">
                  Use FAQ (EN)
                </button>
                <button className="btn btnGhost" onClick={onAskAnywayFromFaq} type="button">
                  Ask AI anyway
                </button>
              </div>
            </div>
          )}

          {cacheSuggest && (
            <div className="banner bannerSuccess">
              <div className="bannerHead">
                <div className="bannerTitle">Similar cached answer found (NOT applied automatically).</div>
                <div className="bannerMeta">
                  Similarity: {cacheSuggest.score.toFixed(2)} / Saved: {formatDateTime(cacheSuggest.entry.t)}
                </div>
              </div>

              <div className="bannerBox">
                <div className="miniTitle">Matched question (cached)</div>
                <div className="mono">{cacheSuggest.entry.q}</div>
                <div className="miniTitle mt">Cached answer (preview)</div>
                <div className="mono">{clip(cacheSuggest.entry.a, 350)}</div>
              </div>

              <div className="bannerActions">
                <button className="btn btnPrimary" onClick={onUseFuzzyCache} type="button">
                  Use cached answer
                </button>
                <button className="btn btnGhost" onClick={onAskAiInstead} type="button">
                  Ask AI instead
                </button>
                <button
                  className="btn btnGhost"
                  onClick={() => {
                    setCacheSuggest(null);
                    setPendingAskForCache("");
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="card cardDanger">
              <div className="cardTitle">Error</div>
              <pre className="mono">{error}</pre>
            </div>
          )}

          {answer && (
            <div className="card">
              <div className="cardTop">
                <div>
                  <div className="cardTitle">Answer</div>
                  {cacheNote && <div className="muted small">{cacheNote}</div>}
                </div>

                <div className="cardActions">
                  <button className="btn btnGhost" onClick={onCopyAnswer} type="button">
                    Copy answer
                  </button>
                </div>
              </div>

              <pre className="answerText">{answer}</pre>

              <div className="callout">
                <div className="calloutTitle">Not sure? Email the office.</div>
                <div className="muted">
                  This AI answer may be incomplete or not updated. For an official and final answer, please contact the RSJP/RWJP office.
                </div>

                <div className="calloutActions">
                  <a className="btn btnPrimary" href={mailtoUrl} title={`Email to: ${OFFICE_EMAIL}`}>
                    Email the office
                  </a>
                  <button className="btn btnGhost" onClick={onCopyEmailText} type="button">
                    Copy email text
                  </button>
                </div>

                {copied && <div className="toast">{copied}</div>}

                <div className="muted small mt">
                  To: <span className="monoInline">{OFFICE_EMAIL}</span>
                </div>
              </div>

              {/* Important (readable) */}
              <div className="callout calloutImportant" style={{ marginTop: 12 }}>
                <div className="calloutTitle">Important</div>
                <pre className="disclaimerText">{disclaimerText}</pre>
              </div>
            </div>
          )}

          {/* ✅ Top FAQs card is removed */}

          <footer className="footer">
            <div className="muted small">{scopeNote}</div>
            <div className="muted small">
              API: {WEBHOOK_URL ? "configured" : "VITE_RAG_WEBHOOK_URL not set"} ・ Cache: localStorage (max {CACHE_MAX}) ・ Cooldown:{" "}
              {COOLDOWN_SECONDS}s
            </div>
          </footer>
        </div>

        {/* RIGHT */}
        <aside className="sideCol">
          <div className="sideCard">
            <div className="sideTitle">Quick actions</div>
            <div className="sideButtons">
              <a className="btn btnPrimary btnFull" href="#ask">
                Ask (top)
              </a>
              <a className="btn btnGhost btnFull" href={`mailto:${OFFICE_EMAIL}`}>
                Email the office
              </a>
            </div>

            <div style={{ marginTop: 10 }} className="scopePill">
              RSJP / RWJP only
            </div>
          </div>

          <div className="sideCard">
            <div className="sideTitle">Quick questions</div>
            <div className="chips">
              {QUICK_TEMPLATES.map((sec) => (
                <div key={sec.title} className="chipGroup">
                  <div className="chipTitle">{sec.title}</div>
                  <div className="chipRow">
                    {sec.items.map((it) => (
                      <PillButton key={it.label} label={it.label} onClick={() => insertTemplate(it.text)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
