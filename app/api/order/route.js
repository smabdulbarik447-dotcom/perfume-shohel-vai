import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { sql, ensureTables } from "@/lib/db";
import { getSettings, getProducts, deliveryOptions, deliveryCharge } from "@/lib/store";
import { checkOrder, clientIp } from "@/lib/fraud";
import { notifyNewOrder } from "@/lib/telegram";
import { bdCheckOrder, bdLookup, bdRatio } from "@/lib/bdcourier";

export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (!body?.name || !/^01[3-9]\d{8}$/.test(body.phone || "") || !body.address) {
    return Response.json({ ok: false, error: "সব তথ্য সঠিকভাবে দিন" }, { status: 400 });
  }

  try {
    await ensureTables();
    const [settings, products] = await Promise.all([getSettings(), getProducts()]);
    const ip = clientIp(req);

    const problem = await checkOrder({
      phone: body.phone, ip, name: body.name, address: body.address, honeypot: body.website, settings,
    });
    if (problem?.silent) return Response.json({ ok: true, id: 0 });
    if (problem) return Response.json({ ok: false, error: problem.error }, { status: problem.status });

    // BD Courier protection: ager parcel er success ratio kom hole order na niye call korte boli.
    // Ekdom notun (kono parcel nei) ba API kaj na korle order hoy.
    const minRatio = Number(settings.bdcourier_min_ratio) || 0;
    const bd = settings.bdcourier_key && minRatio > 0 ? await bdLookup(body.phone, settings.bdcourier_key) : null;
    if (bd && bd.total > 0 && bdRatio(bd) < minRatio) {
      return Response.json(
        {
          ok: false,
          call: settings.phone,
          whatsapp: settings.whatsapp,
          error: "দুঃখিত, এই নাম্বারে আপনি অনেকগুলো অর্ডার ক্যানসেল করেছেন, তাই অনলাইনে অর্ডার নেওয়া যাচ্ছে না। অর্ডার করতে অনুগ্রহ করে কল করুন।",
        },
        { status: 403 }
      );
    }

    const product = products.find((p) => p.id === Number(body.productId));
    const area = deliveryOptions(settings).find((d) => d.id === body.area);
    if (!product || !area) {
      return Response.json({ ok: false, error: "পণ্য পাওয়া যায়নি, পেজ রিফ্রেশ করুন" }, { status: 400 });
    }

    // Dam server e hishab hoy, browser theke asha total bishshash kora hoy na
    const qty = Math.min(10, Math.max(1, Number(body.qty) || 1));
    const total = product.price * qty + deliveryCharge(settings, area, product, qty);
    const name = String(body.name).trim().slice(0, 100);
    // Facebook Conversions API er jonno (confirm er por Purchase e lage)
    const fbp = String(body.fbp || "").slice(0, 200);
    const fbc = String(body.fbc || "").slice(0, 300);
    const ttp = String(body.ttp || "").slice(0, 200);
    const userAgent = String(req.headers.get("user-agent") || "").slice(0, 400);
    const pageUrl = String(body.pageUrl || "").slice(0, 400);
    const address = String(body.address).trim().slice(0, 500);

    const [row] = await sql`
      INSERT INTO orders (name, phone, address, product, area, qty, total, ip, fbp, fbc, ttp, user_agent, page_url, bd_check)
      VALUES (${name}, ${body.phone}, ${address}, ${product.name}, ${area.id}, ${qty}, ${total}, ${ip},
              ${fbp}, ${fbc}, ${ttp}, ${userAgent}, ${pageUrl}, ${bd ? JSON.stringify(bd) : ""})
      RETURNING id`;
    await sql`UPDATE products SET stock = GREATEST(stock - ${qty}, 0) WHERE id = ${product.id}`;
    await sql`DELETE FROM incomplete_orders WHERE phone = ${body.phone}`;
    revalidatePath("/admin", "layout");
    // Customer ke wait na koriye BD Courier check kore, tarpor (fol shoho) Telegram e pathay
    after(async () => {
      await bdCheckOrder(row.id);
      await notifyNewOrder(row.id);
    });

    return Response.json({ ok: true, id: Number(row.id) });
  } catch (err) {
    console.error("Order save failed", err);
    return Response.json({ ok: false, error: "সার্ভারে সমস্যা, একটু পরে আবার চেষ্টা করুন" }, { status: 500 });
  }
}
