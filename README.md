# INTO THE UNHEARTH

**Into the Unhearth** es una experiencia inmersiva web de terror y supervivencia (WebXR) construida con [A-Frame](https://aframe.io/). En este minijuego, tomas el rol de un investigador que debe adentrarse en un entorno oscuro para recuperar activos e inspeccionar documentos, todo mientras gestionas la batería de tu linterna y evitas ser atrapado por una entidad hostil conocida como "El Perchero Mímico".

## 🎮 Características Principales

* **Soporte Multiplataforma:** Jugable en PC (ratón y teclado), dispositivos móviles (controles táctiles en pantalla) y visores de Realidad Virtual (Meta Quest, etc.) mediante WebXR.
* **Mecánica de Linterna y Batería:** La visibilidad es nula sin tu linterna. Usarla drena la batería, la cual se recarga lentamente al apagarla. ¡Úsala con sabiduría!
* **IA del "Mímico":** Un enemigo que te acecha constantemente. Solo se detiene si lo miras fijamente. Si parpadeas o le das la espalda, se acercará rápidamente.
* **Inspección de Documentos:** Encuentra notas repartidas por el mapa que revelan arte conceptual interactivo. En PC se abren en pantalla completa, en VR se muestran en un panel virtual anclado a tu mano.
* **Físicas Integradas:** Movimiento y colisiones impulsadas por `aframe-physics-system`.

## 🕹️ Controles

### PC

* **Movimiento:** Teclas `W` `A` `S` `D`
* **Cámara:** Ratón (Apuntar para mirar)
* **Interactuar:** Clic izquierdo (para recoger chatarra o inspeccionar notas)
* **Linterna:** Tecla `E` o botón en pantalla
* **Cerrar Nota:** Botón "Cerrar Archivo" en pantalla

### Realidad Virtual (Meta Quest / WebXR)

* **Movimiento:** Joystick del mando izquierdo
* **Linterna / Cerrar Nota:** Botones `A`, `B`, `X` o los Gatillos
* **Mostrar/Ocultar HUD (Batería y Objetivos):** Botón `Y` del mando izquierdo
* **Interactuar:** Apuntar con el láser y presionar el gatillo

## 🛠️ Tecnologías Utilizadas

* **HTML5 / CSS3 / Vanilla JS**
* **A-Frame v1.4.0** (Motor 3D web)
* **A-Frame Physics System** (Sistema de físicas y colisiones)
* **Three.js** (Subyacente para lógicas complejas como Raycasting de la IA)

## 🚀 Instalación y Ejecución

Al ser un proyecto web estático basado en HTML/JS, no requiere de compilación. Sin embargo, por restricciones de seguridad del navegador (CORS) y WebXR, **necesitas ejecutarlo en un servidor local**.

1. Clona o descarga este repositorio.
2. Abre la carpeta del proyecto.
3. Inicia un servidor web local. Algunas opciones populares:
* **VS Code:** Usa la extensión *Live Server*.
* **Python (Terminal):** Ejecuta `python -m http.server 8000`.
* **Node.js (Terminal):** Usa `npx serve`.


4. Abre tu navegador (Chrome/Edge/Firefox) y ve a `http://localhost:8000` (o el puerto que asigne tu servidor).
5. (Para probar en VR): Asegúrate de que tu visor esté en la misma red Wi-Fi, usa una conexión segura (HTTPS) o configura el port forwarding, y accede a la IP local desde el navegador del visor.

## 📂 Estructura del Proyecto

* `index.html`: Estructura principal de la escena A-Frame, carga de recursos y UI.
* `script.js`: Lógica del juego (movimiento, componentes A-Frame personalizados, IA del enemigo, batería y VR).
* `style.css`: Estilos para la interfaz de usuario, menú inicial, pantalla CRT y tipografía.
* `concepts/`: Carpeta que contiene las imágenes de arte conceptual (`1.png` a `11.png` y `9.jpg`).
