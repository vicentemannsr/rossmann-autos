// Utilidades para publicar en Instagram y Facebook vía Graph API.
// Variables de entorno (Vercel):
//   META_TOKEN      token del usuario del sistema (portfolio Automotora Rossmann)
//   FB_PAGE_ID      ID de la página "Rossmann Automoviles" (451685088033045)
//   IG_USER_ID      opcional: ID de la cuenta de Instagram; si falta se obtiene desde la página
//   ADMIN_PASSWORD  clave para usar /admin
//   SITE_URL        opcional: https://www.rossmann.cl (para armar las URLs de las fotos)

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const STOCK = require("../../src/data/stock.json");

const GRAPH = "https://graph.facebook.com/v21.0";

export function checkAuth(req, res) {
  const key = req.headers["x-admin-key"];
  if (!process.env.ADMIN_PASSWORD || key !== process.env.ADMIN_PASSWORD) {
    res.status(401).json({ error: "No autorizado" });
    return false;
  }
  return true;
}

export function getStock() {
  return STOCK;
}

export function findCar(id) {
  return STOCK.find((c) => c.id === id);
}

async function graph(path, params = {}, method = "GET", token = process.env.META_TOKEN) {
  const body = new URLSearchParams({ ...params, access_token: token });
  const url = method === "GET" ? `${GRAPH}/${path}?${body}` : `${GRAPH}/${path}`;
  const r = await fetch(url, method === "GET" ? {} : { method, body });
  const j = await r.json();
  if (j.error) {
    const e = new Error(j.error.error_user_msg || j.error.message);
    e.meta = j.error;
    throw e;
  }
  return j;
}

let _ids = null;
export async function getIds() {
  if (_ids) return _ids;
  const pageId = process.env.FB_PAGE_ID;
  const page = await graph(pageId, { fields: "access_token,instagram_business_account,name" });
  _ids = {
    pageId,
    pageName: page.name,
    pageToken: page.access_token,
    igId: process.env.IG_USER_ID || page.instagram_business_account?.id,
  };
  return _ids;
}

// URL pública de la foto recortada a 4:5 (Instagram no acepta fotos más verticales que 4:5)
export function photoUrl(siteUrl, src) {
  return `${siteUrl}/api/img?u=${encodeURIComponent(src.split("?")[0])}`;
}

const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

async function waitContainer(id) {
  for (let i = 0; i < 20; i++) {
    const s = await graph(id, { fields: "status_code" });
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR") throw new Error("Instagram no pudo procesar una foto");
    await sleep(1500);
  }
  throw new Error("Instagram tardó demasiado en procesar las fotos");
}

export async function publishInstagram(urls, caption) {
  const { igId } = await getIds();
  if (!igId) throw new Error("La página no tiene una cuenta de Instagram vinculada");
  if (urls.length === 1) {
    const c = await graph(`${igId}/media`, { image_url: urls[0], caption }, "POST");
    await waitContainer(c.id);
    const p = await graph(`${igId}/media_publish`, { creation_id: c.id }, "POST");
    return p.id;
  }
  const children = await Promise.all(
    urls.map((u) => graph(`${igId}/media`, { image_url: u, is_carousel_item: "true" }, "POST"))
  );
  for (const ch of children) await waitContainer(ch.id);
  const car = await graph(
    `${igId}/media`,
    { media_type: "CAROUSEL", children: children.map((c) => c.id).join(","), caption },
    "POST"
  );
  await waitContainer(car.id);
  const p = await graph(`${igId}/media_publish`, { creation_id: car.id }, "POST");
  const info = await graph(p.id, { fields: "permalink" });
  return info.permalink || p.id;
}

export async function publishFacebook(urls, message) {
  const { pageId, pageToken } = await getIds();
  const photos = await Promise.all(
    urls.map((u) => graph(`${pageId}/photos`, { url: u, published: "false" }, "POST", pageToken))
  );
  const params = { message };
  photos.forEach((p, i) => (params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: p.id })));
  const post = await graph(`${pageId}/feed`, params, "POST", pageToken);
  return `https://www.facebook.com/${post.id}`;
}

export async function publishStoryInstagram(url) {
  const { igId } = await getIds();
  const c = await graph(`${igId}/media`, { image_url: url, media_type: "STORIES" }, "POST");
  await waitContainer(c.id);
  const p = await graph(`${igId}/media_publish`, { creation_id: c.id }, "POST");
  return p.id;
}

// ---------- Texto del post (formato aprobado de Rossmann) ----------
const fmt = (n) => "$" + Math.round(n).toLocaleString("es-CL").replace(/,/g, ".");

function line(desc, label) {
  const m = desc.match(new RegExp(`^${label}:\\s*(.+)$`, "mi"));
  return m ? m[1].trim() : "";
}

export function buildCaption(car) {
  const d = car.descripcion || "";
  const lines = d.split("\n").map((l) => l.trim());
  const first = lines[0] || "";
  const titulo =
    first && first.includes(String(car.año)) && first.toLowerCase().includes(car.marca.toLowerCase().split("-")[0])
      ? first
      : `${car.marca} ${car.modelo} ${car.año}`;
  const title = titulo
    .toLowerCase()
    .replace(/(^|\s|-)([a-záéíóúñ])/g, (m, a, b) => a + b.toUpperCase())
    .replace(/\b(Ex|Gt|Gls|Amg|Tsi|Awd|4x4|4x2|Suv|Bmw|Mt|At|Hp)\b/gi, (w) => w.toUpperCase());

  const km = line(d, "Kilometraje") || `${car.km} km`;
  const motor = (line(d, "Motor") || car.motor || "").replace(/\s*\/\s*[\d.,]+\s*Nm/i, "");
  const dn = String(car.dueños || "").trim();
  const duenos = !dn ? "" : /^\d+$/.test(dn) ? `${dn} ${dn === "1" ? "dueño" : "dueños"}` : dn;
  const historial = line(d, "Historial");
  const eqIdx = lines.findIndex((l) => /^Equipamiento destacado/i.test(l));
  const extras = [];
  if (eqIdx >= 0) {
    for (const l of lines.slice(eqIdx + 1)) {
      if (!l || /^(Funcionamiento|Impecable|Precio|Documentaci)/i.test(l)) break;
      if (/^Caja /i.test(l)) continue;
      extras.push(l.length > 60 ? l.split(/,| con /)[0].trim() : l);
      if (extras.length === 3) break;
    }
  }
  const datos = [km, motor, duenos, historial, ...extras].filter(Boolean).join(" · ");

  const precioNum = Number(String(car.precio).replace(/\D/g, ""));
  const pie = car.financiamientoPie;
  const finDesc = d.match(/Financiamiento[^\n]*?desde\s*(\$[\d.]+)\s*\((\d+)%\s*de pie\)/i);
  const fin = finDesc
    ? `Financiamiento desde ${finDesc[1]} (${finDesc[2]}% de pie). `
    : pie
    ? `Financiamiento desde ${fmt(precioNum * pie)} (${Math.round(pie * 100)}% de pie). `
    : "";

  const marcaTag = car.marca.replace(/[^A-Za-z0-9]/g, "");
  const mt = car.modelo.split(" ");
  const modeloTag = ((mt[0] || "").length <= 2 && mt[1] ? mt[0] + mt[1] : mt[0] || "").replace(/[^A-Za-z0-9]/g, "");
  const tags = [
    `#${marcaTag}`,
    `#${marcaTag}${modeloTag}`,
    `#${modeloTag}`,
    "#AutosUsados",
    "#AutosSantiago",
    "#LoBarnechea",
    "#VentaDeAutos",
    "#Chile",
    "#Rossmann",
    "#RossmannAutos",
  ];

  return [
    title,
    "",
    datos,
    "",
    `Precio: ${car.precio}`,
    `${fin}Pago con tarjeta de crédito. Recibimos tu auto en parte de pago.`,
    "",
    "Más información por DM o en rossmann.cl",
    "Av. Raúl Labbe 12650, Of. 302, Lo Barnechea",
    "",
    [...new Set(tags)].join(" "),
  ].join("\n");
}
