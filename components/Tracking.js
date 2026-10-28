import Script from "next/script";
import { pixelIds } from "@/lib/store";

// Admin > ট্র্যাকিং কোড theke deya Facebook Pixel ID (ekadhik), TikTok Pixel ID (ekadhik) ar GTM ID boshay.
// Shob pixel init korle fbq('track') / ttq.track er protita event shob pixel e jay.
export default function Tracking({ pixel, tiktok, gtm }) {
  const ids = pixelIds(pixel);
  const ttIds = String(tiktok || "").split(/\s+/).filter((x) => /^[A-Z0-9]{10,30}$/.test(x));
  const gtmId = /^GTM-[A-Z0-9]{4,12}$/.test(gtm) ? gtm : "";

  return (
    <>
      {ids.length > 0 && (
        <Script id="fb-pixel" strategy="afterInteractive">{`
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
${ids.map((id) => `fbq('init','${id}');`).join("")}fbq('track','PageView');fbq('track','ViewContent');`}</Script>
      )}
      {ttIds.length > 0 && (
        <Script id="tiktok-pixel" strategy="afterInteractive">{`
!function (w, d, t) {
w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
${ttIds.map((id) => `ttq.load('${id}');`).join("")}ttq.page();ttq.track('ViewContent',{contents:[{content_id:'combo',content_type:'product'}]});
}(window, document, 'ttq');`}</Script>
      )}
      {gtmId && (
        <Script id="gtm" strategy="afterInteractive">{`
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}</Script>
      )}
    </>
  );
}
