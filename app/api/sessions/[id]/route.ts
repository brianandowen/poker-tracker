import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const sid = Number(id);

  if (!Number.isFinite(sid)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await pool.query(`DELETE FROM poker_sessions WHERE id = $1`, [sid]);
  return NextResponse.json({ ok: true });
}