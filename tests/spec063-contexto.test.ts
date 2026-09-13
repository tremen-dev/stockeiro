import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol, unwatch } from '@/lib/watchlist/service';
import { zoneStatusForUser } from '@/lib/watchlist/zone-status';
import { purgeUserData, ACCOUNT_DELETION_COVERAGE } from '@/lib/account/deletion';
import { symbolLinks, symbolNotes, symbols } from '@/db/schema';
import {
  anadirEnlace,
  contextoDeSimbolo,
  contextosDeUsuario,
  guardarNota,
  quitarEnlace,
  simboloDeVigiladaPropia,
  tieneContexto,
} from '@/lib/contexto/service';
import {
  LIMITE_ENLACES_POR_SIMBOLO,
  LIMITE_NOTA_CARACTERES,
} from '@/lib/config/limites-contexto';

/**
 * SPEC-063 — **el modelo**: una nota por usuario y símbolo, varios enlaces en orden
 * estable, aislado, y con el borrado en su sitio.
 *
 * Lo que más se defiende aquí es **CA-4**, que es la razón de que esto cuelgue del símbolo
 * y no de la vigilada: **quitar de vigiladas no borra el análisis de su dueño**, y lo
 * único que se lo lleva es borrar la cuenta.
 */

let db: TestDb;
let userA: string;
let userB: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
  userB = (await registerUser(db, 'b@example.com', 'clave')).id;
});

const mercado = { micCode: 'BMEX', exchange: 'BME' };

/** Da de alta una vigilada y devuelve el par (id de fila, id de símbolo). */
async function vigilar(userId: string, ticker = 'ITX') {
  const fila = await watchSymbol(db, userId, ticker, 'EUR', { buyMin: 20, buyMax: 25 }, mercado);
  return { watchedId: fila.id, symbolId: fila.symbolId };
}

describe('SPEC-063 CA-2: una nota por usuario y símbolo; enlaces en orden estable', () => {
  it('escribir dos veces SUSTITUYE la nota, no la duplica', async () => {
    const { symbolId } = await vigilar(userA);

    await guardarNota(db, userA, symbolId, 'primera версия');
    await guardarNota(db, userA, symbolId, 'la buena');

    const filas = await db.select().from(symbolNotes).where(eq(symbolNotes.userId, userA));
    expect(filas).toHaveLength(1);
    expect((await contextoDeSimbolo(db, userA, symbolId)).note).toBe('la buena');
  });

  it('los enlaces salen siempre en el mismo orden, y añadir uno no reordena los de antes', async () => {
    const { symbolId } = await vigilar(userA);
    await anadirEnlace(db, userA, symbolId, 'https://uno.example.com', 'Uno');
    await anadirEnlace(db, userA, symbolId, 'https://dos.example.com', 'Dos');

    const primera = await contextoDeSimbolo(db, userA, symbolId);
    const segunda = await contextoDeSimbolo(db, userA, symbolId);
    expect(primera.enlaces.map((e) => e.label)).toEqual(['Uno', 'Dos']);
    expect(segunda.enlaces.map((e) => e.label)).toEqual(primera.enlaces.map((e) => e.label));

    await anadirEnlace(db, userA, symbolId, 'https://tres.example.com', 'Tres');
    const tercera = await contextoDeSimbolo(db, userA, symbolId);
    expect(tercera.enlaces.map((e) => e.label)).toEqual(['Uno', 'Dos', 'Tres']);
  });

  it('quitar el del medio no descoloca a los demás', async () => {
    const { symbolId } = await vigilar(userA);
    for (const n of ['Uno', 'Dos', 'Tres']) {
      await anadirEnlace(db, userA, symbolId, `https://${n.toLowerCase()}.example.com`, n);
    }
    const antes = await contextoDeSimbolo(db, userA, symbolId);
    await quitarEnlace(db, userA, antes.enlaces[1].id);

    const despues = await contextoDeSimbolo(db, userA, symbolId);
    expect(despues.enlaces.map((e) => e.label)).toEqual(['Uno', 'Tres']);
  });
});

describe('SPEC-063 CA-3: es de un solo usuario, y ninguna lectura lo cruza', () => {
  it('dos usuarios con el MISMO símbolo leen cada uno lo suyo', async () => {
    const a = await vigilar(userA);
    const b = await vigilar(userB);
    expect(a.symbolId).toBe(b.symbolId); // el símbolo es compartido (ADR-007)

    await guardarNota(db, userA, a.symbolId, 'la de A');
    await guardarNota(db, userB, b.symbolId, 'la de B');
    await anadirEnlace(db, userA, a.symbolId, 'https://a.example.com');

    expect((await contextoDeSimbolo(db, userA, a.symbolId)).note).toBe('la de A');
    expect((await contextoDeSimbolo(db, userB, b.symbolId)).note).toBe('la de B');
    expect((await contextoDeSimbolo(db, userB, b.symbolId)).enlaces).toHaveLength(0);
  });

  it('quitar un enlace ajeno no borra nada, y no dice que exista', async () => {
    const a = await vigilar(userA);
    await anadirEnlace(db, userA, a.symbolId, 'https://a.example.com', 'El de A');
    const [suyo] = (await contextoDeSimbolo(db, userA, a.symbolId)).enlaces;

    await quitarEnlace(db, userB, suyo.id); // B lo intenta con el id real de A

    expect((await contextoDeSimbolo(db, userA, a.symbolId)).enlaces).toHaveLength(1);
  });

  it('escribir contexto sobre una fila ajena es imposible: la traducción filtra por dueño', async () => {
    const a = await vigilar(userA);
    expect(await simboloDeVigiladaPropia(db, userA, a.watchedId)).toBe(a.symbolId);
    // El mismo id de fila, pedido por otro: indistinguible de que no exista.
    expect(await simboloDeVigiladaPropia(db, userB, a.watchedId)).toBeNull();
  });
});

describe('SPEC-063 CA-4: quitar de vigiladas NO borra; borrar la cuenta SÍ', () => {
  it('dejar de vigilar conserva la nota y los enlaces, y volver a vigilar los devuelve', async () => {
    const { watchedId, symbolId } = await vigilar(userA);
    await guardarNota(db, userA, symbolId, 'por qué la sigo');
    await anadirEnlace(db, userA, symbolId, 'https://foro.example.com', 'El hilo');

    await unwatch(db, userA, watchedId);
    expect(await zoneStatusForUser(db, userA)).toEqual([]);

    // Sigue ahí mientras no está vigilada…
    const enElLimbo = await contextoDeSimbolo(db, userA, symbolId);
    expect(enElLimbo.note).toBe('por qué la sigo');
    expect(enElLimbo.enlaces).toHaveLength(1);

    // …y vuelve tal cual al volver a vigilarla.
    const otraVez = await vigilar(userA);
    expect(otraVez.symbolId).toBe(symbolId);
    const recuperado = await contextoDeSimbolo(db, userA, symbolId);
    expect(recuperado.note).toBe('por qué la sigo');
    expect(recuperado.enlaces.map((e) => e.label)).toEqual(['El hilo']);
  });

  it('borrar la cuenta se lo lleva entero — y no toca lo compartido ni lo del vecino', async () => {
    const a = await vigilar(userA);
    const b = await vigilar(userB);
    await guardarNota(db, userA, a.symbolId, 'la de A');
    await anadirEnlace(db, userA, a.symbolId, 'https://a.example.com');
    await guardarNota(db, userB, b.symbolId, 'la de B');

    await purgeUserData(db, userA);

    expect(await db.select().from(symbolNotes).where(eq(symbolNotes.userId, userA))).toHaveLength(0);
    expect(await db.select().from(symbolLinks).where(eq(symbolLinks.userId, userA))).toHaveLength(0);
    // Lo compartido sigue (ADR-022) y lo del vecino no se ha movido.
    expect((await db.select().from(symbols)).length).toBeGreaterThan(0);
    expect((await contextoDeSimbolo(db, userB, b.symbolId)).note).toBe('la de B');
  });

  it('las dos tablas están declaradas en el censo de borrado, con su explicación para el usuario', () => {
    const tablas = ACCOUNT_DELETION_COVERAGE.map((c) => c.table);
    expect(tablas).toContain('symbol_notes');
    expect(tablas).toContain('symbol_links');
    for (const t of ['symbol_notes', 'symbol_links']) {
      const fila = ACCOUNT_DELETION_COVERAGE.find((c) => c.table === t)!;
      expect(fila.via).toBe('delete');
      expect(fila.label.length).toBeGreaterThan(10);
    }
  });
});

describe('SPEC-063 CA-6: borrar es explícito, y la nota y los enlaces son dos cosas', () => {
  it('vaciar la nota la borra y NO toca los enlaces', async () => {
    const { symbolId } = await vigilar(userA);
    await guardarNota(db, userA, symbolId, 'algo');
    await anadirEnlace(db, userA, symbolId, 'https://a.example.com');

    await guardarNota(db, userA, symbolId, '   ');

    const c = await contextoDeSimbolo(db, userA, symbolId);
    expect(c.note).toBeNull();
    expect(c.enlaces).toHaveLength(1);
    // Y no queda una fila en blanco: nota vacía y no tener nota son lo mismo.
    expect(await db.select().from(symbolNotes).where(eq(symbolNotes.userId, userA))).toHaveLength(0);
  });

  it('quitar todos los enlaces NO borra la nota', async () => {
    const { symbolId } = await vigilar(userA);
    await guardarNota(db, userA, symbolId, 'se queda');
    await anadirEnlace(db, userA, symbolId, 'https://a.example.com');
    const [uno] = (await contextoDeSimbolo(db, userA, symbolId)).enlaces;

    await quitarEnlace(db, userA, uno.id);

    const c = await contextoDeSimbolo(db, userA, symbolId);
    expect(c.enlaces).toHaveLength(0);
    expect(c.note).toBe('se queda');
  });
});

describe('SPEC-063 CA-14: los topes se aplican en el servidor, no en la pantalla', () => {
  it('una nota por encima del tope se rechaza, y una del tamaño del tope entra', async () => {
    const { symbolId } = await vigilar(userA);

    const pasada = await guardarNota(db, userA, symbolId, 'x'.repeat(LIMITE_NOTA_CARACTERES + 1));
    expect(pasada).toMatchObject({ ok: false, motivo: 'nota_demasiado_larga' });
    expect((await contextoDeSimbolo(db, userA, symbolId)).note).toBeNull();

    const justa = await guardarNota(db, userA, symbolId, 'x'.repeat(LIMITE_NOTA_CARACTERES));
    expect(justa).toEqual({ ok: true });
    expect((await contextoDeSimbolo(db, userA, symbolId)).note).toHaveLength(LIMITE_NOTA_CARACTERES);
  });

  it('el enlace número LIMITE + 1 se rechaza contando lo que hay, y el mensaje dice qué hacer', async () => {
    const { symbolId } = await vigilar(userA);
    for (let i = 0; i < LIMITE_ENLACES_POR_SIMBOLO; i += 1) {
      expect(await anadirEnlace(db, userA, symbolId, `https://e${i}.example.com`)).toEqual({ ok: true });
    }

    const uno_de_mas = await anadirEnlace(db, userA, symbolId, 'https://uno-mas.example.com');
    expect(uno_de_mas).toMatchObject({ ok: false, motivo: 'demasiados_enlaces' });
    expect((await contextoDeSimbolo(db, userA, symbolId)).enlaces).toHaveLength(
      LIMITE_ENLACES_POR_SIMBOLO,
    );

    // Y el tope es POR SÍMBOLO, no por usuario: en otra acción sigue habiendo sitio.
    const otra = await vigilar(userA, 'TEF');
    expect(await anadirEnlace(db, userA, otra.symbolId, 'https://otra.example.com')).toEqual({ ok: true });
  });

  it('quitar uno vuelve a abrir hueco', async () => {
    const { symbolId } = await vigilar(userA);
    for (let i = 0; i < LIMITE_ENLACES_POR_SIMBOLO; i += 1) {
      await anadirEnlace(db, userA, symbolId, `https://e${i}.example.com`);
    }
    const [primero] = (await contextoDeSimbolo(db, userA, symbolId)).enlaces;
    await quitarEnlace(db, userA, primero.id);

    expect(await anadirEnlace(db, userA, symbolId, 'https://hueco.example.com')).toEqual({ ok: true });
  });
});

describe('SPEC-063 CA-9: la señal de la lista sale de lo mismo que el panel', () => {
  it('con nota, con enlaces, con las dos cosas y con ninguna', async () => {
    const conNota = await vigilar(userA, 'AAA');
    const conEnlace = await vigilar(userA, 'BBB');
    const conAmbas = await vigilar(userA, 'CCC');
    const pelada = await vigilar(userA, 'DDD');

    await guardarNota(db, userA, conNota.symbolId, 'nota');
    await anadirEnlace(db, userA, conEnlace.symbolId, 'https://a.example.com');
    await guardarNota(db, userA, conAmbas.symbolId, 'nota');
    await anadirEnlace(db, userA, conAmbas.symbolId, 'https://b.example.com');

    const filas = await zoneStatusForUser(db, userA);
    const contextos = await contextosDeUsuario(db, userA, filas.map((f) => f.symbolId));

    expect(tieneContexto(contextos.get(conNota.symbolId))).toBe(true);
    expect(tieneContexto(contextos.get(conEnlace.symbolId))).toBe(true);
    expect(tieneContexto(contextos.get(conAmbas.symbolId))).toBe(true);
    // La otra dirección: sin contexto, NO hay entrada — y `tieneContexto` lo dice.
    expect(contextos.has(pelada.symbolId)).toBe(false);
    expect(tieneContexto(contextos.get(pelada.symbolId))).toBe(false);

    expect(contextos.get(conAmbas.symbolId)).toMatchObject({ note: 'nota' });
    expect(contextos.get(conAmbas.symbolId)!.enlaces).toHaveLength(1);
  });

  it('la señal y el panel salen de la misma lectura: no pueden discrepar', async () => {
    const { symbolId } = await vigilar(userA);
    await guardarNota(db, userA, symbolId, 'una');
    await anadirEnlace(db, userA, symbolId, 'https://a.example.com', 'A');

    const enLaLista = (await contextosDeUsuario(db, userA, [symbolId])).get(symbolId)!;
    const enElPanel = await contextoDeSimbolo(db, userA, symbolId);

    expect(enLaLista.note).toBe(enElPanel.note);
    expect(enLaLista.enlaces).toEqual(enElPanel.enlaces);
  });
});

describe('SPEC-063 CA-1: el esquema es aditivo y la migración no destruye nada', () => {
  it('la migración de esta spec solo CREA: ni drop, ni alter de columna existente', () => {
    const sql = readFileSync('drizzle/0011_symbol_notes_and_links.sql', 'utf8').toUpperCase();
    expect(sql).toContain('CREATE TABLE "SYMBOL_NOTES"');
    expect(sql).toContain('CREATE TABLE "SYMBOL_LINKS"');
    expect(sql).not.toMatch(/\bDROP\b/);
    expect(sql).not.toMatch(/ALTER TABLE "(?!SYMBOL_NOTES|SYMBOL_LINKS)/);
  });

  it('y las tablas de siempre siguen aceptando lo de siempre', async () => {
    // Si la migración hubiera tocado algo vivo, esto sería lo primero en caerse.
    const { watchedId } = await vigilar(userA);
    expect(watchedId).toBeTruthy();
    const [fila] = await zoneStatusForUser(db, userA);
    expect(fila.ticker).toBe('ITX');
    expect(fila.buyMin).toBe('20');
  });
});
