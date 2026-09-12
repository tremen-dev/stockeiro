import type { ContextoDeSimbolo } from './service';

/**
 * SPEC-063 CA-10 — **lo que dice la señal de contexto, en palabras**.
 *
 * Vive aquí, en un módulo puro, y no junto a la celda que la pinta, por dos motivos: se
 * puede probar sin arrastrar media aplicación —la celda importa acciones de servidor, que
 * traen Auth.js detrás—, y deja claro que la frase es **del dominio** y no decoración de
 * una pantalla.
 *
 * Se escribe entera y no se compone de trozos («nota» + «2 enlaces») porque quien escucha
 * recibe **una frase**, no una lista de etiquetas sueltas — y porque el singular y el
 * plural de «enlace» no se resuelven concatenando.
 */
export function textoDeContexto(contexto: ContextoDeSimbolo): string {
  const enlaces = contexto.enlaces.length;
  const conEnlaces = enlaces === 1 ? 'y 1 enlace' : `y ${enlaces} enlaces`;
  if (contexto.note !== null) {
    return enlaces === 0 ? 'Tiene nota tuya' : `Tiene nota tuya ${conEnlaces}`;
  }
  return enlaces === 1 ? 'Tiene 1 enlace tuyo' : `Tiene ${enlaces} enlaces tuyos`;
}
