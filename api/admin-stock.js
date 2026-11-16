import { checkAuth, getStock, buildCaption } from "./_lib/meta.js";

export default function handler(req, res) {
  if (!checkAuth(req, res)) return;
  const autos = getStock().map((c) => ({
    id: c.id,
    titulo: `${c.marca} ${c.modelo} ${c.año}`,
    precio: c.precio,
    estado: c.estado,
    publicado: c.publicado,
    fotos: c.fotos,
    caption: buildCaption(c),
  }));
  autos.sort((a, b) => String(b.publicado || "").localeCompare(String(a.publicado || "")));
  res.status(200).json({ autos });
}
