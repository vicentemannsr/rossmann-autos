import {
  checkAuth,
  findCar,
  photoUrl,
  publishInstagram,
  publishFacebook,
  getIds,
} from "./_lib/meta.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;

  // GET /api/publicar → comprueba la conexión con Meta (sin publicar nada)
  if (req.method === "GET") {
    try {
      const ids = await getIds();
      return res.status(200).json({ ok: true, pagina: ids.pageName, instagram: !!ids.igId });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const { id, fotos, caption, destinos = ["instagram", "facebook"] } = req.body || {};
  const car = findCar(id);
  if (!car) return res.status(404).json({ error: "Auto no encontrado" });
  const sel = (fotos && fotos.length ? fotos : car.fotos).slice(0, 10);
  if (!sel.length) return res.status(400).json({ error: "El auto no tiene fotos" });
  if (!caption) return res.status(400).json({ error: "Falta el texto" });

  const site = process.env.SITE_URL || `https://${req.headers.host}`;
  const urls = sel.map((f) => photoUrl(site, f));

  const out = {};
  if (destinos.includes("instagram")) {
    try {
      out.instagram = { ok: true, link: await publishInstagram(urls, caption) };
    } catch (e) {
      out.instagram = { ok: false, error: e.message };
    }
  }
  if (destinos.includes("facebook")) {
    try {
      out.facebook = { ok: true, link: await publishFacebook(urls, caption) };
    } catch (e) {
      out.facebook = { ok: false, error: e.message };
    }
  }
  res.status(200).json(out);
}
