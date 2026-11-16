// Entrega una foto de ChileAutos recortada al centro en 4:5 (1080x1350, JPEG),
// el formato más vertical que acepta Instagram en un carrusel.
import sharp from "sharp";

const ALLOWED = /^https:\/\/chileautos\.pxcrush\.net\/cars\/dealer\/[a-z0-9]+\.jpg$/i;

export default async function handler(req, res) {
  const u = String(req.query.u || "");
  if (!ALLOWED.test(u)) return res.status(400).send("URL no permitida");
  try {
    const r = await fetch(`${u}?width=1440`);
    if (!r.ok) return res.status(502).send("No se pudo obtener la foto");
    const buf = Buffer.from(await r.arrayBuffer());
    const base = sharp(buf).rotate();
    const { width = 1, height = 1 } = await base.metadata();
    let out;
    if (height >= width) {
      // vertical: recorte al centro a 4:5
      out = await base.resize(1080, 1350, { fit: "cover", position: "centre" }).jpeg({ quality: 88 }).toBuffer();
    } else {
      // horizontal: foto completa sobre fondo difuminado de la misma foto
      const bg = await sharp(buf).rotate().resize(1080, 1350, { fit: "cover" }).blur(40).modulate({ brightness: 0.5 }).toBuffer();
      const fg = await sharp(buf).rotate().resize(1080, 1350, { fit: "inside" }).toBuffer();
      out = await sharp(bg).composite([{ input: fg, gravity: "centre" }]).jpeg({ quality: 88 }).toBuffer();
    }
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    res.status(200).send(out);
  } catch (e) {
    res.status(500).send("Error procesando la foto");
  }
}
