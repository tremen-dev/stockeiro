"""Regenera docs/tablero.md derivandolo del frontmatter, como haria scripts/tablero.mjs
(que no esta instalado en esta maquina). No inventa nada: todo sale de los documentos.

Uso:  python gen_tablero.py [--fecha AAAA-MM-DD] [--check]
  --check  escribe en /tmp/tablero-generado.md para diffear antes de tocar nada.
"""
import io, os, re, sys, glob

RAIZ = '.'


def frontmatter(ruta):
    txt = io.open(ruta, encoding='utf-8').read()
    if not txt.startswith('---'):
        return {}, txt
    fin = txt.index('\n---', 3)
    cabecera = txt[3:fin]
    datos = {}
    historial = []
    en_historial = False
    for linea in cabecera.splitlines():
        if linea.startswith('historial:'):
            en_historial = True
            continue
        if en_historial:
            m = re.match(r'\s*-\s*\{(.*)\}\s*$', linea)
            if m:
                entrada = {}
                # {estado: x, fecha: y, por: z} — `por` puede llevar comas dentro.
                cuerpo = m.group(1)
                for clave in ('estado', 'fecha', 'por'):
                    mm = re.search(clave + r':\s*(.*?)(?:,\s*(?:estado|fecha|por):|$)', cuerpo)
                    if mm:
                        entrada[clave] = mm.group(1).strip()
                historial.append(entrada)
                continue
            en_historial = False
        m = re.match(r'([a-zA-Z-]+):\s*(.*)$', linea)
        if m:
            datos[m.group(1)] = m.group(2).strip()
    datos['historial'] = historial
    return datos, txt


def ultimo_cambio(datos):
    h = datos.get('historial') or []
    if not h:
        return ''
    u = h[-1]
    return '%s (%s)' % (u.get('fecha', ''), u.get('por', ''))


def slug_de(nombre, prefijo):
    base = nombre[:-3] if nombre.endswith('.md') else nombre
    return base[len(prefijo):] if base.startswith(prefijo) else base


def main():
    fecha = '2026-09-13'
    if '--fecha' in sys.argv:
        fecha = sys.argv[sys.argv.index('--fecha') + 1]

    salida = []
    salida.append('<!-- GENERADO por tremen-sdd (scripts/tablero.mjs). NO EDITAR A MANO. -->')
    salida.append('# Tablero')
    salida.append('')
    salida.append('Actualizado: %s' % fecha)
    salida.append('')

    conteo = {}
    epicas = sorted(
        d for d in os.listdir(os.path.join(RAIZ, 'docs', 'epicas'))
        if os.path.isdir(os.path.join(RAIZ, 'docs', 'epicas', d))
    )
    for dirname in epicas:
        ruta = os.path.join(RAIZ, 'docs', 'epicas', dirname)
        epica_md = os.path.join(ruta, '_epica.md')
        datos, _ = frontmatter(epica_md) if os.path.exists(epica_md) else ({}, '')
        eid = datos.get('id') or dirname.split('-')[0] + '-' + dirname.split('-')[1]
        slug = slug_de(dirname, eid + '-')
        titulo = '## %s%s (%s)' % (eid, (' — ' + slug) if slug != dirname else '', datos.get('estado', ''))
        salida.append(titulo)
        salida.append('')
        salida.append('| Spec | Estado | Último cambio |')
        salida.append('|---|---|---|')
        for f in sorted(os.listdir(ruta)):
            if not f.startswith('SPEC-') or not f.endswith('.md') or f.endswith('.ledger.md'):
                continue
            d, _ = frontmatter(os.path.join(ruta, f))
            sid = d.get('id', f[:8])
            estado = d.get('estado', '')
            conteo[estado] = conteo.get(estado, 0) + 1
            salida.append('| %s — %s | %s | %s |' % (sid, slug_de(f, sid + '-'), estado, ultimo_cambio(d)))
        salida.append('')

    salida.append('## ADRs')
    salida.append('')
    salida.append('| ADR | Estado | Título | Último cambio |')
    salida.append('|---|---|---|---|')
    for f in sorted(os.listdir(os.path.join(RAIZ, 'docs', 'adr'))):
        if not f.startswith('ADR-') or not f.endswith('.md'):
            continue
        d, _ = frontmatter(os.path.join(RAIZ, 'docs', 'adr', f))
        aid = d.get('id', f[:7])
        salida.append('| %s | %s | %s | %s |' % (aid, d.get('estado', ''), slug_de(f, aid + '-'), ultimo_cambio(d)))
    salida.append('')

    salida.append('## Resumen')
    salida.append('')
    for estado in ('hecho', 'aprobada', 'bloqueada', 'en-revision', 'en-progreso', 'borrador', 'RED'):
        if conteo.get(estado):
            salida.append('- %s: %d' % (estado, conteo[estado]))
    salida.append('')

    texto = '\n'.join(salida)
    destino = '/tmp/tablero-generado.md' if '--check' in sys.argv else os.path.join(RAIZ, 'docs', 'tablero.md')
    io.open(destino, 'w', encoding='utf-8', newline='').write(texto)
    print('escrito en', destino)


main()
