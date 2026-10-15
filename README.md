# Rossmann Autos — Sitio Web

## Publicar por primera vez (manual)

1. Crea una cuenta gratis en https://github.com si no tienes.
2. Crea un repositorio nuevo (ej. `rossmann-autos`), público o privado.
3. Sube esta carpeta completa al repo (botón "Add file" > "Upload files" en GitHub, arrastra todo).
4. Crea una cuenta gratis en https://vercel.com (puedes entrar con tu cuenta de GitHub).
5. En Vercel: "Add New" > "Project" > selecciona el repo `rossmann-autos` > Deploy.
   Vercel detecta que es Vite automáticamente, no cambies nada.
6. En unos segundos tendrás una URL tipo `rossmann-autos.vercel.app` funcionando.

## Conectar tu dominio rossmann.cl

1. En el proyecto en Vercel: Settings > Domains > agrega `rossmann.cl` y `www.rossmann.cl`.
2. Vercel te mostrará 1-2 registros DNS (tipo A y/o CNAME) que debes agregar
   donde compraste el dominio (NIC Chile u otro registrador).
3. Los cambios DNS pueden tardar unos minutos a un par de horas en propagarse.

## Actualizar el sitio después

- **Manual**: edita `src/App.jsx`, sube el archivo actualizado a GitHub
  (reemplázalo desde la web de GitHub) → Vercel vuelve a publicar solo.
- **Automatizado**: usando Claude Code conectado a este repo, pídele los
  cambios y él mismo hace commit + push. Vercel publica automáticamente
  cada vez que hay un push a la rama principal.

## Actualizar el stock desde ChileAutos

El catálogo se genera desde el Control Panel de ChileAutos (cp.chileautos.cl).
Los datos viven en `src/data/stock.json`; las fotos se muestran directo desde
el CDN de ChileAutos, así que no hay que subir imágenes al repo.

1. Exportar el inventario "En stock" del Control Panel a `stock_chileautos.json`.
2. `node scripts/import-chileautos.mjs stock_chileautos.json`
3. Commit + push → Vercel publica.

Las patentes del export se ignoran a propósito: no se publican en la web.

## Desarrollo local (opcional)

```
npm install
npm run dev
```
