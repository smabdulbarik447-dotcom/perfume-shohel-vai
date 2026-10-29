import { sql } from "./db";
import { getSettings } from "./store";

// BD Courier (bdcourier.com): customer er number e shob courier mile koto parcel delivered/cancel — fake order dhorte
export async function checkPhone(phone, key) {
  const res = await fetch(`https://api.bdcourier.com/courier-check?phone=${encodeURIComponent(phone)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    // Customer order button chepe wait kore — beshi deri hole check bad diye order nei
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== "success") throw new Error(data?.error || data?.message || `BD Courier ${res.status}`);
  const { summary = {}, ...rest } = data.data || {};
  return {
    total: summary.total_parcel || 0,
    success: summary.success_parcel || 0,
    cancelled: summary.cancelled_parcel || 0,
    ratio: bdRatio({ total: summary.total_parcel, success: summary.success_parcel }),
    // Shudhu je courier e parcel ache
    couriers: Object.values(rest)
      .filter((c) => c?.total_parcel > 0)
      .map((c) => ({ name: c.name, total: c.total_parcel, success: c.success_parcel, cancelled: c.cancelled_parcel })),
    reports: Array.isArray(data.reports) ? data.reports.length : 0,
    at: new Date().toISOString(),
  };
}

/**
 * Number er fol — ei number 24 ghontar moddhe check hoye thakle oita i (API limit bachate), na hole notun check.
 * Key na thakle ba API kaj na korle null.
 */
export async function bdLookup(phone, key) {
  const recent = await sql`
    SELECT bd_check FROM orders
    WHERE phone = ${phone} AND bd_check <> '' AND (bd_check::json->>'at')::timestamptz > now() - interval '24 hours'
    ORDER BY id DESC LIMIT 1`;
  if (recent.length) return JSON.parse(recent[0].bd_check);
  try {
    return await checkPhone(phone, key);
  } catch (err) {
    console.error("BD Courier check failed", err);
    return null;
  }
}

/**
 * Order er number check kore orders.bd_check e rakhe. Ekoi number 24 ghontar moddhe check hoye thakle
 * oita i abar use kore (API limit bachate) — `force` dile notun kore check kore.
 */
export async function bdCheckOrder(orderId, { force = false } = {}) {
  const s = await getSettings();
  if (!s.bdcourier_key) return { error: "BD Courier API key সেট করা নেই" };
  const [o] = await sql`SELECT id, phone FROM orders WHERE id = ${orderId}`;
  if (!o) return { error: "অর্ডার পাওয়া যায়নি" };

  let result;
  try {
    result = force ? await checkPhone(o.phone, s.bdcourier_key) : await bdLookup(o.phone, s.bdcourier_key);
  } catch (err) {
    console.error("BD Courier check failed", err);
    return { error: err.message };
  }
  if (!result) return { error: "BD Courier চেক হয়নি" };
  await sql`UPDATE orders SET bd_check = ${JSON.stringify(result)} WHERE id = ${o.id}`;
  return result;
}

// BD Courier er nijer success_ratio protita courier er % er gor (average) — ashol hishab na.
// Tai delivered ÷ mot parcel diye nije hishab kori (purono save kora fol o thik dekhay).
export const bdRatio = (r) => (r.total ? Math.round((r.success / r.total) * 100) : 0);

// Success ratio onujayi rong: 80%+ bhalo, 50-80 majhari, er niche jhuki
export const ratioLevel = (r) => {
  const ratio = bdRatio(r);
  return r.total === 0 ? "new" : ratio >= 80 ? "good" : ratio >= 50 ? "mid" : "bad";
};
