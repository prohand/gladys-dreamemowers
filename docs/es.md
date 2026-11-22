# Dreame Mowers

Controle sus robots cortacésped **Dreame** y **MOVA** desde Gladys Assistant:
estado, batería, inicio, pausa, regreso a la base, escenas y un widget de
panel.

Los robots no tienen API local: como la app de Dreame, la integración pasa
por la **nube de Dreame** (se necesita conexión a internet).

## Robots compatibles

Todo robot vinculado a una cuenta Dreamehome o MOVAhome cuyo modelo empieza
por `dreame.mower.` o `mova.mower.`: Dreame A1, A1 Pro, A2, A3 AWD, MOVA 600,
1000, LiDAX, Viax… Un modelo que falte en esta lista aparece igualmente, con
su nombre técnico.

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. **Aplicación**: Dreamehome o MOVAhome, la app en la que se creó su cuenta.
3. **Correo electrónico** y **Contraseña** de esa cuenta.
   Una cuenta creada con «Iniciar sesión con Google / Apple» no tiene
   contraseña: defina una primero en la app (Perfil → Cuenta y seguridad).
4. **Región**: la región elegida al crear la cuenta (Europa para la mayoría de
   usuarios europeos).
5. **Idioma de los estados**: idioma de los textos Estado y Error.
6. **Intervalo de actualización**: frecuencia de lectura de la nube, un
   minuto como mínimo.
7. Pulse **Probar la conexión**: los robots encontrados aparecen bajo el botón.
8. Abra la pestaña **Descubrimiento** y añada sus robots.

## Qué muestra cada robot

| Función        | Tipo              | Uso                                      |
| -------------- | ----------------- | ---------------------------------------- |
| Mowing         | interruptor       | Encendido = cortar, Apagado = pausa      |
| Return to base | interruptor       | Encendido = volver a la base             |
| Status         | texto             | Cortando, En pausa, Cargando, Volviendo… |
| Battery        | batería (%)       | Nivel de carga                           |
| Charging       | batería (binario) | 1 mientras la batería se carga           |
| Error          | texto             | «Sin error», «Robot atascado (2)»…       |

Una insignia en cada dispositivo indica si el robot responde a través de la
nube (**cloud**) o no (**inaccesible**: sin Wi-Fi / 4G, apagado…).

## Escenas

En la categoría **Integraciones** del editor de escenas:

- **Cambia el estado del robot** (disparador) — cuando el robot empieza a
  cortar, se pausa, vuelve, se aparca o se detiene por un error. Elija si lo
  desea el robot y el nuevo estado. Variables: `{{triggerEvent.data.status}}`,
  `{{triggerEvent.data.previous_status}}`, `{{triggerEvent.data.battery}}`.
- **El robot indica un error** (disparador) — un nuevo error (atascado,
  inclinado, cuchilla bloqueada…). Variables:
  `{{triggerEvent.data.error_code}}`, `{{triggerEvent.data.error_text}}`.
- **Controlar un robot** (acción) — iniciar, pausar, detener o volver a la
  base. Su salida **Orden enviada** indica si la nube aceptó la orden.

Ejemplos: recibir una notificación cuando el robot se atasca; enviarlo a la
base cuando empieza a llover; ponerlo en marcha cada mañana cuando no hay
nadie en el jardín.

## Widget de panel

Añada la caja **Robot cortacésped** a un panel: batería, estado, error,
conexión y tres botones (Cortar, Pausa, A la base). En sus ajustes, elija el
robot que se muestra (vacío: el primer robot de la cuenta).

## Solución de problemas

- **Acceso rechazado**: compruebe el correo, la contraseña, la app (Dreamehome
  o MOVAhome) y la región. Inicie sesión una vez en la app con los mismos
  datos.
- **Ningún robot encontrado**: el robot debe aparecer en la app de esa misma
  cuenta (un robot compartido también aparece).
- **Inaccesible**: el robot no está conectado a la nube. Compruebe su Wi-Fi o
  4G y que esté encendido.
- **El estado cambia con retraso**: la nube se lee al intervalo elegido; tras
  una orden, el robot se vuelve a leer 5 segundos después.

## Privacidad

La contraseña se guarda en un campo secreto de Gladys y solo se envía, cifrada
con hash, a la nube de Dreame. Nada más sale de su Gladys.
