"use client";

import { useEffect, useMemo, useState } from "react";

/* 🔐 新增：登入狀態 */
function useAuth() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setAuthed(d.authed))
      .catch(() => setAuthed(false));
  }, []);

  return authed;
}


const CATEGORIES = [
  { value: "TIMED_TOURNAMENT", label: "限時錦標賽" },
  { value: "TOURNAMENT", label: "錦標賽" },
  { value: "CASH", label: "現金局" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

const TIMED_LEVELS = [1200, 2400, 3400, 6600, 11000, 21500] as const;

const TOUR_FORMATS = [
  { value: "SNG", label: "SNG" },
  { value: "HU", label: "HU" },
  { value: "OTHER", label: "其他" },
] as const;

type TourFormat = (typeof TOUR_FORMATS)[number]["value"];
type Mental = "A" | "B" | "C";


type SessionRow = {
  id: number;

  played_date: string; 
  session_no: number;

  venue: string;
  session_type: Category;
  stake_code: string | null;

  stake_amount: number | string | null;
  cash_unit_amount: number | string | null;
  cash_units: number | string | null;
  entries: number | string;

  fees: number | string;
  coupon_count: number | string;
  coupon_value: number | string;
  cashout: number | string;

  partner_share_bp: number | string;
  partner_name: string | null;

  mental_state: string | null;
  note: string | null;

  cost_raw: number | string;
  cost_net: number | string;
  partner_share: number | string;
  profit_total: number | string;
  partner_profit: number | string;
  self_profit: number | string;
  self_cost: number | string;
};

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const inputCls =
  "w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600";

function toNum(v: any) {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function toInt(v: any) {
  return Math.trunc(toNum(v));
}
function fmtMoneySigned(n: number) {
  const sign = n >= 0 ? "+" : "";
  return sign + Math.round(n).toLocaleString("en-US");
}
function fmtMoneyPlain(n: number) {
  return Math.round(n).toLocaleString("en-US");
}
function fmtPct(x: number) {
  if (!Number.isFinite(x)) return "—";
  return (x * 100).toFixed(1) + "%";
}
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseYmd(s: string) {
  const [yy, mm, dd] = s.split("-").map((x) => Number(x));
  return new Date(yy, (mm || 1) - 1, dd || 1);
}
function startOfWeekMonday(d: Date) {
  const day = d.getDay(); 
  const diff = (day + 6) % 7; 
  const x = new Date(d);
  x.setDate(d.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function eventLabelOf(key: string) {
  if (key === "CASH") return "現金局";
  if (key.startsWith("TIMED_")) return `限時錦標賽 ${key.replace("TIMED_", "")}`;
  if (key === "TOUR_SNG") return "錦標賽 SNG";
  if (key === "TOUR_HU") return "錦標賽 HU";
  if (key === "TOUR_OTHER") return "錦標賽 其他";
  return key;
}

function eventKeyOf(input: { category: Category; timedLevel?: number; tourFormat?: TourFormat }) {
  if (input.category === "CASH") return "CASH";
  if (input.category === "TIMED_TOURNAMENT") return `TIMED_${input.timedLevel ?? 0}`;
  return `TOUR_${input.tourFormat ?? "OTHER"}`;
}

function safeDateMinusDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() - days);
  return d;
}

export default function Page() {
  const authed = useAuth();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const res = await fetch("/api/sessions", { cache: "no-store" });
    if (!res.ok) {
      const t = await res.text();
      setLoading(false);
      alert("讀取失敗：" + t);
      return;
    }
    const data = (await res.json()) as SessionRow[];
    setRows(data);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const today = useMemo(() => new Date(), []);
  const [addDate, setAddDate] = useState<string>(ymd(today));

  const [form, setForm] = useState({
    venue: "藝文city",
    category: "TIMED_TOURNAMENT" as Category,

    timed_level: 1200 as (typeof TIMED_LEVELS)[number],

    tour_format: "SNG" as TourFormat,
    tournament_buyin: "1200",

    cash_unit_amount: "1000",
    cash_units: "1",

    entries: "1",
    coupon_count: "0",
    coupon_value: "0",
    fees: "0",
    cashout: "0",

    partner_share_percent: "0",
    partner_name: "",

    mental_state: "A" as Mental,
    note: "",
  });

  const stakeAmountSingle = useMemo(() => {
    if (form.category === "TIMED_TOURNAMENT") return form.timed_level;
    if (form.category === "TOURNAMENT") return Math.max(0, toInt(form.tournament_buyin));
    return 0;
  }, [form.category, form.timed_level, form.tournament_buyin]);

  async function createSession() {
    if (!form.venue.trim()) return alert("請輸入地點");
    if (!addDate) return alert("請選日期");

    const coupon_count = Math.max(0, toInt(form.coupon_count));
    const coupon_value = Math.max(0, toInt(form.coupon_value));
    const cashout = Math.max(0, toInt(form.cashout));
    const fees = Math.max(0, toInt(form.fees));


    const pct = clamp(toNum(form.partner_share_percent), 0, 100);
    const partner_share_bp = Math.round(pct * 100);

    const payload: any = {
      played_date: addDate, 
      venue: form.venue.trim(),
      session_type: form.category,

      coupon_count,
      coupon_value,
      cashout,
      fees,

      partner_share_bp,
      partner_name: form.partner_name.trim() ? form.partner_name.trim() : null,

      mental_state: form.mental_state,
      note: form.note.trim() || null,
    };

    payload.stake_code = eventKeyOf({
      category: form.category,
      timedLevel: form.category === "TIMED_TOURNAMENT" ? form.timed_level : undefined,
      tourFormat: form.category === "TOURNAMENT" ? form.tour_format : undefined,
    });

    if (form.category === "CASH") {
      payload.cash_unit_amount = Math.max(0, toInt(form.cash_unit_amount));
      payload.cash_units = Math.max(1, toInt(form.cash_units));

      payload.stake_amount = null;
      payload.entries = 1;
    } else {
      payload.stake_amount = stakeAmountSingle;
      payload.entries = Math.max(1, toInt(form.entries));

      payload.cash_unit_amount = null;
      payload.cash_units = null;

      if (form.category === "TOURNAMENT") payload.tour_format = form.tour_format;
      if (form.category === "TIMED_TOURNAMENT") payload.timed_level = form.timed_level;
    }

    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const t = await res.text();
      return alert("新增失敗：" + t);
    }

    setForm((f) => ({
      ...f,
      coupon_count: "0",
      coupon_value: "0",
      fees: "0",
      cashout: "0",
      note: "",
    }));

    await refresh();
  }

  async function deleteSession(id: number) {
    if (!confirm("確定刪除這一筆？")) return;
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const t = await res.text();
      return alert("刪除失敗：" + t);
    }
    await refresh();
  }

const [fromDate, setFromDate] = useState<string>("2000-01-01");
const [toDate, setToDate] = useState<string>("2100-12-31");

  const [fCategory, setFCategory] = useState<"ALL" | Category>("ALL");
  const [fVenue, setFVenue] = useState<string>("ALL");
  const [fMental, setFMental] = useState<"ALL" | Mental>("ALL");
  const [fEventKey, setFEventKey] = useState<string>("ALL");

  const venues = useMemo(() => {
    const s = new Set(rows.map((r) => r.venue).filter(Boolean));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const eventKeys = useMemo(() => {
    const s = new Set(rows.map((r) => r.stake_code || "UNKNOWN").filter(Boolean));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows
      .slice()
      .sort((a, b) => {
        if (a.played_date !== b.played_date) return a.played_date.localeCompare(b.played_date);
        return (a.session_no ?? 0) - (b.session_no ?? 0);
      })
      .filter((r) => {
        if (r.played_date < fromDate || r.played_date > toDate) return false;
        if (fCategory !== "ALL" && r.session_type !== fCategory) return false;
        if (fVenue !== "ALL" && r.venue !== fVenue) return false;
        if (fMental !== "ALL" && (r.mental_state ?? "") !== fMental) return false;

        const key = r.stake_code || "UNKNOWN";
        if (fEventKey !== "ALL" && key !== fEventKey) return false;

        return true;
      });
  }, [rows, fromDate, toDate, fCategory, fVenue, fMental, fEventKey]);

  const stats = useMemo(() => {
    const count = filtered.length;

    const totalSelfProfit = filtered.reduce((a, r) => a + toNum(r.self_profit), 0);
    const totalSelfCost = filtered.reduce((a, r) => a + toNum(r.self_cost), 0);

    const roi = totalSelfCost ? totalSelfProfit / totalSelfCost : NaN;

    let grossWin = 0;
    let grossLoss = 0;

    let cum = 0;
    let peak = 0;
    let maxDD = 0;

    const curve: number[] = [];
    const drawdown: number[] = [];
    const perSession: number[] = [];
    const labels: string[] = [];

    let maxDDIndex = -1;

    for (let i = 0; i < filtered.length; i++) {
      const r = filtered[i];
      const p = toNum(r.self_profit);
      perSession.push(p);

      if (p > 0) grossWin += p;
      if (p < 0) grossLoss += Math.abs(p);

      cum += p;
      curve.push(cum);

      peak = Math.max(peak, cum);
      const dd = peak - cum;
      drawdown.push(dd);

      if (dd >= maxDD) {
        maxDD = dd;
        maxDDIndex = i;
      }

      labels.push(`${r.played_date} #${r.session_no}`);
    }

    const pf = grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : NaN;

    const lastValue = curve.length ? curve[curve.length - 1] : 0;

    return {
      count,
      totalSelfProfit,
      totalSelfCost,
      roi,
      pf,
      maxDD,
      maxDDIndex,
      curve,
      drawdown,
      perSession,
      labels,
      lastValue,
    };
  }, [filtered]);

  const byEvent = useMemo(() => {
    const m = new Map<
      string,
      { key: string; label: string; n: number; selfProfit: number; selfCost: number }
    >();

    for (const r of filtered) {
      const key = r.stake_code || "UNKNOWN";
      const label = eventLabelOf(key);
      if (!m.has(key)) m.set(key, { key, label, n: 0, selfProfit: 0, selfCost: 0 });

      const item = m.get(key)!;
      item.n += 1;
      item.selfProfit += toNum(r.self_profit);
      item.selfCost += toNum(r.self_cost);
    }

    const arr = Array.from(m.values()).map((x) => ({
      ...x,
      roi: x.selfCost ? x.selfProfit / x.selfCost : NaN,
      avg: x.n ? x.selfProfit / x.n : NaN,
    }));

    const roiRank = arr
      .slice()
      .sort((a, b) => {
        const ar = Number.isFinite(a.roi) ? a.roi : -999;
        const br = Number.isFinite(b.roi) ? b.roi : -999;
        return br - ar;
      });

    const profitRank = arr.slice().sort((a, b) => b.selfProfit - a.selfProfit);

    return { arr, roiRank, profitRank };
  }, [filtered]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
  <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
    <div>
      <h1 className="text-lg font-semibold tracking-tight">Poker Tracker</h1>
    </div>

    <div className="flex items-center gap-3">
      <button
        className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm hover:border-neutral-600"
        onClick={refresh}
      >
        重新整理
      </button>

      {authed === false && (
        <a
          href="/login"
          className="rounded-lg border border-neutral-700 bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-white"
        >
          Login
        </a>
      )}

      {authed === true && (
        <>
          <span className="text-xs text-neutral-400">已登入</span>
          <button
            className="rounded-lg border border-neutral-700 bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-white"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              location.reload();
            }}
          >
            Logout
          </button>
        </>
      )}
    </div>
  </div>
</header>

      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* KPI */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Kpi
            label="總盈虧（你）"
            value={fmtMoneySigned(stats.totalSelfProfit)}
            tone={stats.totalSelfProfit >= 0 ? "good" : "bad"}
          />
          <Kpi label="總投入（你）" value={fmtMoneyPlain(stats.totalSelfCost)} />
          <Kpi label="ROI" value={fmtPct(stats.roi)} />
          <Kpi
            label="盈虧比（PF）"
            value={Number.isFinite(stats.pf) ? (stats.pf === Infinity ? "∞" : stats.pf.toFixed(2)) : "—"}
          />
          <Kpi label="最大回撤" value={fmtMoneyPlain(stats.maxDD)} />
        </section>

        {/* Add + Filters */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Add */}
          {authed && (
            <div className="lg:col-span-2 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">新增一場</div>
              <div className="text-xs text-neutral-400">日期：{addDate}</div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="日期（點選）">
                <CalendarPicker value={addDate} onChange={setAddDate} />
              </Field>

              <Field label="地點">
                <input
                  className={inputCls}
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                />
              </Field>

              <Field label="類型">
                <select
                  className={inputCls}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
                >
                  {CATEGORIES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="心態">
                <select
                  className={inputCls}
                  value={form.mental_state}
                  onChange={(e) => setForm({ ...form, mental_state: e.target.value as Mental })}
                >
                  <option value="A">A-game</option>
                  <option value="B">B-game</option>
                  <option value="C">C-game</option>
                </select>
              </Field>

              {/* 限時 */}
              {form.category === "TIMED_TOURNAMENT" && (
                <>
                  <Field label="限時級別">
                    <select
                      className={inputCls}
                      value={form.timed_level}
                      onChange={(e) =>
                        setForm({ ...form, timed_level: Number(e.target.value) as any })
                      }
                    >
                      {TIMED_LEVELS.map((lv) => (
                        <option key={lv} value={lv}>
                          {lv}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="買入次數（entries）">
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      value={form.entries}
                      onChange={(e) => setForm({ ...form, entries: e.target.value })}
                    />
                  </Field>
                </>
              )}

              {/* 錦標 */}
              {form.category === "TOURNAMENT" && (
                <>
                  <Field label="錦標賽類別">
                    <select
                      className={inputCls}
                      value={form.tour_format}
                      onChange={(e) =>
                        setForm({ ...form, tour_format: e.target.value as TourFormat })
                      }
                    >
                      {TOUR_FORMATS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="報名費（單次）">
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      value={form.tournament_buyin}
                      onChange={(e) =>
                        setForm({ ...form, tournament_buyin: e.target.value })
                      }
                    />
                  </Field>

                  <Field label="買入次數（entries）">
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      value={form.entries}
                      onChange={(e) => setForm({ ...form, entries: e.target.value })}
                    />
                  </Field>

                  <div className="hidden sm:block" />
                </>
              )}

              {/* 現金局 */}
              {form.category === "CASH" && (
                <>
                  <Field label="一組金額">
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      value={form.cash_unit_amount}
                      onChange={(e) =>
                        setForm({ ...form, cash_unit_amount: e.target.value })
                      }
                    />
                  </Field>

                  <Field label="買入幾組">
                    <input
                      className={inputCls}
                      inputMode="numeric"
                      value={form.cash_units}
                      onChange={(e) => setForm({ ...form, cash_units: e.target.value })}
                    />
                  </Field>
                </>
              )}

              <Field label="回收（cashout）">
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={form.cashout}
                  onChange={(e) => setForm({ ...form, cashout: e.target.value })}
                />
              </Field>

              <Field label="折價券（次數 / 面額）">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={inputCls}
                    inputMode="numeric"
                    placeholder="次數"
                    value={form.coupon_count}
                    onChange={(e) => setForm({ ...form, coupon_count: e.target.value })}
                  />
                  <input
                    className={inputCls}
                    inputMode="numeric"
                    placeholder="面額"
                    value={form.coupon_value}
                    onChange={(e) => setForm({ ...form, coupon_value: e.target.value })}
                  />
                </div>
              </Field>

              <Field label="其他費用（fees）">
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={form.fees}
                  onChange={(e) => setForm({ ...form, fees: e.target.value })}
                />
              </Field>

              <Field label="站人佔比（%）">
                <input
                  className={inputCls}
                  inputMode="decimal"
                  value={form.partner_share_percent}
                  onChange={(e) =>
                    setForm({ ...form, partner_share_percent: e.target.value })
                  }
                  placeholder="例如 31.25"
                />
              </Field>

              <Field label="站人名稱（可空）">
                <input
                  className={inputCls}
                  value={form.partner_name}
                  onChange={(e) => setForm({ ...form, partner_name: e.target.value })}
                />
              </Field>

              <Field label="備註">
                <input
                  className={inputCls}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </Field>

              <div className="sm:col-span-2 flex items-center justify-between gap-3">

                <button
                  className="rounded-lg border border-neutral-700 bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-white"
                  onClick={createSession}
                >
                  新增
                </button>
              </div>
            </div>
          </div>
)}
          {/* Filters */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">篩選</div>
              <div className="text-xs text-neutral-400">筆數：{stats.count}</div>
            </div>

            <div className="mt-3 space-y-3">
              <Field label="日期區間（From）">
                <CalendarPicker value={fromDate} onChange={setFromDate} />
              </Field>

              <Field label="日期區間（To）">
                <CalendarPicker value={toDate} onChange={setToDate} />
              </Field>

              <Field label="類型">
                <select
                  className={inputCls}
                  value={fCategory}
                  onChange={(e) => setFCategory(e.target.value as any)}
                >
                  <option value="ALL">全部</option>
                  {CATEGORIES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="賽事種類">
                <select
                  className={inputCls}
                  value={fEventKey}
                  onChange={(e) => setFEventKey(e.target.value)}
                >
                  <option value="ALL">全部</option>
                  {eventKeys.map((k) => (
                    <option key={k} value={k}>
                      {eventLabelOf(k)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="地點">
                <select
                  className={inputCls}
                  value={fVenue}
                  onChange={(e) => setFVenue(e.target.value)}
                >
                  <option value="ALL">全部</option>
                  {venues.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="心態">
                <select
                  className={inputCls}
                  value={fMental}
                  onChange={(e) => setFMental(e.target.value as any)}
                >
                  <option value="ALL">全部</option>
                  <option value="A">A-game</option>
                  <option value="B">B-game</option>
                  <option value="C">C-game</option>
                </select>
              </Field>

              <button
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm hover:border-neutral-600"
                onClick={() => {
                  setFromDate(ymd(safeDateMinusDays(today, 90)));
                  setToDate(ymd(today));
                  setFCategory("ALL");
                  setFEventKey("ALL");
                  setFVenue("ALL");
                  setFMental("ALL");
                }}
              >
                清除篩選
              </button>


            </div>
          </div>
        </section>

        {/* Charts row */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <div className="text-sm font-semibold">1) 累積盈虧曲線</div>
            <div className="text-xs text-neutral-400 mt-1">
              X 軸：場次時間順序　Y 軸：累積盈虧
            </div>
            <div className="mt-3">
              <LineChart
                series={stats.curve}
                height={240}
                label="累積盈虧（你）"
                labels={stats.labels}
                markLast
                markIndex={stats.maxDDIndex >= 0 ? stats.maxDDIndex : undefined}
                markText={stats.maxDDIndex >= 0 ? `最大回撤點` : undefined}
              />
            </div>
            <div className="text-xs text-neutral-500 mt-2">水平線為損益平衡點（0）。</div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <div className="text-sm font-semibold">2) 每場盈虧</div>
            <div className="text-xs text-neutral-400 mt-1">
              X 軸：場次順序　Y 軸：單場盈虧
            </div>
            <div className="mt-3">
              <BarChart values={stats.perSession} height={240} />
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <div className="text-sm font-semibold">3) 回撤（Drawdown）</div>
            <div className="text-xs text-neutral-400 mt-1">
              X 軸：場次順序　Y 軸：距離歷史高點的下跌幅度
            </div>
            <div className="mt-3">
              <LineChart
                series={stats.drawdown}
                height={240}
                zeroAtBottom
                label="回撤（你）"
                labels={stats.labels}
                markIndex={stats.maxDDIndex >= 0 ? stats.maxDDIndex : undefined}
                markText={stats.maxDDIndex >= 0 ? `最大回撤 ${fmtMoneyPlain(stats.maxDD)}` : undefined}
              />
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <div className="text-sm font-semibold">4) 賽事 ROI 排名</div>
            <div className="text-xs text-neutral-400 mt-1">
              以 self_profit / self_cost 計算
            </div>
            <div className="mt-3 space-y-2">
              {byEvent.roiRank.map((x) => (
                <div
                  key={x.key}
                  className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-neutral-200 truncate">{x.label}</div>
                    <div className="text-xs text-neutral-500">
                      樣本 {x.n}｜平均 {Number.isFinite(x.avg) ? fmtMoneySigned(x.avg) : "—"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={cls(
                        "text-sm font-semibold",
                        x.selfProfit >= 0 ? "text-emerald-200" : "text-rose-200"
                      )}
                    >
                      {fmtMoneySigned(x.selfProfit)}
                    </div>
                    <div className="text-xs text-neutral-500">ROI {fmtPct(x.roi)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
            <div className="text-sm font-semibold">5) 賽事總盈虧</div>
            <div className="text-xs text-neutral-400 mt-1">
              依總盈虧排序，用來判斷主戰賽事與避開賽事。
            </div>
            <div className="mt-3">
              <BarRank
                items={byEvent.profitRank.map((x) => ({
                  label: x.label,
                  value: x.selfProfit,
                }))}
                height={240}
              />
            </div>
          </div>
        </section>

        {/* Table */}
        <section className="rounded-xl border border-neutral-800 bg-neutral-900/40">
          <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
            <div className="text-sm font-semibold">場次列表</div>
            <div className="text-xs text-neutral-400">
              {loading ? "讀取中" : `顯示 ${filtered.length} / ${rows.length}`}
            </div>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-sm text-neutral-400">讀取中</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-neutral-400">目前篩選條件沒有資料。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1500px] w-full text-sm">
                <thead className="text-neutral-400">
                  <tr className="border-b border-neutral-800">
                    <th className="px-4 py-3 text-left font-medium">日期</th>
                    <th className="px-4 py-3 text-right font-medium">序</th>
                    <th className="px-4 py-3 text-left font-medium">賽事</th>
                    <th className="px-4 py-3 text-left font-medium">地點</th>
                    <th className="px-4 py-3 text-left font-medium">結構</th>
                    <th className="px-4 py-3 text-left font-medium">心態</th>

                    <th className="px-4 py-3 text-right font-medium">佔比</th>
                    <th className="px-4 py-3 text-right font-medium">你成本</th>
                    <th className="px-4 py-3 text-right font-medium">回收</th>

                    <th className="px-4 py-3 text-right font-medium">總盈虧</th>
                    <th className="px-4 py-3 text-right font-medium">朋友盈虧</th>
                    <th className="px-4 py-3 text-right font-medium">你盈虧</th>

                    <th className="px-4 py-3 text-left font-medium">備註</th>
                    <th className="px-4 py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((r) => {
                    const evKey = r.stake_code || "UNKNOWN";
                    const evLabel = eventLabelOf(evKey);

                    const structure =
                      r.session_type === "CASH"
                        ? `unit ${toInt(r.cash_unit_amount)} × ${toInt(r.cash_units)}`
                        : `${toInt(r.stake_amount)} × entries ${toInt(r.entries)}`;

                    const share = toNum(r.partner_share); 
                    const shareText = fmtPct(share);

                    const selfCost = toNum(r.self_cost);
                    const cashout = toNum(r.cashout);

                    const profitTotal = toNum(r.profit_total);
                    const partnerProfit = toNum(r.partner_profit);
                    const selfProfit = toNum(r.self_profit);

                    return (
                      <tr
                        key={r.id}
                        className="border-b border-neutral-900 hover:bg-neutral-900/60"
                      >
                        <td className="px-4 py-3 text-left text-neutral-200">{r.played_date}</td>
                        <td className="px-4 py-3 text-right text-neutral-200">{r.session_no}</td>

                        <td className="px-4 py-3 text-left text-neutral-200">{evLabel}</td>
                        <td className="px-4 py-3 text-left text-neutral-200">{r.venue}</td>
                        <td className="px-4 py-3 text-left text-neutral-200">{structure}</td>
                        <td className="px-4 py-3 text-left text-neutral-200">{r.mental_state ?? ""}</td>

                        <td className="px-4 py-3 text-right text-neutral-200">{shareText}</td>
                        <td className="px-4 py-3 text-right text-neutral-200">{fmtMoneyPlain(selfCost)}</td>
                        <td className="px-4 py-3 text-right text-neutral-200">{fmtMoneyPlain(cashout)}</td>

                        <td
                          className={cls(
                            "px-4 py-3 text-right font-semibold",
                            profitTotal >= 0 ? "text-emerald-200" : "text-rose-200"
                          )}
                        >
                          {fmtMoneySigned(profitTotal)}
                        </td>
                        <td
                          className={cls(
                            "px-4 py-3 text-right font-semibold",
                            partnerProfit >= 0 ? "text-emerald-200" : "text-rose-200"
                          )}
                        >
                          {fmtMoneySigned(partnerProfit)}
                        </td>
                        <td
                          className={cls(
                            "px-4 py-3 text-right font-semibold",
                            selfProfit >= 0 ? "text-emerald-200" : "text-rose-200"
                          )}
                        >
                          {fmtMoneySigned(selfProfit)}
                        </td>

                        <td className="px-4 py-3 text-left text-neutral-300">{r.note ?? ""}</td>

                        <td className="px-4 py-3 text-right">
                          {authed && (
                          <button
                            className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs hover:border-neutral-600"
                            onClick={() => deleteSession(r.id)}
                          >
                            刪除
                          </button>  )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="px-4 py-3 text-xs text-neutral-500">
                ROI 與曲線以 self_profit / self_cost 計算。profit_total / partner_profit 用於核對站人結算。
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-neutral-400">{props.label}</div>
      <div className="mt-1">{props.children}</div>
    </div>
  );
}

function Kpi(props: { label: string; value: string; tone?: "good" | "bad" }) {
  const tone =
    props.tone === "good"
      ? "text-emerald-200"
      : props.tone === "bad"
      ? "text-rose-200"
      : "text-neutral-100";

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-xs text-neutral-400">{props.label}</div>
      <div className={cls("mt-2 text-2xl font-semibold tracking-tight", tone)}>{props.value}</div>
    </div>
  );
}


function CalendarPicker(props: { value: string; onChange: (ymd: string) => void }) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => parseYmd(props.value), [props.value]);
  const [cursor, setCursor] = useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1));

  useEffect(() => {
    setCursor(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [props.value]);

  const monthTitle = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;

  const grid = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeekMonday(firstOfMonth);

    const cells: Array<{ date: Date; inMonth: boolean; ymd: string }> = [];
    for (let i = 0; i < 42; i++) {
      const d = addDays(start, i);
      const inMonth = d.getMonth() === cursor.getMonth();
      cells.push({ date: d, inMonth, ymd: ymd(d) });
    }
    return cells;
  }, [cursor]);

  return (
    <div className="relative">
      <button
        type="button"
        className={cls(inputCls, "text-left flex items-center justify-between", open && "border-neutral-600")}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{props.value}</span>
        <span className="text-neutral-500 text-xs">選擇</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-[320px] rounded-xl border border-neutral-800 bg-neutral-950 p-3 shadow-xl">
          <div className="flex items-center justify-between">
            <button
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs hover:border-neutral-600"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              上月
            </button>

            <div className="text-sm text-neutral-200">{monthTitle}</div>

            <button
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs hover:border-neutral-600"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              下月
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-xs text-neutral-500">
            {["一", "二", "三", "四", "五", "六", "日"].map((x) => (
              <div key={x} className="px-2 py-1 text-center">
                {x}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((c) => {
              const isSel = c.ymd === props.value;
              const isToday = c.ymd === ymd(new Date());
              return (
                <button
                  key={c.ymd}
                  className={cls(
                    "rounded-lg px-2 py-2 text-sm text-center border",
                    c.inMonth ? "border-neutral-900 text-neutral-200" : "border-neutral-950 text-neutral-600",
                    isToday && "border-neutral-700",
                    isSel && "border-neutral-200 text-neutral-50"
                  )}
                  onClick={() => {
                    props.onChange(c.ymd);
                    setOpen(false);
                  }}
                >
                  {c.date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs hover:border-neutral-600"
              onClick={() => {
                props.onChange(ymd(new Date()));
                setOpen(false);
              }}
            >
              今天
            </button>

            <button
              className="rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs hover:border-neutral-600"
              onClick={() => setOpen(false)}
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/*
  折線圖（SVG）
  需求：一定要有圖例與軸說明，避免只有一條線看不懂
  - series 先清洗避免 NaN
  - 顯示 0 軸
  - 顯示 Y 軸刻度（min / 0 / max）
  - 顯示 X 軸提示（起點 / 終點）
  - 可標最後一點與指定 index（例如最大回撤點）
*/
function LineChart(props: {
  series: Array<number | string | null | undefined>;
  height: number;
  zeroAtBottom?: boolean;
  label: string;
  labels?: string[];
  markLast?: boolean;
  markIndex?: number;
  markText?: string;
}) {
  const w = 980;
  const h = props.height;
  const padL = 54;
  const padR = 20;
  const padT = 22;
  const padB = 28;

  const ys = (props.series ?? [])
    .map((v) => {
      const n = typeof v === "number" ? v : v == null ? NaN : Number(v);
      return Number.isFinite(n) ? n : NaN;
    })
    .filter((n) => !Number.isNaN(n));

  const N = ys.length;

  if (N === 0) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-8 text-sm text-neutral-400">
        目前沒有資料。
      </div>
    );
  }

  const minY = props.zeroAtBottom ? 0 : Math.min(...ys, 0);
  const maxY = Math.max(...ys, 0);
  const range = maxY - minY || 1;

  const xScale = (i: number) => padL + (i / Math.max(1, N - 1)) * (w - padL - padR);
  const yScale = (y: number) => padT + ((maxY - y) / range) * (h - padT - padB);

  const d = ys
    .map((y, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(2)} ${yScale(y).toFixed(2)}`)
    .join(" ");

  const zeroY = yScale(0);

  const tickMin = minY;
  const tickMid = 0;
  const tickMax = maxY;

  const markIndex = props.markIndex ?? -1;
  const hasMark = markIndex >= 0 && markIndex < N;

  const lastIndex = N - 1;
  const lastX = xScale(lastIndex);
  const lastY = yScale(ys[lastIndex]);

  const mkX = hasMark ? xScale(markIndex) : 0;
  const mkY = hasMark ? yScale(ys[markIndex]) : 0;

  const startLabel = props.labels?.[0] ?? "起點";
  const endLabel = props.labels?.[lastIndex] ?? "終點";

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 overflow-x-auto">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* 背景座標線 */}
        <line x1={padL} y1={yScale(tickMax)} x2={w - padR} y2={yScale(tickMax)} stroke="rgba(255,255,255,0.08)" />
        <line x1={padL} y1={yScale(tickMid)} x2={w - padR} y2={yScale(tickMid)} stroke="rgba(255,255,255,0.18)" />
        <line x1={padL} y1={yScale(tickMin)} x2={w - padR} y2={yScale(tickMin)} stroke="rgba(255,255,255,0.08)" />

        {/* 0 軸（損益平衡） */}
        <line x1={padL} y1={zeroY} x2={w - padR} y2={zeroY} stroke="rgba(255,255,255,0.22)" strokeWidth="1" />

        {/* 曲線 */}
        <path d={d} fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="2" />

        {/* 右上角圖例（固定文字，不靠 hover） */}
        <text
          x={w - padR}
          y={padT}
          textAnchor="end"
          fill="rgba(255,255,255,0.70)"
          fontSize="12"
        >
          {props.label}
        </text>

        {/* Y 軸刻度文字 */}
        <text x={padL - 8} y={yScale(tickMax) + 4} textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize="11">
          {fmtMoneyPlain(tickMax)}
        </text>
        <text x={padL - 8} y={yScale(tickMid) + 4} textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize="11">
          0
        </text>
        <text x={padL - 8} y={yScale(tickMin) + 4} textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize="11">
          {fmtMoneyPlain(tickMin)}
        </text>

        {/* X 軸起點/終點 */}
        <text x={padL} y={h - 10} textAnchor="start" fill="rgba(255,255,255,0.45)" fontSize="11">
          {startLabel}
        </text>
        <text x={w - padR} y={h - 10} textAnchor="end" fill="rgba(255,255,255,0.45)" fontSize="11">
          {endLabel}
        </text>

        {/* 最後一點標記 */}
        {props.markLast && (
          <g>
            <circle cx={lastX} cy={lastY} r="4" fill="rgba(255,255,255,0.95)" />
            <text
              x={lastX - 8}
              y={lastY - 10}
              textAnchor="end"
              fill="rgba(255,255,255,0.70)"
              fontSize="11"
            >
              {fmtMoneySigned(ys[lastIndex])}
            </text>
          </g>
        )}

        {/* 指定點標記（例如最大回撤點） */}
        {hasMark && (
          <g>
            <circle cx={mkX} cy={mkY} r="4" fill="rgba(255,255,255,0.65)" />
            {props.markText && (
              <text x={mkX + 8} y={mkY - 10} textAnchor="start" fill="rgba(255,255,255,0.65)" fontSize="11">
                {props.markText}
              </text>
            )}
          </g>
        )}
      </svg>

      <div className="mt-2 text-xs text-neutral-500">
        X 軸為場次順序，Y 軸為金額（元）。線條已依你的站人佔比分攤後計算。
      </div>
    </div>
  );
}

function BarChart(props: { values: number[]; height: number }) {
  const w = 980;
  const h = props.height;
  const padL = 54;
  const padR = 20;
  const padT = 16;
  const padB = 22;

  if (!props.values.length) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-8 text-sm text-neutral-400">
        目前沒有資料。
      </div>
    );
  }

  const vs = props.values.map((v) => (Number.isFinite(v) ? v : 0));
  const minV = Math.min(...vs, 0);
  const maxV = Math.max(...vs, 0);
  const range = maxV - minV || 1;

  const yScale = (v: number) => padT + ((maxV - v) / range) * (h - padT - padB);
  const zeroY = yScale(0);

  const n = Math.min(vs.length, 120);
  const slice = vs.slice(Math.max(0, vs.length - n));
  const barW = (w - padL - padR) / n;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 overflow-x-auto">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* 0 軸 */}
        <line x1={padL} y1={zeroY} x2={w - padR} y2={zeroY} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

        {/* Y 刻度（max / 0 / min） */}
        <text x={padL - 8} y={yScale(maxV) + 4} textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize="11">
          {fmtMoneyPlain(maxV)}
        </text>
        <text x={padL - 8} y={yScale(0) + 4} textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize="11">
          0
        </text>
        <text x={padL - 8} y={yScale(minV) + 4} textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize="11">
          {fmtMoneyPlain(minV)}
        </text>

        {/* 柱狀 */}
        {slice.map((v, i) => {
          const x = padL + i * barW + 1;
          const y0 = yScale(0);
          const yv = yScale(v);
          const height = Math.max(1, Math.abs(y0 - yv));
          const isPos = v >= 0;
          return (
            <rect
              key={i}
              x={x}
              y={isPos ? yv : y0}
              width={Math.max(1, barW - 2)}
              height={height}
              fill={isPos ? "rgba(16,185,129,0.75)" : "rgba(244,63,94,0.75)"}
            />
          );
        })}
      </svg>
      <div className="mt-2 text-xs text-neutral-500">顯示最近 {Math.min(props.values.length, 120)} 場。</div>
    </div>
  );
}

function BarRank(props: { items: Array<{ label: string; value: number }>; height: number }) {
  const w = 980;
  const h = props.height;
  const padL = 16;
  const padR = 16;
  const padT = 14;
  const padB = 14;

  if (!props.items.length) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-8 text-sm text-neutral-400">
        目前沒有資料。
      </div>
    );
  }

  const items = props.items.slice(0, 8);
  const maxAbs = Math.max(...items.map((x) => Math.abs(x.value)), 1);

  const rowH = (h - padT - padB) / items.length;
  const mid = padL + (w - padL - padR) / 2;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 overflow-x-auto">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <line x1={mid} y1={padT} x2={mid} y2={h - padB} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
        {items.map((it, i) => {
          const y = padT + i * rowH + rowH * 0.2;
          const barH = rowH * 0.6;
          const len = ((w - padL - padR) / 2) * (Math.abs(it.value) / maxAbs);
          const isPos = it.value >= 0;

          const x = isPos ? mid : mid - len;
          return (
            <g key={it.label}>
              <text x={padL} y={y + barH * 0.75} fill="rgba(255,255,255,0.7)" fontSize="12">
                {it.label}
              </text>
              <rect
                x={x}
                y={y}
                width={Math.max(2, len)}
                height={barH}
                fill={isPos ? "rgba(16,185,129,0.75)" : "rgba(244,63,94,0.75)"}
              />
              <text
                x={w - padR}
                y={y + barH * 0.75}
                fill="rgba(255,255,255,0.7)"
                fontSize="12"
                textAnchor="end"
              >
                {fmtMoneySigned(it.value)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 text-xs text-neutral-500">以你本人（self_profit）統計。</div>
    </div>
  );
}