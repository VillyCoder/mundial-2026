# Mundial 2026 - Seguimiento en Tiempo Real

Aplicacion web para seguir la Copa del Mundo FIFA 2026 en tiempo real.
Desarrollada con JavaScript vanilla, Node.js y las APIs publicas de ESPN.

## Que hace

- Marcador en directo de todos los partidos del Mundial
- Cronologia de eventos: goles, tarjetas, sustituciones
- Alineaciones y formaciones tacticas por partido
- Clasificacion por grupos actualizada
- Estadisticas del torneo: goleadores, mejor ataque/defensa, posesion...
- Fotos de jugadores (TheSportsDB) con cache en servidor y localStorage
- Cuerpo tecnico de cada seleccion (seleccionador nacional)
- Calendario completo de partidos de tu seleccion favorita
- Resaltado del equipo favorito en el calendario mensual
- Posiciones en espanol (Portero / Defensa / Centrocampista / Delantero)
- Hora de los partidos en zona horaria de Madrid
- Instalable como app (PWA): funciona en movil y escritorio

## Tecnologias

- **Frontend**: JavaScript ES6+ (modulos nativos), HTML5, CSS3 con custom properties
- **Backend**: Node.js (HTTP server sin frameworks), actua como proxy de la API de ESPN
- **APIs**: ESPN (publica, sin clave), TheSportsDB (gratuita, sin clave)
- **Despliegue**: compatible con Vercel, Railway o cualquier servidor Node

## Por que un proxy propio

ESPN bloquea las peticiones directas desde el navegador por CORS. El servidor
de Node.js recibe las peticiones del frontend, las redirige a ESPN, normaliza
los datos y los devuelve en un formato limpio y consistente.

## Estructura del proyecto

```
mundial-2026/
   server.js             # Servidor proxy Node.js
   index.html            # HTML base (SPA de una sola pagina)
   manifest.json         # Configuracion PWA (nombre, iconos, colores)
   sw.js                 # Service Worker (cache de archivos estaticos)
   vercel.json           # Configuracion de despliegue en Vercel
   photos-cache.json     # Cache de fotos de jugadores (no expira)
   css/
      variables.css      # Paleta de colores y tokens de diseno
      base.css           # Reset y estilos globales
      layout.css         # Grid principal (sidebar + contenido)
      components.css     # Estilos de todos los componentes
      animations.css     # Animaciones CSS
   js/
      app.js             # Punto de entrada, registro de rutas
      router.js          # Router hash-based (#/ruta)
      scraper.js         # Capa de acceso a datos con cache de tres capas
      config.js          # Configuracion: equipos y equipo favorito
      storage.js         # Persistencia en localStorage
      components/
         live-score.js   # Pagina Hoy (partidos del dia)
         match-detail.js # Detalle de partido y formaciones
         calendar.js     # Calendario completo del torneo
         standings.js    # Clasificacion por grupos
         stats.js        # Estadisticas globales del torneo
         teams.js        # Equipos, plantillas y cuerpo tecnico
         my-team.js      # Equipo favorito y todos sus partidos
         header.js       # Cabecera con logo y estado en vivo
         sidebar.js      # Navegacion lateral
   scripts/
      prefetch-photos.js # Pre-descarga fotos de todos los jugadores
```

## Como ejecutar en local

Necesitas tener **Node.js** instalado (version 16 o superior).

```bash
# 1. Entrar en la carpeta del proyecto
cd mundial-2026

# 2. Arrancar el servidor
node server.js

# 3. Abrir en el navegador
# http://localhost:3000
```

No hay dependencias que instalar: el proyecto usa solo modulos nativos de Node.js.

### Pre-descargar fotos de jugadores (opcional)

Para que las fotos aparezcan rapidamente sin depender de la API en vivo,
puedes pre-cargar el cache antes de subir a GitHub:

```bash
node scripts/prefetch-photos.js
```

El script tarda bastante (respeta el limite de TheSportsDB) pero solo hay que
ejecutarlo una vez. El resultado se guarda en `photos-cache.json` y el servidor
lo carga al arrancar.

## APIs utilizadas

| API | Uso | Clave necesaria |
|-----|-----|-----------------|
| ESPN Site API | Marcadores, clasificacion, plantillas | No |
| ESPN Core API | Alineaciones y formaciones oficiales | No |
| TheSportsDB | Fotos de jugadores | No |

