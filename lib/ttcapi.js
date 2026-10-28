import { createHash } from "crypto";
import { sql } from "./db";
import { getSettings, getProducts } from "./store";

// TikTok Events API — Facebook CAPI er motoi: admin confirm korle server theke CompletePayment,
// return hole "OrderReturned". Pixel prati alada Access Token (TikTok Events Manager theke).
const API = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

const sha = (v) => createHash("sha256").update(String(v).trim().toLowerCase()).digest("hex");

export const ttPixelIds = (value) =>
  [...new Set(String(value || "").split(/[\s,]+/).filter((x) => /^[A-Z0-9]{10,30}$/.test(x)))].slice(0, 10);

export function ttTokens(s) {
  try {
    return JSON.parse(s.tt_capi || "{}") || {};
  } catch {
    return {};
  }
}

// Token deya ache emon pixel gulo
export const ttCapiPixels = (s) => {
  const tokens = ttTokens(s);
  return ttPixelIds(s.tiktok_pixel).filter((id) => tokens[id]);
};

function user(o) {
  const phone = sha("+88" + o.phone); // +8801XXXXXXXXX
  // Ad e click kore ashle page er link e ttclid thake
  let ttclid = "";
  try { ttclid = new URL(o.page_url).searchParams.get("ttclid") || ""; } catch {}
  return {
    phone,
    external_id: phone,
    ...(o.ip ? { ip: o.ip } : {}),
    ...(o.user_agent ? { user_agent: o.user_agent } : {}),
    ...(o.ttp ? { ttp: o.ttp } : {}),
    ...(ttclid ? { ttclid } : {}),
  };
}

async function send(s, o, event, properties) {
  const tokens = ttTokens(s);
  const pixels = ttCapiPixels(s);
  if (!pixels.length) return { sent: 0, errors: ["TikTok Access Token দেওয়া নেই"] };
  const url = o.page_url || (s.domain ? `https://${s.domain.replace(/^https?:\/\//, "")}` : "");
  let sent = 0;
  const errors = [];
  for (const id of pixels) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Access-Token": tokens[id] },
        body: JSON.stringify({
          event_source: "web",
          event_source_id: id,
          ...(s.tt_test_code ? { test_event_code: s.tt_test_code } : {}),
          data: [{
            event,
            event_time: Math.floor(Date.now() / 1000),
            event_id: `${event.toLowerCase()}-${o.id}`, // ek order er ek event ekbar-i dhora hoy
            user: user(o),
            properties,
            ...(url ? { page: { url } } : {}),
          }],
        }),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.code !== 0) throw new Error(data.message || `HTTP ${res.status}`);
      sent++;
    } catch (err) {
      errors.push(`${id}: ${err.message}`);
      console.error("TikTok Events API failed", id, event, err.message);
    }
  }
  return { sent, errors };
}

/** Order কনফার্ম (ba শিপড/ডেলিভারড) hole CompletePayment — ekbar-i jay */
export async function ttSendPurchase(orderId) {
  const s = await getSettings();
  if (!ttCapiPixels(s).length) return null;
  const [o] = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
  if (!o || o.tt_purchase_sent) return null;
  const products = await getProducts({ all: true });
  const p = products.find((x) => x.name === o.product);
  const r = await send(s, o, "CompletePayment", {
    currency: "BDT",
    value: o.total,
    content_type: "product",
    contents: [{ content_id: String(p?.id || o.product), content_name: o.product, quantity: o.qty, ...(p ? { price: p.price } : {}) }],
    order_id: String(o.id),
  });
  if (r.sent > 0) await sql`UPDATE orders SET tt_purchase_sent = true WHERE id = ${o.id}`;
  return r;
}

/** Customer product nilo na (রিটার্ন) — custom event, Ads e exclude audience banate */
export async function ttSendReturned(orderId) {
  const s = await getSettings();
  if (!ttCapiPixels(s).length) return null;
  const [o] = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
  if (!o || o.tt_return_sent) return null;
  const r = await send(s, o, "OrderReturned", { currency: "BDT", value: o.total, order_id: String(o.id) });
  if (r.sent > 0) await sql`UPDATE orders SET tt_return_sent = true WHERE id = ${o.id}`;
  return r;
}

/** Je kono jaygay status bodlale eta call hoy */
export async function ttOnStatus(orderId, status) {
  if (["confirmed", "shipped", "delivered"].includes(status)) return ttSendPurchase(orderId);
  if (status === "returned") return ttSendReturned(orderId);
  return null;
}
