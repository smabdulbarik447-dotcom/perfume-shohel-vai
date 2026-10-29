import { ensureTables } from "@/lib/db";
import { getSettings } from "@/lib/store";
import { bdLookup } from "@/lib/bdcourier";

// Form e 11 digit number lekha holei BD Courier check shuru — order button chaapar age i fol cache e thake.
// Fol customer ke dekhai na, shudhu order neyar shomoy kaje lage.
export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (!/^01[3-9]\d{8}$/.test(body?.phone || "")) return Response.json({ ok: false }, { status: 400 });
  try {
    await ensureTables();
    const s = await getSettings();
    if (s.bdcourier_key && Number(s.bdcourier_min_ratio) > 0) await bdLookup(body.phone, s.bdcourier_key);
  } catch (err) {
    console.error("Precheck failed", err);
  }
  return Response.json({ ok: true });
}
