import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { isAuthed } from "@/lib/auth";

/*
  你要的賽事種類 key：
  - 限時：TIMED_1200 / TIMED_2400 ... / TIMED_21500
  - 錦標：TOUR_SNG / TOUR_HU / TOUR_OTHER
  - 現金：CASH
*/
function buildStakeCode(input: {
  session_type: "TIMED_TOURNAMENT" | "TOURNAMENT" | "CASH";
  timed_level?: number | null;
  tour_format?: "SNG" | "HU" | "OTHER" | null;
}) {
  if (input.session_type === "CASH") return "CASH";
  if (input.session_type === "TIMED_TOURNAMENT")
    return `TIMED_${input.timed_level ?? 0}`;
  const f = input.tour_format ?? "OTHER";
  return `TOUR_${f}`;
}

const CreateSchema = z.object({
  played_date: z.string(),
  venue: z.string().min(1),

  session_type: z.enum(["TIMED_TOURNAMENT", "TOURNAMENT", "CASH"]),

  stake_code: z.string().nullable().optional(),

  stake_amount: z.number().int().nullable().optional(),
  entries: z.number().int().optional(),

  cash_unit_amount: z.number().int().nullable().optional(),
  cash_units: z.number().int().nullable().optional(),

  coupon_count: z.number().int().optional(),
  coupon_value: z.number().int().optional(),
  cashout: z.number().int().optional(),
  fees: z.number().int().optional(),

  partner_share_bp: z.number().int().min(0).max(10000).optional(),
  partner_name: z.string().nullable().optional(),

  mental_state: z.string().nullable().optional(),
  note: z.string().nullable().optional(),

  tour_format: z.enum(["SNG", "HU", "OTHER"]).nullable().optional(),
  timed_level: z.number().int().nullable().optional(),
});

/* ============================= */
/* GET：永遠開放（預覽模式）      */
/* ============================= */
export async function GET() {
  const { rows } = await pool.query(
    `SELECT
        id,
        to_char(played_date, 'YYYY-MM-DD') AS played_date,
        session_no,
        venue,
        session_type,
        stake_code,

        stake_amount,
        cash_unit_amount,
        cash_units,
        entries,

        fees,
        coupon_count,
        coupon_value,
        cashout,

        partner_share_bp,
        partner_name,

        mental_state,
        note,
        created_at,
        updated_at,

        cost_raw,
        cost_net,
        partner_share,
        profit_total,
        partner_profit,
        self_profit,
        self_cost
     FROM poker_sessions_v
     ORDER BY played_date ASC, session_no ASC`
  );

  return NextResponse.json(rows);
}

/* ============================= */
/* POST：必須登入                */
/* ============================= */
export async function POST(req: Request) {
  if (!isAuthed()) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const data = CreateSchema.parse(body);

  const nextNoRes = await pool.query(
    `SELECT COALESCE(MAX(session_no), 0) + 1 AS next
     FROM poker_sessions
     WHERE played_date = $1`,
    [data.played_date]
  );
  const session_no = Number(nextNoRes.rows[0].next);

  const coupon_count = Math.max(0, data.coupon_count ?? 0);
  const coupon_value = Math.max(0, data.coupon_value ?? 0);
  const cashout = Math.max(0, data.cashout ?? 0);
  const fees = Math.max(0, data.fees ?? 0);
  const partner_share_bp = data.partner_share_bp ?? 0;

  const entries =
    data.session_type === "CASH"
      ? 1
      : Math.max(1, data.entries ?? 1);

  const stake_amount =
    data.session_type === "CASH"
      ? null
      : Math.max(0, data.stake_amount ?? 0);

  const cash_unit_amount =
    data.session_type === "CASH"
      ? Math.max(0, data.cash_unit_amount ?? 0)
      : null;

  const cash_units =
    data.session_type === "CASH"
      ? Math.max(1, data.cash_units ?? 1)
      : null;

  const stake_code =
    data.stake_code ??
    buildStakeCode({
      session_type: data.session_type,
      timed_level: data.timed_level ?? null,
      tour_format: data.tour_format ?? null,
    });

  const insert = await pool.query(
    `INSERT INTO poker_sessions (
      played_date, session_no, venue,
      session_type, stake_code,

      stake_amount, cash_unit_amount, cash_units,
      entries,

      fees, coupon_count, coupon_value, cashout,

      partner_share_bp, partner_name,
      mental_state, note
    ) VALUES (
      $1,$2,$3,
      $4,$5,
      $6,$7,$8,
      $9,
      $10,$11,$12,$13,
      $14,$15,
      $16,$17
    )
    RETURNING id`,
    [
      data.played_date,
      session_no,
      data.venue,
      data.session_type,
      stake_code,

      stake_amount,
      cash_unit_amount,
      cash_units,
      entries,

      fees,
      coupon_count,
      coupon_value,
      cashout,

      partner_share_bp,
      data.partner_name ?? null,
      data.mental_state ?? null,
      data.note ?? null,
    ]
  );

  const id = insert.rows[0].id;

  const out = await pool.query(
    `SELECT * FROM poker_sessions_v WHERE id = $1`,
    [id]
  );

  return NextResponse.json(out.rows[0] ?? null);
}