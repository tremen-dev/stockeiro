---
id: ADR-036
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-08-25, por: sdd-arquitecto}
---
# ADR-036: El correo lleva dos cuerpos — `html` opcional en el puerto, el texto plano intacto, y la plantilla **sobre** el puerto, nunca dentro del adaptador (enmienda al pto. 1 de ADR-006)

- Deciders: propone **sdd-arquitecto** (2026-08-25) al escribir **SPEC-056**. Aprueba el **humano
  (Alberto Fojo)** en el gate. **Enmienda** —no supersede— el **pto. 1 de ADR-006**: el puerto
  `NotificationSender` sigue siendo la frontera y `ResendSender` sigue siendo el adaptador; lo que
  cambia es la **forma del mensaje** que lo cruza. Los puntos 2 a 5 de ADR-006 (registro in-app como
  fuente de verdad, los dos tipos de aviso, el enganche en el ciclo, la resiliencia por usuario)
  quedan **exactamente** como estaban.
- Specs relacionadas: la origina **SPEC-056** (*Los tres correos*). La consumen los **tres** emisores
  que hoy cruzan el puerto: `src/lib/notifications/service.ts` (entrada y permanencia, SPEC-006) y
  `src/lib/auth/password-reset.ts` (recuperación, SPEC-023 / ADR-015).

## Contexto

Hoy `NotificationMessage` (`src/lib/notifications/sender.ts`) es exactamente esto:

```ts
export interface NotificationMessage {
  to: string;
  subject: string;
  body: string;
}
```

**Un solo cuerpo, y de texto.** `ResendSender` lo entrega a la API de Resend como `text:` y nunca
como `html:`. Los tres correos que la app envía son, en consecuencia, texto plano puro: ni una
etiqueta, ni un color, ni la marca.

SPEC-056 pide que esos tres correos lleven diseño y lleven la marca «Stockeiro, un proyecto de
tremen.dev» en cabecera y pie. Eso **no se puede hacer sin tocar la frontera**: un correo con
diseño es un correo con una parte `text/html`, y por el puerto hoy no cabe. De ahí este ADR — y de
ahí que SPEC-056 tenga que justificar su encaje en EPIC-MEJORA, cuyo CE-M3 dice que una mejora que
necesita ADR nuevo se replantea (§Notas para el gate de la spec).

Tres hechos del árbol condicionan la decisión, y ninguno es opinable:

1. **El puerto tiene tres implementadores, y el real no se ejerce nunca.** `FakeNotificationSender`
   (`fake-sender.ts`) es el que corre en los tests; `OutboxFileSender` (`outbox-file-sender.ts`)
   hereda de él y además escribe el mensaje en disco para que el e2e lo lea; `ResendSender`
   (`resend-sender.ts`) **requiere una key real y un dominio verificado**, y su propia cabecera lo
   dice: *«NO se ejerce en tests»*. Lo que la suite observa del correo, por tanto, es **lo que ve el
   fake**: si algo no cruza el puerto, la suite no lo ve.
2. **Hay consumidores del texto plano que no son el destinatario.** `tests/password-reset.test.ts`
   extrae el enlace de recuperación con `msg.body.match(/https?:\/\/\S*\/reset-password\/([A-Za-z0-9_-]+)/)`
   (línea 36) y comprueba en la línea 163 que **la primera** URL absoluta del cuerpo es ese enlace;
   `tests/e2e/recuperacion.spec.ts` hace lo mismo leyendo el buzón en disco (línea 39). El texto
   plano no es una cortesía hacia clientes viejos: es **el canal por el que este proyecto observa lo
   que envía**. Romperlo apaga la única lente que tenemos sobre el correo.
3. **El registro in-app no es el correo.** `notifications.payload` alimenta el historial de SPEC-007,
   que la UI pinta **como texto**. Es una superficie distinta, con un lector distinto.

Y una restricción del medio que empuja en la misma dirección: el correo HTML se renderiza en motores
que no son navegadores (Outlook usa el de Word), muchos clientes bloquean imágenes por defecto y
algunos entregan solo la parte de texto. Un formato que **obligue** a elegir entre HTML y texto es un
formato equivocado para este medio; MIME `multipart/alternative` existe precisamente porque la
respuesta correcta es «los dos».

## Decisión

1. **El mensaje gana un `html` OPCIONAL; `body` no se toca.**

   ```ts
   export interface NotificationMessage {
     to: string;
     subject: string;
     /** Cuerpo en texto plano. SIEMPRE presente: es la alternativa y es lo que se observa. */
     body: string;
     /** Cuerpo HTML, opcional. Cuando está, viaja junto al texto, nunca en su lugar. */
     html?: string;
   }
   ```

   Que sea **opcional** es lo que hace que esta enmienda no rompa nada: los tres implementadores
   siguen satisfaciendo el tipo sin cambiar una línea, y un emisor que aún no tenga plantilla sigue
   enviando texto y funcionando.

2. **El texto plano sigue siendo obligatorio, completo y autosuficiente.** `body` **no** es un
   resumen del HTML ni un «si no ves bien este correo, ábrelo en el navegador»: dice lo mismo,
   entero, y se entiende solo. Corolario duro para la recuperación de contraseña: **el enlace sigue
   apareciendo en el texto plano como URL desnuda y sigue siendo la primera URL absoluta del cuerpo**.
   Ningún adorno de marca se coloca por delante de él (ver pto. 6).

3. **`ResendSender` manda las dos partes cuando hay dos.** Añade `html: message.html` al cuerpo de la
   petición cuando `html` está definido, y lo omite cuando no. Resend compone entonces un
   `multipart/alternative`: cada cliente elige la parte que sabe pintar. El adaptador **no decide
   nada más**: sigue traduciendo, que es lo único que le toca.

4. **La plantilla vive SOBRE el puerto, en un módulo puro, y jamás dentro de un adaptador.** El HTML
   lo compone un módulo propio —`src/lib/notifications/templates/` en SPEC-056— que es una función de
   datos a `{ subject, text, html }`, sin base de datos, sin Next y sin sesión.

   Conviene decir el motivo con precisión, porque el argumento fácil es falso: componer dentro de
   `ResendSender` **sí** se podría afirmar en un test —su constructor acepta un `fetchImpl`, así que
   se le puede mirar la petición sin key ni dominio (y CA-2 de SPEC-056 hace exactamente eso)—. El
   motivo verdadero es otro y es peor: el diseño existiría **solo en el camino de Resend**. El fake y
   el buzón en disco del e2e —los **dos** sitios desde los que este proyecto mira su propio correo—
   seguirían viendo texto pelado, de modo que **lo que la suite observa dejaría de ser lo que el
   destinatario recibe**. Y cada adaptador futuro tendría que volver a escribir la cabecera, el pie y
   la paleta, con la certeza de que la segunda copia se quedará atrás. Por encima del puerto, en
   cambio, el HTML es un `string` que cualquier emisor produce, cualquier adaptador transporta y
   cualquier test lee.

5. **La marca en el correo se lee de `MARCA` (`src/lib/legal/content.ts`), no se teclea.** El literal
   «Stockeiro, un proyecto de tremen.dev» y la URL `https://tremen.dev` tienen **una** fuente en este
   repositorio, ya usada por `src/app/app-footer.tsx` y por `/legal/aviso-legal`. El correo se suma a
   esa lista de lectores. Dos literales acaban siendo dos marcas distintas, y la que quede
   desactualizada saldrá justo en la superficie que **no se puede corregir después de enviada**.
   `content.ts` es un módulo puro bajo `tests/legal-import-graph.test.ts`; leerlo desde la plantilla
   respeta esa pureza — la dirección es correo → legal, nunca al revés.

6. **El correo no pide nada a nadie.** Ninguna de las tres plantillas referencia un recurso externo:
   sin `<img>`, sin `<link>`, sin `@import`, sin `url(...)`, sin fuentes remotas y sin píxel de
   seguimiento. Toda URL absoluta que aparezca en el HTML es un **`href`** —algo que el lector decide
   pinchar—, nunca un recurso que el cliente descargue solo. Tres razones, y las tres cuentan: es la
   misma promesa que SPEC-035 CA-12 ya hizo para la web y que `tests/legal-sin-terceros.test.ts`
   vigila; una imagen bloqueada por defecto —que es lo normal en correo— deja **un hueco en blanco
   justo donde iba la marca**, que es exactamente lo contrario de lo que se pretende; y un recurso
   remoto en un correo transaccional es telemetría sobre el lector, se quiera o no.

7. **El registro in-app se queda como está: texto.** Ni `notifications.payload` ni ninguna columna de
   `notifications` guarda HTML, y esta enmienda **no añade columna alguna**. El aviso in-app
   (SPEC-007) y el correo son dos presentaciones del mismo hecho, con lectores distintos; meter
   etiquetas en el payload rompería la UI que lo pinta y convertiría una tabla de datos en una de
   fragmentos de documento. **No hay migración de esquema en esta enmienda.**

8. **Y no se estrena ninguna clave de entorno.** El correo no necesita saber el origen absoluto de la
   app: la única URL absoluta que la marca aporta es `MARCA.url`, que es una constante.
   `APP_BASE_URL` sigue entrando solo por donde ya entraba —el enlace de reset, ADR-015 pto. 8—, y
   `.env.example` sigue teniendo las **once** claves que congela `tests/spec-031-frontera.test.ts`.
   Matiz que el gate del 2026-08-25 añadió y que no contradice lo anterior: SPEC-056 cambia el
   **valor** de `RESEND_FROM` (el remitente pasa a `stockeiro@tremen.dev`, SPEC-056 D-11). Cambiar el
   valor de una clave que ya existe no es estrenar clave: el recuento no se mueve y esta enmienda del
   puerto es ajena a esa corrección.

## Consecuencias

### Positivas

- **Nadie se rompe.** Campo opcional ⇒ `FakeNotificationSender` y `OutboxFileSender` compilan y
  funcionan sin tocarse; y como el fake guarda el mensaje **entero**, el HTML queda observable en los
  tests y en el buzón del e2e **gratis**, sin instrumentación nueva.
- **Las guardias existentes siguen en pie.** Los tests que leen `body` para sacar el enlace de reset
  siguen verdes porque `body` conserva su forma y su orden. Una guardia que sobrevive a un cambio de
  presentación es una guardia que estaba bien puesta.
- **El diseño es testable.** Al ser un `string` producido por un módulo puro, «lleva la marca», «no
  pide recursos fuera», «no usa flex ni grid» y «el contraste es este» dejan de ser adjetivos y pasan
  a ser aserciones de Vitest, sin navegador y sin base de datos.
- **La frontera de ADR-006 se conserva intacta.** Migrar a Postmark o a SES sigue siendo *escribir un
  adaptador*: el nuevo recibirá `text` y `html` y hará su traducción. La enmienda amplía el contrato,
  no lo relaja.

### Negativas / follow-ups

- **Dos cuerpos que dicen lo mismo pueden divergir.** Un cambio de copy que toque solo el HTML deja el
  texto plano diciendo otra cosa, y el destinatario que vea la parte de texto verá la versión vieja.
  Mitigación exigida por SPEC-056: **una sola función por correo devuelve los dos cuerpos**, y un CA
  afirma que los datos que aparecen en uno aparecen en el otro. No es una promesa: es un test.
- **La entrega real sigue sin poder probarse aquí.** Que la petición a Resend lleve el campo `html`
  se afirma con un `fetchImpl` inyectado; que Resend construya el `multipart/alternative`, que el
  correo salga y que el cliente lo pinte, no. La primera prueba de eso es **un envío real tras
  desplegar**,
  y así queda anotado como follow-up de despliegue en el ledger de SPEC-056 — del mismo modo que
  F-SPEC-006-1 se cerró con «un reset real entregado» (`docs/despliegue.md:53-54`).
- **El HTML de correo envejece por el lado de los clientes, no por el nuestro.** Lo que hoy pinta bien
  en Outlook puede dejar de hacerlo. No hay guardia automática posible contra eso; lo que sí hay es la
  restricción de escribir solo el subconjunto conservador (tablas de maquetación, estilos en línea)
  que SPEC-056 fija y mide.
- **Tentación futura, y queda cerrada aquí:** el siguiente que quiera un correo bonito pedirá una
  imagen de cabecera. El pto. 6 lo prohíbe. Si alguna vez se quiere, es **otro** ADR, con la
  discusión de alojamiento, bloqueo por defecto y telemetría hecha de nuevo.

## Alternativas consideradas

- **Sustituir `body: string` por `html: string`** (un solo cuerpo, ahora HTML). **Rechazada.** Deja
  sin alternativa a los clientes y a las personas que leen en texto y —peor para nosotros— rompe de
  golpe `tests/password-reset.test.ts` y `tests/e2e/recuperacion.spec.ts`, que sacan el enlace de
  reset del texto. Cambiarlos a parsear HTML sería sustituir una lectura trivial y estable por una
  frágil, para observar peor.
- **Renombrar el campo a `text` y añadir `html`** (`{ text, html? }`). **Rechazada por ahora, y no
  por gusto:** es el nombre correcto, pero obliga a tocar los tres adaptadores, `service.ts`,
  `password-reset.ts` y varios ficheros de test, todo ello **sin cambiar ninguna conducta**. Un
  renombrado así merece su propio cambio, aislado, donde un fallo signifique lo que dice. Queda como
  follow-up de higiene en SPEC-056, no como parte de esta entrega.
- **Componer el HTML dentro de `ResendSender`.** **Rechazada, y es la alternativa peligrosa** porque
  parece la más limpia: «el adaptador conoce a su proveedor, que se apañe él». No se rechaza por
  intestable —con `fetchImpl` se le puede mirar la petición—, sino porque dejaría el diseño **solo en
  el camino de Resend**: ni el fake ni el buzón del e2e verían un byte de él, y cada adaptador futuro
  reescribiría la cabecera y el pie. El pto. 4 de este ADR existe para dejarlo escrito.
- **Un segundo método en el puerto (`sendHtml`).** **Rechazada.** Duplica el camino de envío y, con
  él, la resiliencia del pto. 5 de ADR-006 y la idempotencia de RN-14, que tendrían que mantenerse
  correctas **dos veces**. Un mensaje con dos representaciones es un mensaje, no dos envíos.
- **Adoptar React Email** (`@react-email/*`, la vía que la propia ADR-006 citaba como parte de la DX
  de Resend). **Rechazada para esta entrega.** Traería una dependencia y un paso de render para tres
  correos cuyo HTML hay que afinar a mano contra el motor de Word igualmente; y un componente JSX se
  afirma peor en un test que un `string`. Si algún día son quince correos con variantes, se reabre — y
  entonces será un ADR con su propio motivo, no un arrastre de éste.
- **Componer nosotros el `multipart/alternative` y sus cabeceras MIME.** **Rechazada.** Es exactamente
  el trabajo que el proveedor hace y que el puerto existe para ocultar: subir MIME al dominio ataría
  el contrato a un detalle de transporte que ADR-006 puso deliberadamente del otro lado de la
  frontera.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
