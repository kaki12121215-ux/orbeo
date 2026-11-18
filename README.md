# Orbeo

Viajes que se planean juntos. App web instalable en el iPhone y en el ordenador.

- Plan de cada día con sus horas, en la hora local del destino (avisa si planeas desde otra zona).
- Mapa (Google Maps con clave, o mapa abierto sin clave) y buscador de sitios.
- Ideas guardadas desde TikTok, Instagram, Google Maps o cualquier web.
- Documentos y «Pega una reserva», que se lee con Gemini.
- Grupo con papeles (administración, editor, solo ver) e invitaciones.
- Hora y moneda, con cambio actualizado.
- Película del día con las fotos y vídeos.
- Funciona sin conexión. Los datos viven en una hoja de Google tuya, con `script/Codigo.gs`.

## Cómo se construye

    node src/build.js

Une `src/app/*.js` en `app.js`, `src/css/*.css` en `app.css` y pone la versión en `sw.js`.
Para probar sin script: abre la app y elige «Ver un viaje de ejemplo» (o añade `?demo=1`).
