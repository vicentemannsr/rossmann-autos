// Convierte el export del Control Panel de ChileAutos en src/data/stock.json
// Uso: node scripts/import-chileautos.mjs ruta/stock_chileautos.json
//
// El export es un arreglo con un objeto por aviso en stock:
//   { id, t (título), mk (marca), md (modelo), y (año), p (precio), km,
//     col (color), d (descripción), ph (fotos), cr (fecha creación) }
// La patente (pl) se ignora a propósito: no se publica en la web.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Falta la ruta del export: node scripts/import-chileautos.mjs stock_chileautos.json");
  process.exit(1);
}

const CDN = "https://chileautos.pxcrush.net";
const DIAS_RECIEN_LLEGADO = 10;

const MARCAS = { "mv agusta": "MV Agusta", "ds": "DS", "bmw": "BMW", "infiniti": "Infiniti", "mercedes-benz": "Mercedes-Benz", "volkswagen": "Volkswagen", "citroën": "Citroën", "citroen": "Citroën" };
const normMarca = (m) => MARCAS[m.toLowerCase()] || m.replace(/\b\w/g, (c) => c.toUpperCase());

const clp = (n) => "$" + Math.round(n).toLocaleString("es-CL");
const miles = (n) => Math.round(n).toLocaleString("es-CL");

function limpiarModelo(titulo, marca, año) {
  let s = titulo.trim();
  s = s.replace(new RegExp(`^${año}\\s+`), "");
  s = s.replace(new RegExp(`^${marca.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s+`, "i"), "");
  // Quita sufijos de carrocería/caja tipo "AT 5P." o "MT 4P."
  s = s.replace(/\s+(AT|MT)\s+\d+P\.?$/i, "").replace(/\s+\d+P\.?$/i, "");
  return s.trim();
}

function campo(desc, nombre) {
  const m = desc.match(new RegExp(`^\\s*${nombre}\\s*:\\s*(.+)$`, "mi"));
  return m ? m[1].trim().replace(/\.$/, "") : undefined;
}

// Quita emojis y viñetas decorativas (✔️ 📌 🔥 ✨ ▪ …) para que las publicaciones
// se vean sobrias. Conserva ™ © ®.
export function sinEmojis(texto) {
  return texto
    .replace(/(?![\u00A9\u00AE\u2122])[\p{Extended_Pictographic}\u25AA\u25AB\uFE0F\u200D\u20E3]/gu, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]{2,}/g, " ").trim())
    .filter((l, i, arr) => l !== "" || (i > 0 && arr[i - 1] !== ""))
    .join("\n")
    .trim();
}

function combustible(t, d) {
  const s = `${t} ${d}`.toUpperCase();
  if (/EL[EÉ]CTRICO/.test(t.toUpperCase()) || /100% EL[EÉ]CTRICO/.test(s)) return "Eléctrico";
  if (/HYBRID|H[IÍ]BRIDO|MHEV/.test(t.toUpperCase())) return "Híbrido";
  if (/DIESEL|DI[EÉ]SEL|BLUEHDI|CDI|\b\d{3} ?D\b|\bTDI\b|\b350D\b/.test(t.toUpperCase())) return "Diésel";
  return "Gasolina";
}

function transmision(t, d) {
  const tu = ` ${t.toUpperCase()} `;
  const tr = (campo(d, "Transmisi[oó]n") || "").toLowerCase();
  if (/ MT | BVM|MANUAL/.test(tu) || /manual|mec[aá]nica/.test(tr)) return "Manual";
  if (/^\d{4} MV AGUSTA/i.test(t)) return "Manual";
  return "Automática";
}

const raw = JSON.parse(readFileSync(input, "utf8"));
const hoy = Date.now();

const stock = raw.map((x) => {
  const marca = normMarca(x.mk);
  const año = String(x.y);
  const desc = sinEmojis(x.d || "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{2,}/g, "\n").trim();
  const pie = desc.match(/desde\s+(?:un\s+)?(\d{1,2})\s*%/i);
  const dias = (hoy - Date.parse(x.cr)) / 86400000;
  const v = {
    id: x.id,
    marca,
    modelo: limpiarModelo(x.t, x.mk, año),
    año,
    km: miles(x.km),
    precio: clp(x.p),
    comb: combustible(x.t, desc),
    trans: transmision(x.t, desc),
    color: x.col || undefined,
    estado: dias <= DIAS_RECIEN_LLEGADO ? "Recién llegado" : "Disponible",
    fotos: (x.ph || []).map((u) => `${CDN}${u}?width=1200`),
    descripcion: desc,
    motor: campo(desc, "Motor"),
    potencia: campo(desc, "Potencia"),
    dueños: campo(desc, "Due[ñn]os"),
    financiamientoPie: pie ? Number(pie[1]) / 100 : undefined,
    publicado: x.cr,
  };
  Object.keys(v).forEach((k) => v[k] === undefined && delete v[k]);
  return v;
});

stock.sort((a, b) => Date.parse(b.publicado) - Date.parse(a.publicado));

const out = "src/data/stock.json";
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(stock, null, 2) + "\n");
console.log(`${stock.length} vehículos escritos en ${out}`);
