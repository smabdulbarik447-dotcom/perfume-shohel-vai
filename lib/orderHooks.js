import { fbOnStatus } from "./fbcapi";
import { ttOnStatus } from "./ttcapi";
import { sendConfirmWhatsApp } from "./whatsapp";

/** Status bodlanor por shob "pashe ghota" kaj: Facebook/TikTok event + কনফার্ম e customer ke WhatsApp */
export async function afterStatusChange(orderId, status) {
  await fbOnStatus(orderId, status);
  await ttOnStatus(orderId, status);
  if (status === "confirmed") await sendConfirmWhatsApp(orderId);
}
