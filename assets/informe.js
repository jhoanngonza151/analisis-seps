/* Morosidad de Jaspe Ltda. frente al segmento 4.
   Todas las cifras del informe se calculan aquí a partir de data/*.js; ninguna está escrita a mano.

   Orden del archivo:
     1. utilidades (formato, estadística, DOM)
     2. modelo: lo que el informe muestra para cada corte
     3. componentes de gráfico (líneas, columnas, distribución, tendencia)
     4. vistas: portada y secciones
     5. corte activo, navegación e impresión */
(function () {
"use strict";

var SEPS = window.SEPS;
var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre"];
var MES3 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep"];
var COLOR = {
  jaspe: "#3b5bff", jaspeMedio: "#6f86ff", jaspeClaro: "#9fb0ff", mediana: "#8b90a7", atencion: "#e8590c", favorable: "#0ca678",
  suave: "#c9cee3", barra: "#d5d9ea", regla: "#e7e9f3", eje: "#d2d6e6", tinta: "#1b1f3b", tinta3: "#6b7090", papel: "#ffffff"
};
var SVGNS = "http://www.w3.org/2000/svg";

/* ====================================================================
   1. Utilidades
   ==================================================================== */
function num(v, d) {
  if (d === undefined) d = 2;
  return v.toLocaleString("es-EC", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function pct(v, d) { return num(v, d) + " %"; }
function usd(v) { return num(v, 0) + " USD"; }
function mil(v) { return num(v / 1000, 0) + " mil"; }
function signo(v, d) { return (v > 0 ? "+" : v < 0 ? "−" : "") + num(Math.abs(v), d); }
function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
function lista(a) { return a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " y " + a[a.length - 1]; }
function plano(t) { return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

function mediana(a) {
  var o = a.slice().sort(function (x, y) { return x - y; }), n = o.length;
  if (!n) return 0;
  return n % 2 ? o[(n - 1) / 2] : (o[n / 2 - 1] + o[n / 2]) / 2;
}
function cuantil(a, q) {
  var o = a.slice().sort(function (x, y) { return x - y; });
  return o[Math.min(o.length - 1, Math.round(q * (o.length - 1)))];
}
function suma(a, f) { return a.reduce(function (t, r) { return t + f(r); }, 0); }
function mora(r) { return r.i / r.b * 100; }
function moraMic(r) { return r.mb > 0 ? r.mi / r.mb * 100 : null; }
function moraCon(r) { return r.cb > 0 ? r.ci / r.cb * 100 : null; }
function pasoLimpio(rango, n) {
  var bruto = rango / n, mag = Math.pow(10, Math.floor(Math.log(bruto) / Math.LN10)), r = bruto / mag;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
}

function h(tag, attrs, hijos) {
  var e = document.createElement(tag), k;
  for (k in attrs) { if (k === "text") e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); }
  (hijos || []).forEach(function (c) { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
  return e;
}
function s(tag, attrs, texto) {
  var e = document.createElementNS(SVGNS, tag), k;
  for (k in attrs) e.setAttribute(k, attrs[k]);
  if (texto !== undefined) e.textContent = texto;
  return e;
}
function vaciar(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }
function $(id) { return document.getElementById(id); }

/* ====================================================================
   2. Modelo
   ==================================================================== */
function comun(ent, J) {
  var todas = ent.map(mora);
  var orden = ent.slice().sort(function (a, b) { return mora(a) - mora(b); });
  var mic = ent.filter(function (r) { return r.mb > 0; });
  var con = ent.filter(function (r) { return r.cb > 0; });
  var med = mediana(todas);
  var peso = J.mb / J.b;
  var cerca = function (tol) { return ent.filter(function (r) { return Math.abs(r.mb / r.b - peso) <= tol; }); };
  return {
    ent: ent, orden: orden, J: J, N: ent.length, mora: mora(J), med: med, brecha: mora(J) - med,
    puesto: orden.indexOf(J) + 1,
    mic: moraMic(J), medMic: mediana(mic.map(moraMic)), nMic: mic.length,
    con: moraCon(J), medCon: mediana(con.map(moraCon)), nCon: con.length,
    pesoMicEnImp: J.mi / J.i * 100,
    // morosidad de microcrédito con la que la mora total igualaría la mediana, lo demás constante
    micObjetivo: (med / 100 * J.b - J.ci) / J.mb * 100,
    tope: 20, sobreTope: todas.filter(function (v) { return v > 20; }).length,
    maxMora: Math.max.apply(null, todas), p90: cuantil(todas, 0.9),
    promedio: suma(todas, function (v) { return v; }) / todas.length,
    agregada: suma(ent, function (r) { return r.i; }) / suma(ent, function (r) { return r.b; }) * 100,
    nMezcla: cerca(0.125).length, medMezcla: mediana(cerca(0.125).map(mora)), medMezcla15: mediana(cerca(0.15).map(mora))
  };
}

function modeloSep() {
  var d = SEPS.sep, ent = d.entidades, jas = d.jaspe, ult = jas.length - 1;
  var J = ent.filter(function (r) { return r.J === 1; })[0];
  var m = comun(ent, J);
  var serieJ = jas.map(function (x) { return x.i / x.b * 100; });
  var serieMed = d.mensual.map(function (mes) { return mediana(mes.map(function (p) { return p[1] / p[0] * 100; })); });
  var serieCob = jas.map(function (x) { return x.pv / x.i * 100; });
  var pico = serieJ.indexOf(Math.max.apply(null, serieJ));
  var p = jas[pico], u = jas[ult], tri = jas[ult - 3];
  var conCarteraPico = u.i / p.b * 100;
  var conImp = ent.filter(function (r) { return r.i > 0; });
  var col = function (k) { return jas.map(function (x) { return x[k]; }); };

  m.id = "sep"; m.mes = "septiembre"; m.fecha = "30 de septiembre de 2026";
  m.fuente = "SEPS, estados financieros mensuales, enero a septiembre de 2026";
  m.fuenteCorta = "SEPS, estados financieros mensuales";
  m.etiquetas = MES3.slice(0, ult + 1); m.etiquetasLargas = MESES.slice(0, ult + 1);
  m.serieJ = serieJ; m.serieMed = serieMed; m.serieCob = serieCob;
  m.serieBrecha = serieJ.map(function (v, i) { return v - serieMed[i]; });
  m.saldos = jas; m.ult = ult; m.pico = pico;
  m.baja = serieJ[pico] - serieJ[ult]; m.bajaMed = serieMed[pico] - serieMed[ult];

  // Descomposición de la baja: cuánto aporta el numerador y cuánto el denominador.
  m.conCarteraPico = conCarteraPico;
  m.porCartera = conCarteraPico - serieJ[ult];
  m.porImproductiva = serieJ[pico] - conCarteraPico;
  m.saldoPico = p; m.saldoUlt = u;
  m.crecCartera = (u.b / p.b - 1) * 100; m.bajaImpUsd = p.i - u.i; m.bajaImpPct = (1 - u.i / p.i) * 100;
  // Último trimestre
  m.mesTrim = ult - 3; m.varImpTrim = u.i - tri.i; m.crecTrim = (u.b / tri.b - 1) * 100; m.moraConCarteraTrim = u.i / tri.b * 100;

  // Castigos
  var CA = col("ca"), dCas = CA[ult] - CA[0];
  m.castigos = CA; m.subeCastigos = dCas; m.bajaImpDesdeEnero = jas[0].i - u.i;
  m.saltos = CA.map(function (v, i) { return i > 0 && v - CA[i - 1] > dCas * 0.15; });
  m.mesesSalto = MESES.filter(function (_, i) { return m.saltos[i]; });
  m.moraSinCastigos = (u.i + dCas) / (u.b + dCas) * 100;
  var rCas = ent.map(function (r) { return r.ca / r.b * 100; });
  m.castigosSobreCartera = J.ca / J.b * 100; m.medCastigos = mediana(rCas); m.p90Castigos = cuantil(rCas, 0.9);

  // Envejecimiento
  m.noDevenga = col("nd"); m.vencida = col("vn");
  m.subeVencida = (u.vn / jas[0].vn - 1) * 100; m.bajaNoDevenga = (1 - u.nd / jas[0].nd) * 100;
  m.pesoVencidaIni = jas[0].vn / jas[0].i * 100; m.pesoVencida = u.vn / u.i * 100;
  m.medPesoVencida = mediana(conImp.map(function (r) { return r.vn / r.i * 100; }));

  // Refinanciada y reestructurada
  m.refVigente = col("rv"); m.refImp = col("ri");
  m.bajaRefVigente = (1 - u.rv / jas[0].rv) * 100; m.pesoRefImp = u.ri / u.i * 100;
  var rRR = ent.map(function (r) { return r.rr / r.b * 100; });
  m.refSobreCartera = J.rr / J.b * 100; m.medRef = mediana(rRR);
  m.sinRef = ent.filter(function (r) { return r.rr < 1; }).length;

  // Cobertura
  m.cobertura = serieCob[ult]; m.minCob = serieCob.indexOf(Math.min.apply(null, serieCob));
  m.cruceCob = -1;
  for (var i = 1; i < serieCob.length; i++) if (serieCob[i] >= 100 && serieCob[i - 1] < 100) { m.cruceCob = i; break; }
  m.medCob = mediana(conImp.map(function (r) { return r.pv / r.i * 100; }));
  m.subeProvCruce = m.cruceCob > 0 ? jas[m.cruceCob].pv - jas[m.cruceCob - 1].pv : 0;

  m.crecConsumo = (J.cb / jas[0].cb - 1) * 100; m.crecConsumoDesde = "desde enero";

  // Universo
  m.nEnero = d.mensual[0].length;
  var veces = {};
  d.mensual.forEach(function (mes) { mes.forEach(function (q) { veces[q[2]] = (veces[q[2]] || 0) + 1; }); });
  var panel = d.mensual[ult].filter(function (q) { return veces[q[2]] === d.mensual.length; });
  m.nPanel = panel.length; m.medPanel = mediana(panel.map(function (q) { return q[1] / q[0] * 100; }));
  return m;
}

function modeloJun() {
  var ent = SEPS.jun.entidades;
  var J = ent.filter(function (r) { return r.n.toUpperCase().indexOf("JASPE") >= 0; })[0];
  var m = comun(ent, J);
  var conMar = ent.filter(function (r) { return r.pb; });
  var moraMar = function (r) { return r.pi / r.pb * 100; };
  m.id = "jun"; m.mes = "junio"; m.fecha = "30 de junio de 2026";
  m.fuente = "SEPS, Boletín Financiero del Segmento 4, cortes de marzo y junio de 2026";
  m.fuenteCorta = "SEPS, Boletín Financiero del Segmento 4";
  m.etiquetas = ["mar", "jun"]; m.etiquetasLargas = ["marzo", "junio"];
  m.serieJ = [moraMar(J), m.mora]; m.serieMed = [mediana(conMar.map(moraMar)), m.med];
  m.saldos = [{ i: J.pi, b: J.pb }, { i: J.i, b: J.b }];
  m.ult = 1; m.pico = 0; m.baja = moraMar(J) - m.mora;
  m.enAmbos = conMar.length;
  m.enSegmento = SEPS.jun.segmento;   // cooperativas del segmento según el boletín, hayan reportado o no
  m.mejoraron = conMar.filter(function (r) { return mora(r) < moraMar(r); }).length;
  // mediana de las variaciones individuales, no variación de la mediana: son cantidades distintas
  m.varMediana = mediana(conMar.map(function (r) { return mora(r) - moraMar(r); }));
  m.crecConsumo = (J.cb / J.pcb - 1) * 100; m.crecConsumoDesde = "en el trimestre";
  // La cobertura no viene en el boletín: se toma del saldo mensual de junio si coincide con el boletín.
  var jj = SEPS.sep && SEPS.sep.jaspe[5];
  m.cobertura = jj && Math.abs(jj.b - J.b) < 0.01 && Math.abs(jj.i - J.i) < 0.01 ? jj.pv / jj.i * 100 : null;
  return m;
}

var MODELOS = { sep: modeloSep(), jun: modeloJun() };

/* ====================================================================
   3. Componentes de gráfico
   Todos dibujan al ancho real del contenedor y se redibujan si cambia.
   ==================================================================== */
function alRedimensionar(lienzo, dibujar) {
  dibujar();
  if (lienzo._ro) lienzo._ro.disconnect();
  if (!("ResizeObserver" in window)) return;
  var ultimo = lienzo.clientWidth;
  lienzo._ro = new ResizeObserver(function () {
    if (Math.abs(lienzo.clientWidth - ultimo) < 1) return;
    ultimo = lienzo.clientWidth; dibujar();
  });
  lienzo._ro.observe(lienzo);
}

/* Recuadro de lectura compartido: título, una fila por serie (el valor manda) y una línea de contexto. */
function crearPista(lienzo) {
  var el = h("div", { class: "pista-lectura", hidden: "" });
  lienzo.appendChild(el);
  return {
    mostrar: function (px, py, W, titulo, filas, extra) {
      vaciar(el);
      el.appendChild(h("div", { class: "t", text: titulo }));
      filas.forEach(function (f) {
        var llave = h("i", f.caja ? { class: "caja" } : {});
        llave.style[f.caja ? "background" : "borderTopColor"] = f.color;
        el.appendChild(h("div", { class: "f" }, [f.color ? llave : null, f.nombre, h("b", { text: f.valor })]));
      });
      if (extra) el.appendChild(h("div", { class: "x", text: extra }));
      el.hidden = false;
      var pw = el.offsetWidth, ph = el.offsetHeight, x = px + 14;
      if (x + pw > W) x = px - 14 - pw;
      if (x < 0) x = 0;
      var y = Math.max(0, py - ph / 2);
      el.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
    },
    ocultar: function () { el.hidden = true; }
  };
}

/* Recorrido de N posiciones con cursor, toque o teclado. */
function recorrer(svg, n, indiceDe, mostrar) {
  var activo = -1;
  function ir(i) { activo = i; mostrar(i); }
  function desde(ev) { ir(Math.max(0, Math.min(n - 1, indiceDe(ev)))); }
  svg.onpointermove = desde; svg.onpointerdown = desde;
  svg.onpointerleave = function (ev) { if (ev.pointerType === "mouse") ir(-1); };
  svg.onblur = function () { ir(-1); };
  svg.onkeydown = function (ev) {
    var i = activo < 0 ? n - 1 : activo;
    if (ev.key === "ArrowRight") i++; else if (ev.key === "ArrowLeft") i--;
    else if (ev.key === "Home") i = 0; else if (ev.key === "End") i = n - 1;
    else if (ev.key === "Escape") { ir(-1); return; } else return;
    ev.preventDefault(); ir(Math.max(0, Math.min(n - 1, i)));
  };
  return function () { return activo; };
}
function xEnSvg(svg, ev, W) {
  var caja = svg.getBoundingClientRect();
  return (ev.clientX - caja.left) / caja.width * W;
}

/* ---------- líneas ---------- */
function graficoLineas(lienzo, cfg) {
  var svg = s("svg", { role: "img", tabindex: "0", "aria-label": cfg.descripcion });
  vaciar(lienzo); lienzo.appendChild(svg);
  var pista = crearPista(lienzo);
  var n = cfg.etiquetas.length, fmt = cfg.fmt || pct, fmtEje = cfg.fmtEje || function (v) { return num(v, 0); };
  var activo = function () { return -1; };

  var todos = [];
  cfg.series.forEach(function (se) { todos = todos.concat(se.valores); });
  if (cfg.ref) todos.push(cfg.ref.valor);
  var vmin = Math.min.apply(null, todos), vmax = Math.max.apply(null, todos);
  var paso = cfg.paso || pasoLimpio(vmax - vmin, 4);
  var lo = Math.floor(vmin / paso) * paso, hi = Math.ceil(vmax / paso) * paso;
  if (vmin - lo < paso * 0.25) lo -= paso;
  if (lo < 0) lo = 0;

  alRedimensionar(lienzo, function () {
    var W = Math.max(260, Math.round(lienzo.clientWidth));
    var ancho = W >= 560;
    var H = cfg.alto || (ancho ? 300 : 240);
    var mg = { t: 18, r: ancho ? 132 : (cfg.finAncho || 62), b: 30, l: cfg.izq || 34 };
    var x0 = mg.l + (n === 2 ? 28 : 8), x1 = W - mg.r;
    var x = function (i) { return x0 + i * (x1 - x0) / (n - 1); };
    var y = function (v) { return mg.t + (hi - v) / (hi - lo) * (H - mg.t - mg.b); };
    vaciar(svg);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("height", H);

    for (var v = lo; v <= hi + 1e-9; v += paso) {
      var ty = Math.round(y(v)) + 0.5;
      svg.appendChild(s("line", { x1: mg.l, y1: ty, x2: x1, y2: ty, stroke: v === lo ? COLOR.eje : COLOR.regla, "stroke-width": 1 }));
      svg.appendChild(s("text", { x: mg.l - 8, y: ty + 4, "text-anchor": "end", class: "eje" }, fmtEje(v)));
    }
    if (cfg.ref) {
      var ry = Math.round(y(cfg.ref.valor)) + 0.5;
      svg.appendChild(s("line", { x1: mg.l, y1: ry, x2: x1, y2: ry, stroke: COLOR.tinta3, "stroke-width": 1 }));
      svg.appendChild(s("text", { x: mg.l + 6, y: ry - 6, class: "marca" }, ancho ? cfg.ref.texto : (cfg.ref.corto || cfg.ref.texto)));
    }
    cfg.etiquetas.forEach(function (e, i) {
      svg.appendChild(s("text", { x: x(i), y: H - 8, "text-anchor": "middle" }, n === 2 ? cfg.etiquetasLargas[i] + " 2026" : e));
    });
    var cursor = s("line", { y1: mg.t, y2: y(lo), stroke: COLOR.mediana, "stroke-width": 1, visibility: "hidden" });
    svg.appendChild(cursor);

    cfg.series.forEach(function (se) {
      var d = se.valores.map(function (val, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(val).toFixed(1); }).join(" ");
      var linea = s("path", { d: d, fill: "none", stroke: se.color, "stroke-width": se.enfasis ? 3 : 2, "stroke-linejoin": "round", "stroke-linecap": "round" });
      svg.appendChild(linea);
      if (cfg.animar && !lienzo._trazado) trazar(linea);
    });
    var fijo = function (k, j) { return j === n - 1 || n === 2 || (k === 0 && cfg.marcar === j); };
    var puntos = cfg.series.map(function (se, k) {
      return se.valores.map(function (val, j) {
        var c = s("circle", { cx: x(j), cy: y(val), r: 4, fill: se.color, stroke: COLOR.papel, "stroke-width": 2 });
        if (!fijo(k, j)) c.setAttribute("visibility", "hidden");
        svg.appendChild(c);
        return c;
      });
    });

    // rótulos directos al final de cada serie, separados si se acercan
    var fin = cfg.series.map(function (se) { return { se: se, y: y(se.valores[n - 1]) }; }).sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < fin.length; k++) if (fin[k].y - fin[k - 1].y < 18) fin[k].y = fin[k - 1].y + 18;
    fin.forEach(function (f) {
      var txt = (ancho && f.se.corto ? f.se.corto + " " : "") + fmt(f.se.valores[n - 1]);
      svg.appendChild(s("text", { x: x1 + 12, y: f.y + 4, class: "fin" + (f.se.enfasis ? " fuerte" : "") }, txt));
    });
    // rótulo selectivo: el extremo que cuenta la historia
    if (cfg.marcar !== undefined && cfg.marcar !== n - 1) {
      var mv = cfg.series[0].valores[cfg.marcar], abajo = cfg.marcarAbajo;
      svg.appendChild(s("text", { x: x(cfg.marcar) + (abajo ? 10 : 0), y: y(mv) + (abajo ? 14 : -11), "text-anchor": abajo || cfg.marcar === 0 ? "start" : "middle", class: "marca" },
        (cfg.marcarTexto || "") + fmt(mv)));
    }

    function mostrar(i) {
      puntos.forEach(function (fila, kk) {
        fila.forEach(function (c, j) {
          c.setAttribute("visibility", j === i || fijo(kk, j) ? "visible" : "hidden");
          c.setAttribute("r", j === i ? 5 : 4);
        });
      });
      if (i < 0) { cursor.setAttribute("visibility", "hidden"); pista.ocultar(); return; }
      cursor.setAttribute("x1", x(i)); cursor.setAttribute("x2", x(i)); cursor.setAttribute("visibility", "visible");
      pista.mostrar(x(i), y(cfg.series[0].valores[i]), W, cap(cfg.etiquetasLargas[i]) + " de 2026",
        cfg.series.map(function (se) { return { nombre: se.nombre, color: se.color, valor: (cfg.fmtPista || fmt)(se.valores[i]) }; }),
        cfg.extra ? cfg.extra(i) : null);
    }
    var previo = activo();
    activo = recorrer(svg, n, function (ev) { return Math.round((xEnSvg(svg, ev, W) - x0) / ((x1 - x0) / (n - 1))); }, mostrar);
    if (previo >= 0) mostrar(previo);
    lienzo._trazado = true;
  });
}

/* ---------- columnas (simples o apiladas) ---------- */
function barraArriba(x, y, w, alto, r) {
  r = Math.min(r, alto, w / 2);
  return "M" + x + " " + (y + alto) + "V" + (y + r) + "Q" + x + " " + y + " " + (x + r) + " " + y +
    "H" + (x + w - r) + "Q" + (x + w) + " " + y + " " + (x + w) + " " + (y + r) + "V" + (y + alto) + "Z";
}
function graficoColumnas(lienzo, cfg) {
  var svg = s("svg", { role: "img", tabindex: "0", "aria-label": cfg.descripcion });
  vaciar(lienzo); lienzo.appendChild(svg);
  var pista = crearPista(lienzo);
  var n = cfg.etiquetas.length;
  var totales = cfg.etiquetas.map(function (_, i) { return suma(cfg.pilas, function (p) { return p.valores[i]; }); });
  var vmax = Math.max.apply(null, totales), paso = pasoLimpio(vmax, 3), hi = Math.ceil(vmax * 1.04 / paso) * paso;

  alRedimensionar(lienzo, function () {
    var W = Math.max(260, Math.round(lienzo.clientWidth)), H = cfg.alto || 230;
    var mg = { t: 22, r: 8, b: 30, l: 54 };
    var banda = (W - mg.l - mg.r) / n, bw = Math.min(30, banda * 0.62);
    var y = function (v) { return mg.t + (hi - v) / hi * (H - mg.t - mg.b); };
    var base = y(0);
    vaciar(svg);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("height", H);
    var fondo = s("rect", { y: mg.t - 6, width: banda, height: base - mg.t + 6, fill: "#eef0fa", rx: 8, visibility: "hidden" });
    svg.appendChild(fondo);
    for (var v = 0; v <= hi + 1e-9; v += paso) {
      var ty = Math.round(y(v)) + 0.5;
      svg.appendChild(s("line", { x1: mg.l, y1: ty, x2: W - mg.r, y2: ty, stroke: v === 0 ? COLOR.eje : COLOR.regla, "stroke-width": 1 }));
      svg.appendChild(s("text", { x: mg.l - 8, y: ty + 4, "text-anchor": "end", class: "eje" }, cfg.fmtEje(v)));
    }

    cfg.etiquetas.forEach(function (e, i) {
      var cx = mg.l + banda * (i + 0.5), abajo = base;
      cfg.pilas.forEach(function (p, k) {
        var alto = base - y(p.valores[i]);
        var ultima = k === cfg.pilas.length - 1;
        var hueco = k > 0 ? 2 : 0;                      // separación entre segmentos en el color de la superficie
        var top = abajo - alto, color = cfg.colorDe ? cfg.colorDe(i, k) : p.color;
        if (alto - hueco > 0.5) {
          svg.appendChild(ultima
            ? s("path", { d: barraArriba(cx - bw / 2, top, bw, alto - hueco, 6), fill: color })
            : s("rect", { x: cx - bw / 2, y: top, width: bw, height: alto - hueco, fill: color }));
        }
        abajo = top;
      });
      svg.appendChild(s("text", { x: cx, y: H - 8, "text-anchor": "middle" }, e));
      if (cfg.rotular && cfg.rotular.indexOf(i) >= 0) {
        svg.appendChild(s("text", { x: cx, y: y(totales[i]) - 7, "text-anchor": "middle", class: i === n - 1 ? "fin fuerte" : "marca" }, cfg.fmtEje(totales[i])));
      }
    });

    recorrer(svg, n, function (ev) { return Math.floor((xEnSvg(svg, ev, W) - mg.l) / banda); }, function (i) {
      if (i < 0) { fondo.setAttribute("visibility", "hidden"); pista.ocultar(); return; }
      fondo.setAttribute("x", mg.l + banda * i); fondo.setAttribute("visibility", "visible");
      var filas = cfg.pilas.slice().reverse().map(function (p) {
        var k = cfg.pilas.indexOf(p);
        return { nombre: p.nombre, color: cfg.colorDe ? cfg.colorDe(i, k) : p.color, caja: true, valor: usd(p.valores[i]) };
      });
      if (cfg.pilas.length > 1) filas.push({ nombre: "Total", valor: usd(totales[i]) });
      pista.mostrar(mg.l + banda * (i + 0.5) + bw / 2, y(totales[i]) + 30, W, cap(cfg.etiquetasLargas[i]) + " de 2026", filas, cfg.extra ? cfg.extra(i) : null);
    });
  });
}

/* ---------- distribución: una barra por cooperativa, ordenadas ---------- */
function graficoDistribucion(lienzo, cfg) {
  var svg = s("svg", { role: "img", tabindex: "0",
    "aria-label": cfg.nombre + " de " + cfg.items.length + " cooperativas ordenadas de menor a mayor. Usa las flechas para recorrerlas." });
  vaciar(lienzo); lienzo.appendChild(svg);
  var pista = crearPista(lienzo);
  var items = cfg.items, n = items.length, TOPE = cfg.tope, jIdx = cfg.jIdx;

  alRedimensionar(lienzo, function () {
    var W = Math.max(260, Math.round(lienzo.clientWidth)), H = W >= 560 ? 300 : 230;
    var mg = { t: 34, r: 8, b: 30, l: 40 };
    var banda = (W - mg.l - mg.r) / n, bw = Math.max(banda - (banda > 3 ? 1.5 : 0.5), 0.8);
    var y = function (v) { return mg.t + (TOPE - Math.min(v, TOPE)) / TOPE * (H - mg.t - mg.b); };
    var base = y(0);
    vaciar(svg);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("height", H);
    for (var v = 0; v <= TOPE; v += 5) {
      var ty = Math.round(y(v)) + 0.5;
      svg.appendChild(s("line", { x1: mg.l, y1: ty, x2: W - mg.r, y2: ty, stroke: v === 0 ? COLOR.eje : COLOR.regla, "stroke-width": 1 }));
      svg.appendChild(s("text", { x: mg.l - 8, y: ty + 4, "text-anchor": "end", class: "eje" }, v === TOPE ? "≥ " + v : String(v)));
    }
    var r = Math.min(3, bw / 2);
    var barras = items.map(function (it, i) {
      var alto = Math.max(base - y(it.v), 0.5);
      var b = s("path", { d: barraArriba(+(mg.l + i * banda).toFixed(2), base - alto, +bw.toFixed(2), alto, r), fill: i === jIdx ? COLOR.jaspe : COLOR.barra });
      svg.appendChild(b);
      return b;
    });
    var my = Math.round(y(cfg.med)) + 0.5;
    svg.appendChild(s("line", { x1: mg.l, y1: my, x2: W - mg.r, y2: my, stroke: COLOR.tinta3, "stroke-width": 1, "stroke-dasharray": "4 3" }));
    svg.appendChild(s("text", { x: mg.l + 4, y: my - 6, class: "marca" }, "Mediana " + pct(cfg.med)));
    svg.appendChild(s("text", { x: mg.l, y: H - 8 }, "menor"));
    svg.appendChild(s("text", { x: W - mg.r, y: H - 8, "text-anchor": "end" }, "mayor"));
    var jx = mg.l + jIdx * banda + bw / 2, jy = y(items[jIdx].v);
    svg.appendChild(s("line", { x1: jx, y1: jy - 4, x2: jx, y2: jy - 16, stroke: COLOR.jaspe, "stroke-width": 2, "stroke-linecap": "round" }));
    var ancla = jx < mg.l + 60 ? "start" : jx > W - mg.r - 60 ? "end" : "middle";
    svg.appendChild(s("text", { x: jx, y: jy - 22, "text-anchor": ancla, class: "fin fuerte" }, "Jaspe " + pct(items[jIdx].v)));

    var previo = -1;
    recorrer(svg, n, function (ev) { return Math.floor((xEnSvg(svg, ev, W) - mg.l) / banda); }, function (i) {
      if (previo >= 0) barras[previo].setAttribute("fill", previo === jIdx ? COLOR.jaspe : COLOR.barra);
      previo = i;
      if (i < 0) { pista.ocultar(); return; }
      if (i !== jIdx) barras[i].setAttribute("fill", COLOR.tinta);
      pista.mostrar(mg.l + i * banda + bw, y(items[i].v), W, i === jIdx ? "Jaspe Ltda" : items[i].r.n,
        [{ nombre: cfg.nombre, valor: pct(items[i].v) }, { nombre: "Puesto", valor: (i + 1) + " de " + n }], "Cartera bruta " + usd(items[i].r.b));
    });
  });
}

/* ---------- minigráfico de tendencia ---------- */
function tendencia(valores, o) {
  o = o || {};
  var W = o.w || 96, H = o.h || 30, p = 5;
  var todos = o.ref === undefined ? valores : valores.concat([o.ref]);
  var lo = Math.min.apply(null, todos), hi = Math.max.apply(null, todos);
  var x = function (i) { return p + i * (W - 2 * p) / (valores.length - 1); };
  var y = function (v) { return p + (hi - v) / (hi - lo || 1) * (H - 2 * p); };
  var svg = s("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, "aria-hidden": "true", overflow: "visible" });
  if (o.ref !== undefined) svg.appendChild(s("line", { x1: 0, y1: y(o.ref), x2: W, y2: y(o.ref), stroke: COLOR.eje, "stroke-width": 1, "stroke-dasharray": "3 3" }));
  svg.appendChild(s("path", {
    d: valores.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" "),
    fill: "none", stroke: o.color || COLOR.mediana, "stroke-width": o.grosor || 2, "stroke-linejoin": "round", "stroke-linecap": "round"
  }));
  var u = valores.length - 1;
  svg.appendChild(s("circle", { cx: x(u), cy: y(valores[u]), r: (o.grosor || 2) + 2, fill: o.punto || COLOR.jaspe, stroke: o.fondo || COLOR.papel, "stroke-width": 2 }));
  return svg;
}

/* ---------- movimiento: solo al cargar, y solo si el lector no pidió reducirlo ---------- */
var QUIETO = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function trazar(linea) {
  if (QUIETO || !linea.getTotalLength || !linea.animate) return;
  var L = linea.getTotalLength();
  linea.style.strokeDasharray = L;
  var a = linea.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1100, easing: "cubic-bezier(.3,.6,.2,1)" });
  a.onfinish = function () { linea.style.strokeDasharray = ""; };
}
function contar(nodo, valor, texto) {
  if (QUIETO || !window.requestAnimationFrame) { nodo.textContent = texto(valor); return; }
  var t0 = null, dur = 900;
  nodo.textContent = texto(0);
  function paso(t) {
    if (t0 === null) t0 = t;
    var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    nodo.textContent = texto(k < 1 ? valor * e : valor);
    if (k < 1) requestAnimationFrame(paso);
  }
  requestAnimationFrame(paso);
}

/* ====================================================================
   4. Vistas
   ==================================================================== */
var pendientes;        // gráficos por dibujar una vez montado el DOM (necesitan el ancho real)

function tabla(cab, filas, clase) {
  var t = h("table", { class: "tabla" + (clase ? " " + clase : "") });
  t.appendChild(h("thead", {}, [h("tr", {}, cab.map(function (c) { return h("th", { scope: "col", text: c }); }))]));
  t.appendChild(h("tbody", {}, filas.map(function (f) {
    return h("tr", f.clase ? { class: f.clase } : {}, (f.celdas || f).map(function (c) { return h("td", { text: c }); }));
  })));
  return t;
}
function leyenda(items) {
  return h("div", { class: "leyenda" }, items.map(function (l) {
    var i = h("i", l[2] ? { class: "caja" } : {});
    i.style[l[2] ? "background" : "borderTopColor"] = l[1];
    return h("span", {}, [i, l[0]]);
  }));
}
function plegado(titulo, hijos, clase) {
  return h("details", { class: "plegado" + (clase ? " " + clase : "") }, [h("summary", { class: "enlace", text: titulo })].concat(hijos));
}
function grande(valor, unidad, clase) {
  return h("p", { class: clase || "grande" }, [valor, unidad ? h("small", { text: unidad }) : null]);
}
/* Figura: título que enuncia el hallazgo, gráfico y una frase de lectura.
   El contexto y la tabla con los mismos datos quedan plegados. */
function figura(o) {
  var lienzo = h("div", { class: "lienzo" });
  var fig = h("figure", { class: "carta figura" + (o.clase ? " " + o.clase : "") }, [
    o.signo ? h("p", { class: "etiqueta " + (o.signo > 0 ? "favor" : "contra"), text: o.signo > 0 ? "Favorable" : "Para seguimiento", style: "margin-bottom:10px" }) : null,
    h("h3", { text: o.titulo }),
    o.sub ? h("p", { class: "figura-sub", text: o.sub }) : null,
    o.leyenda ? leyenda(o.leyenda) : null,
    lienzo,
    o.lectura ? h("p", { class: "lectura", text: o.lectura }) : null,
    h("div", { class: "figura-pie" }, [
      h("p", { text: "Fuente: " + o.fuente }),
      o.detalle ? plegado("Más contexto", o.detalle.map(function (t) { return h("p", { text: t }); })) : null,
      o.datos ? plegado(o.datosTitulo || "Ver datos", [h("div", { class: "tabla-ancha" }, [tabla(o.datos[0], o.datos[1])])], "datos") : null
    ])
  ]);
  fig._dibujar = function () { if (o.dibujar) o.dibujar(lienzo); };
  return fig;
}
function seccion(clave, titulo, bajada, hijos, clase) {
  return h("section", { class: "seccion" + (clase ? " " + clase : ""), id: clave, "aria-labelledby": "h-" + clave }, [
    titulo ? h("div", { class: "seccion-cab" }, [h("h2", { id: "h-" + clave, text: titulo }), bajada ? h("p", { text: bajada }) : null]) : null
  ].concat(hijos));
}

/* ---------- portada ---------- */
function pintarPortada(m) {
  var serie = m.id === "sep";
  var acorta = m.serieJ[m.pico] - m.serieMed[m.pico] > m.brecha;   // la distancia con la mediana es menor que al inicio
  $("contexto").textContent = "Cooperativa Jaspe Ltda. Corte de " + m.mes + " de 2026";
  $("titulo").textContent = acorta ? "La mora baja y se acerca al segmento" : "La mora baja y mantiene su distancia con el segmento";
  var lede = vaciar($("lede"));
  lede.appendChild(document.createTextNode("En " + m.mes + " es "));
  lede.appendChild(h("b", { text: pct(m.mora) }));
  lede.appendChild(document.createTextNode(": " + num(m.brecha) + " puntos sobre la mediana de las " + m.N + " cooperativas del segmento 4. En " +
    MESES[serie ? m.pico : 2] + " era " + pct(m.serieJ[m.pico]) + "."));

  var caja = vaciar($("indicadores"));
  function kpi(rotulo, valor, texto, unidad, nota) {
    var n = document.createTextNode("");
    caja.appendChild(h("div", { class: "kpi" }, [h("p", { class: "kpi-rot", text: rotulo }),
      h("p", { class: "kpi-val" }, [n, unidad ? h("small", { text: unidad }) : null]), nota]));
    contar(n, valor, texto);
  }
  kpi("Mora total", m.mora, function (v) { return num(v); }, "%",
    h("p", { class: "kpi-nota" }, [h("span", { class: "ok", text: "↓ " + num(m.baja) + " pts" }), " desde " + MESES[serie ? m.pico : 2]]));
  kpi("Sobre la mediana", m.brecha, function (v) { return signo(v); }, "pp",
    h("p", { class: "kpi-nota", text: "Mediana del segmento: " + pct(m.med) }));
  var marca = h("i"); marca.style.left = ((m.puesto - 1) / (m.N - 1) * 100).toFixed(1) + "%";
  kpi("Puesto por morosidad", m.puesto, function (v) { return String(Math.round(v)); }, "de " + m.N,
    h("div", { class: "kpi-nota" }, [h("div", { class: "kpi-pista" }, [marca]), "De menor a mayor mora"]));
  if (m.cobertura !== null) kpi("Cobertura de provisiones", m.cobertura, function (v) { return num(v, 1); }, "%",
    h("p", { class: "kpi-nota", text: serie ? pct(m.serieCob[m.minCob], 1) + " en " + MESES[m.minCob] : "Provisiones sobre cartera improductiva" }));
}

/* ---------- Resumen ---------- */
function secResumen(m) {
  var serie = m.id === "sep";
  var fig = figura({
    titulo: serie ? "Mora total, mes a mes" : "Mora total, marzo y junio",
    sub: "En % de la cartera bruta. Jaspe frente a la mediana del segmento 4.",
    leyenda: [["Jaspe", COLOR.jaspe], ["Mediana del segmento", COLOR.mediana]],
    fuente: m.fuenteCorta + ". " + (serie ? "Mediana de las cooperativas que reportan cada mes."
                                          : "Mediana de marzo sobre las " + m.enAmbos + " cooperativas presentes en ambos cortes."),
    datos: [["Mes", "Jaspe", "Mediana", "Diferencia", "Improductiva", "Cartera bruta"], m.etiquetasLargas.map(function (mes, i) {
      return [cap(mes), pct(m.serieJ[i]), pct(m.serieMed[i]), signo(m.serieJ[i] - m.serieMed[i]) + " pp", usd(m.saldos[i].i), usd(m.saldos[i].b)];
    })],
    dibujar: function (lienzo) {
      graficoLineas(lienzo, {
        descripcion: "Morosidad total de Jaspe y mediana del segmento 4. Usa las flechas para recorrer los meses.",
        etiquetas: m.etiquetas, etiquetasLargas: m.etiquetasLargas, paso: 2, animar: true,
        series: [
          { nombre: "Jaspe", corto: "Jaspe", color: COLOR.jaspe, valores: m.serieJ, enfasis: true },
          { nombre: "Mediana del segmento", corto: "Mediana", color: COLOR.mediana, valores: m.serieMed }
        ],
        marcar: serie ? m.pico : undefined,
        extra: function (i) { return usd(m.saldos[i].i) + " improductivos de " + usd(m.saldos[i].b); }
      });
    }
  });
  pendientes.push(fig._dibujar);

  function partes(lista) {
    return h("div", { class: "partes" }, lista.map(function (p) {
      var e = h("span", { text: p[0] }); e.style.flex = p[1] + " 1 0"; e.style.background = p[2]; e.style.color = p[3] || COLOR.tinta;
      return e;
    }));
  }
  function duo(a, b, max) {
    var fila = function (rot, v, color) {
      var i = h("i"); i.style.width = (v / max * 58).toFixed(1) + "%"; i.style.background = color;
      return h("div", {}, [i, h("b", { text: pct(v) }), rot]);
    };
    return h("div", { class: "duo" }, [fila("Jaspe", a, COLOR.jaspe), fila("Mediana", b, COLOR.mediana)]);
  }
  var micro = [duo(m.mic, m.medMic, Math.max(m.mic, m.medMic)), "La diferencia se concentra en microcrédito",
    pct(m.mic) + " frente a " + pct(m.medMic) + " de mediana. Consumo está en línea con el segmento.", "pares", "Comparar con el segmento"];
  var ideas = serie ? [
    [tendencia(m.serieJ, { w: 200, h: 60, color: COLOR.jaspe, grosor: 3 }), "Bajó " + num(m.baja) + " puntos desde " + MESES[m.pico],
     "De " + pct(m.serieJ[m.pico]) + " a " + pct(m.mora) + ". La mediana del segmento bajó " + num(m.bajaMed) + " en el mismo periodo."],
    [partes([[num(m.porCartera, 1), m.porCartera, COLOR.jaspeMedio], [num(m.porImproductiva, 1), m.porImproductiva, COLOR.jaspeClaro]]),
     "Dos motores: más cartera y menos improductiva",
     num(m.porCartera, 1) + " puntos por el crecimiento de la cartera y " + num(m.porImproductiva, 1) + " por la reducción de la cartera improductiva.", "origen", "Ver el paso a paso"],
    micro
  ] : [
    [tendencia(m.serieJ, { w: 200, h: 60, color: COLOR.jaspe, grosor: 3 }), "Bajó " + num(m.baja) + " puntos en el trimestre",
     "De " + pct(m.serieJ[0]) + " en marzo a " + pct(m.mora) + " en junio."],
    [partes([[String(m.mejoraron), m.mejoraron, COLOR.jaspeClaro], [String(m.enAmbos - m.mejoraron), m.enAmbos - m.mejoraron, COLOR.regla]]),
     m.mejoraron + " de " + m.enAmbos + " cooperativas también bajaron",
     "La variación mediana del segmento fue de " + signo(m.varMediana) + " puntos."],
    micro
  ];
  var cartas = h("div", { class: "ideas" }, ideas.map(function (it) {
    var hijos = [h("div", { class: "idea-vis" }, [it[0]]), h("h3", { text: it[1] }), h("p", { text: it[2] }), it[3] ? h("span", { class: "ir", text: it[4] + " →" }) : null];
    return it[3] ? h("a", { class: "carta idea", href: "#" + it[3] }, hijos) : h("div", { class: "carta idea" }, hijos);
  }));
  return seccion("resumen", null, null, [fig, cartas], "primera");
}

/* ---------- La baja (solo septiembre): cascada que se explica barra por barra ---------- */
function secOrigen(m) {
  var p = m.saldoPico, u = m.saldoUlt, mp = MESES[m.pico], mu = m.mes;
  var max = Math.ceil(m.serieJ[m.pico] / 2) * 2;
  var pasos = [
    { rot: cap(mp), desde: 0, hasta: m.serieJ[m.pico], color: COLOR.jaspe, texto: pct(m.serieJ[m.pico]),
      titulo: "Punto de partida: " + mp, valor: num(m.serieJ[m.pico]), unidad: "%",
      p: usd(p.i) + " de cartera improductiva sobre " + usd(p.b) + " de cartera total." },
    { rot: "Menos cartera improductiva", desde: m.serieJ[m.pico], hasta: m.conCarteraPico, color: COLOR.jaspeClaro, texto: "−" + num(m.porImproductiva, 1) + " pp",
      titulo: "La cartera improductiva bajó", valor: "−" + num(m.porImproductiva, 1), unidad: "puntos",
      p: "Se redujo " + usd(m.bajaImpUsd) + " (−" + num(m.bajaImpPct, 1) + " %)." },
    { rot: "Más cartera total", desde: m.conCarteraPico, hasta: m.mora, color: COLOR.jaspeMedio, texto: "−" + num(m.porCartera, 1) + " pp",
      titulo: "La cartera total creció", valor: "−" + num(m.porCartera, 1), unidad: "puntos",
      p: "Creció " + usd(u.b - p.b) + " (+" + num(m.crecCartera, 1) + " %), sobre todo en consumo." },
    { rot: cap(mu), desde: 0, hasta: m.mora, color: COLOR.jaspe, texto: pct(m.mora),
      titulo: "Resultado: " + mu, valor: num(m.mora), unidad: "%",
      p: usd(u.i) + " de cartera improductiva sobre " + usd(u.b) + " de cartera total." }
  ];
  var panel = h("div", { class: "carta detalle-paso", "aria-live": "polite" });
  function explicar(i) {
    var d = i < 0 ? { titulo: "La baja, paso a paso", valor: "−" + num(m.baja), unidad: "puntos",
      p: "De " + pct(m.serieJ[m.pico]) + " en " + mp + " a " + pct(m.mora) + " en " + mu + "." } : pasos[i];
    vaciar(panel);
    panel.appendChild(h("h3", { text: d.titulo }));
    panel.appendChild(grande(d.valor, d.unidad));
    panel.appendChild(h("p", { text: d.p }));
    panel.appendChild(h("p", { class: "ayuda", text: i < 0 ? "Elige una barra para ver sus cifras." : "Elige la misma barra para volver al resumen." }));
  }
  var caja = h("div", { class: "cascada" });
  var pos = function (v) { return (v / max * 100).toFixed(3) + "%"; };
  var botones = pasos.map(function (d, i) {
    var izq = Math.min(d.desde, d.hasta), der = Math.max(d.desde, d.hasta);
    var barra = h("span", { class: "paso-barra" + (d.desde > d.hasta ? " baja" : "") });
    barra.style.left = pos(izq); barra.style.width = pos(der - izq); barra.style.background = d.color;
    var val = h("span", { class: "paso-val", text: d.texto }); val.style.left = pos(der);
    var b = h("button", { type: "button", class: "paso", "aria-pressed": "false" }, [h("span", { class: "paso-rot", text: d.rot }), h("span", { class: "paso-zona" }, [barra, val])]);
    b.addEventListener("click", function () {
      var ya = b.getAttribute("aria-pressed") === "true";
      botones.forEach(function (x) { x.setAttribute("aria-pressed", "false"); });
      if (!ya) b.setAttribute("aria-pressed", "true");
      caja.classList.toggle("elegida", !ya);
      explicar(ya ? -1 : i);
    });
    caja.appendChild(b);
    return b;
  });
  explicar(-1);

  var fila = function (rot, a, b, clase) {
    return { clase: clase, celdas: [rot, num(a, 0), num(b, 0), signo(b - a, 0), signo((b / a - 1) * 100, 1) + " %"] };
  };
  var fig = h("figure", { class: "carta figura" }, [
    h("h3", { text: "De " + pct(m.serieJ[m.pico]) + " a " + pct(m.mora) + " en " + (m.ult - m.pico) + " meses" }),
    h("p", { class: "figura-sub", text: "Descomposición de la variación de la mora total, en puntos porcentuales." }),
    caja,
    h("div", { class: "figura-pie" }, [
      h("p", { text: "Fuente: " + m.fuenteCorta + ". El efecto de la improductiva se mide con la cartera de " + mp + "." }),
      plegado("Ver saldos", [h("div", { class: "tabla-ancha" }, [tabla(["USD", cap(mp), cap(mu), "Variación", "%"], [
        fila("Cartera bruta", p.b, u.b), fila("Microcrédito", p.mb, u.mb, "sub"), fila("Consumo", p.cb, u.cb, "sub"),
        fila("Cartera improductiva", p.i, u.i),
        { clase: "total", celdas: ["Mora total", pct(m.serieJ[m.pico]), pct(m.mora), "−" + num(m.baja) + " pp", ""] }
      ])])], "datos")
    ])
  ]);
  var datos = h("div", { class: "datos-clave" }, [
    h("div", { class: "carta dato" }, [h("b", { text: pct(m.conCarteraPico) }),
      h("p", { text: "sería la mora de " + mu + " con la cartera de " + mp + ", en lugar de " + pct(m.mora) + "." })]),
    h("div", { class: "carta dato" }, [h("b", { text: signo(m.varImpTrim, 0) + " USD" }),
      h("p", { text: "varió la cartera improductiva en el último trimestre; la cartera total creció " + num(m.crecTrim, 1) + " %." })])
  ]);
  return seccion("origen", "¿Por qué bajó la mora?",
    "La mora es la cartera improductiva dividida para la cartera total. Bajó por los dos lados.", [h("div", { class: "dos" }, [fig, panel]), datos]);
}

/* ---------- Señales (solo septiembre): cuatro tarjetas y un detalle ---------- */
function secSenales(m) {
  var E = m.etiquetas, EL = m.etiquetasLargas, u = m.ult, fuente = m.fuenteCorta + ", saldos de Jaspe.";
  var porMes = function (cab, cols) { return [["Mes"].concat(cab), EL.map(function (mes, i) { return [cap(mes)].concat(cols.map(function (c) { return usd(c[i]); })); })]; };
  var saltos = lista(m.mesesSalto);
  var pesoVencida = m.saldos.map(function (x) { return x.vn / x.i * 100; });

  var senales = [
    { nom: "Cobertura de provisiones", val: pct(m.cobertura, 1), nota: "de la cartera improductiva", serie: m.serieCob, ref: 100, signo: 1,
      titulo: "Las provisiones ya cubren toda la cartera improductiva",
      sub: "Provisiones acumuladas sobre cartera improductiva, en %.",
      lectura: (m.cruceCob >= 0 ? "Cruzó el 100 % en " + MESES[m.cruceCob] + " y está en " : "Está en ") + pct(m.cobertura, 1) + ". La mediana del segmento es " + pct(m.medCob, 1) + ".",
      detalle: [(m.cruceCob > 0 ? "El aumento se concentró en " + MESES[m.cruceCob] + ", cuando las provisiones subieron " + usd(m.subeProvCruce) + ". " : "") +
        "La cuenta de provisiones incluye también lo constituido sobre cartera por vencer."],
      datos: [["Mes", "Cobertura", "Provisiones", "Improductiva"], EL.map(function (mes, i) { return [cap(mes), pct(m.serieCob[i], 1), usd(m.saldos[i].pv), usd(m.saldos[i].i)]; })],
      dibujar: function (l) {
        graficoLineas(l, { descripcion: "Cobertura de provisiones de Jaspe por mes, con la referencia de 100 por ciento.", etiquetas: E, etiquetasLargas: EL,
          alto: 280, izq: 40, fmt: function (v) { return pct(v, 1); }, ref: { valor: 100, texto: "100 %: improductiva cubierta", corto: "100 %" },
          marcar: m.minCob, marcarTexto: "Mínimo: ", marcarAbajo: true,
          series: [{ nombre: "Cobertura", color: COLOR.jaspe, valores: m.serieCob, enfasis: true }],
          extra: function (i) { return usd(m.saldos[i].pv) + " provisionados"; } });
      } },
    { nom: "Refinanciada al día", val: "−" + num(m.bajaRefVigente, 0) + " %", nota: "desde enero", serie: m.refVigente, signo: 1,
      titulo: "La cartera refinanciada que sigue al día cayó " + num(m.bajaRefVigente, 0) + " %",
      sub: "Cartera refinanciada y reestructurada, en miles de USD.",
      leyenda: [["Por vencer", COLOR.jaspe, true], ["Ya improductiva", COLOR.suave, true]],
      lectura: "De " + usd(m.refVigente[0]) + " a " + usd(m.refVigente[u]) + ". La baja de la mora no se apoya en refinanciamientos.",
      detalle: [
        "El saldo total pasó de " + usd(m.refVigente[0] + m.refImp[0]) + " a " + usd(m.refVigente[u] + m.refImp[u]) + ". La parte improductiva pasó de " + usd(m.refImp[0]) + " a " + usd(m.refImp[u]) + " y es el " + pct(m.pesoRefImp, 1) + " de toda la cartera improductiva.",
        "El saldo representa el " + pct(m.refSobreCartera, 1) + " de la cartera de Jaspe; " + m.sinRef + " de las " + m.N + " cooperativas no registran saldo y la mediana es " + pct(m.medRef, 1) + ".",
        "Buena parte de la baja ocurrió en " + saltos + "; los datos públicos no permiten distinguir cuánto corresponde a cobros y cuánto a castigos."
      ],
      datos: porMes(["Por vencer", "Ya improductiva", "Total"], [m.refVigente, m.refImp, m.refVigente.map(function (v, i) { return v + m.refImp[i]; })]),
      dibujar: function (l) {
        graficoColumnas(l, { descripcion: "Cartera refinanciada de Jaspe, por vencer y ya improductiva, por mes.", etiquetas: E, etiquetasLargas: EL, fmtEje: mil, rotular: [0, u], alto: 280,
          pilas: [{ nombre: "Ya improductiva", color: COLOR.suave, valores: m.refImp }, { nombre: "Por vencer", color: COLOR.jaspe, valores: m.refVigente }] });
      } },
    { nom: "Peso de la cartera vencida", val: pct(m.pesoVencida, 1), nota: "de la improductiva", serie: pesoVencida, signo: -1,
      titulo: "La cartera vencida gana peso dentro de la improductiva",
      sub: "Cartera que no devenga intereses y cartera vencida, en miles de USD.",
      leyenda: [["Vencida (mora antigua)", COLOR.atencion], ["No devenga intereses (mora reciente)", COLOR.mediana]],
      lectura: "La vencida subió " + num(m.subeVencida, 1) + " % desde enero y la que no devenga intereses bajó " + num(m.bajaNoDevenga, 1) + " %.",
      detalle: ["La vencida era el " + pct(m.pesoVencidaIni, 1) + " de la cartera improductiva y hoy es el " + pct(m.pesoVencida, 1) + "; la mediana del segmento es " + pct(m.medPesoVencida, 1) + ". La cartera improductiva de hoy tiene más antigüedad que la de enero."],
      datos: porMes(["No devenga", "Vencida"], [m.noDevenga, m.vencida]),
      dibujar: function (l) {
        graficoLineas(l, { descripcion: "Cartera que no devenga intereses y cartera vencida de Jaspe, por mes.", etiquetas: E, etiquetasLargas: EL,
          alto: 280, izq: 54, finAncho: 66, fmt: mil, fmtEje: mil, fmtPista: usd,
          series: [{ nombre: "Vencida", corto: "Vencida", color: COLOR.atencion, valores: m.vencida, enfasis: true }, { nombre: "No devenga intereses", corto: "No devenga", color: COLOR.mediana, valores: m.noDevenga }] });
      } },
    { nom: "Activos castigados", val: "+" + mil(m.subeCastigos), nota: "USD desde enero", serie: m.castigos, signo: -1,
      titulo: "Los activos castigados aumentaron " + usd(m.subeCastigos) + " desde enero",
      sub: "Saldo de activos castigados, en miles de USD.",
      lectura: "El aumento se concentró en " + saltos + ". En el mismo periodo la cartera improductiva bajó " + usd(m.bajaImpDesdeEnero) + ".",
      detalle: [
        "Un crédito castigado sale de la cartera y deja de contar en la mora. Como referencia, si esos créditos siguieran en la cartera la mora de " + m.mes + " estaría cerca de " + pct(m.moraSinCastigos, 1) + ".",
        "Castigar es el tratamiento contable que corresponde a un crédito que ya no se va a recuperar, y Jaspe contaba con las provisiones para hacerlo. El aumento equivale al " + pct(m.castigosSobreCartera, 1) + " de la cartera; la mediana del segmento es " + pct(m.medCastigos, 1) + " y el decil superior empieza en " + pct(m.p90Castigos, 1) + ".",
        "La cuenta incluye otros activos además de cartera y baja cuando se recupera un castigado, así que la comparación es aproximada."
      ],
      datos: porMes(["Activos castigados"], [m.castigos]),
      dibujar: function (l) {
        graficoColumnas(l, { descripcion: "Saldo mensual de activos castigados de Jaspe.", etiquetas: E, etiquetasLargas: EL, fmtEje: mil, rotular: [0, u], alto: 280,
          pilas: [{ nombre: "Activos castigados", color: COLOR.suave, valores: m.castigos }],
          colorDe: function (i) { return m.saltos[i] ? COLOR.atencion : COLOR.suave; },
          extra: function (i) { return i ? signo(m.castigos[i] - m.castigos[i - 1], 0) + " USD frente al mes anterior" : null; } });
      } }
  ];

  var detalle = h("div", { class: "senal-detalle", id: "senal-panel", role: "tabpanel" });
  function elegir(i, dibujarYa) {
    botones.forEach(function (b, k) { b.setAttribute("aria-selected", k === i ? "true" : "false"); b.tabIndex = k === i ? 0 : -1; });
    var d = senales[i], fig = figura({ signo: d.signo, titulo: d.titulo, sub: d.sub, leyenda: d.leyenda, lectura: d.lectura, detalle: d.detalle, datos: d.datos, fuente: fuente, dibujar: d.dibujar });
    vaciar(detalle).appendChild(fig);
    detalle.setAttribute("aria-label", d.nom);
    if (dibujarYa) fig._dibujar(); else pendientes.push(fig._dibujar);
  }
  var botones = senales.map(function (d, i) {
    var b = h("button", { type: "button", class: "senal", role: "tab", "aria-controls": "senal-panel", "aria-selected": "false" }, [
      h("span", { class: "senal-nom", text: d.nom }), h("span", { class: "senal-val", text: d.val }), h("span", { class: "senal-nota", text: d.nota }),
      h("span", { class: "senal-pie" }, [h("span", { class: "etiqueta " + (d.signo > 0 ? "favor" : "contra"), text: d.signo > 0 ? "Favorable" : "Para seguimiento" }),
        tendencia(d.serie, { w: 84, h: 30, ref: d.ref, color: COLOR.mediana, punto: d.signo > 0 ? COLOR.favorable : COLOR.atencion, fondo: "transparent" })])
    ]);
    b.addEventListener("click", function () { elegir(i, true); });
    b.addEventListener("keydown", function (ev) {
      var k = ev.key === "ArrowRight" ? i + 1 : ev.key === "ArrowLeft" ? i - 1 : -1;
      if (k < 0 || k >= senales.length) return;
      ev.preventDefault(); elegir(k, true); botones[k].focus();
    });
    return b;
  });
  elegir(0, false);
  return seccion("senales", "Cuatro señales de la cartera", "Complementan el porcentaje de mora: dos favorables y dos para seguimiento. Elige una para ver su evolución.",
    [h("div", { class: "selector", role: "tablist", "aria-label": "Señales de la cartera" }, botones), detalle]);
}

/* ---------- Comparación: la misma distribución con tres medidas ---------- */
function secPares(m) {
  var J = m.J;
  var medidas = [
    { clave: "total", nombre: "Mora total", f: mora, med: m.med,
      lectura: "El eje se corta en " + m.tope + " %: " + m.sobreTope + " cooperativas lo superan y la más alta llega al " + num(m.maxMora, 0) + " %. Por eso la referencia es la mediana y no el promedio." },
    { clave: "mic", nombre: "Microcrédito", f: moraMic, med: m.medMic,
      lectura: "Aquí se concentra la diferencia: el " + num(m.pesoMicEnImp, 0) + " % de la cartera improductiva de Jaspe es microcrédito." },
    { clave: "con", nombre: "Consumo", f: moraCon, med: m.medCon,
      lectura: "En línea con la mediana. La cartera de consumo creció " + num(m.crecConsumo, 0) + " % " + m.crecConsumoDesde + "; conviene seguir su evolución." }
  ];
  medidas.forEach(function (d) {
    d.items = m.ent.filter(function (r) { return d.f(r) !== null; }).map(function (r) { return { r: r, v: d.f(r) }; }).sort(function (a, b) { return a.v - b.v; });
    d.jIdx = d.items.map(function (it) { return it.r; }).indexOf(J);
    d.j = d.items[d.jIdx].v;
  });
  var cuerpo = h("div", { class: "carta figura comparacion", "aria-live": "polite" });
  function ver(i, dibujarYa) {
    var d = medidas[i];
    conm.forEach(function (b, k) { b.setAttribute("aria-pressed", k === i ? "true" : "false"); });
    var lienzo = h("div", { class: "lienzo" });
    vaciar(cuerpo);
    cuerpo.appendChild(h("div", { class: "puesto" }, [
      h("div", {}, [h("p", { class: "puesto-rot", text: "Puesto de Jaspe en " + d.nombre.toLowerCase() }), grande(String(d.jIdx + 1), "de " + d.items.length, "puesto-n")]),
      h("dl", {}, [
        h("div", {}, [h("dt", { text: "Jaspe" }), h("dd", { class: "j", text: pct(d.j) })]),
        h("div", {}, [h("dt", { text: "Mediana" }), h("dd", { text: pct(d.med) })]),
        h("div", {}, [h("dt", { text: "Diferencia" }), h("dd", { text: signo(d.j - d.med) + " pp" })])
      ])
    ]));
    cuerpo.appendChild(lienzo);
    cuerpo.appendChild(h("p", { class: "lectura", text: d.lectura }));
    cuerpo.appendChild(h("div", { class: "figura-pie" }, [h("p", { text: "Fuente: " + m.fuenteCorta + ". Cada barra es una cooperativa; el puesto 1 es la de menor morosidad." })]));
    var pinta = function () { graficoDistribucion(lienzo, { items: d.items, jIdx: d.jIdx, med: d.med, tope: m.tope, nombre: d.nombre }); };
    if (dibujarYa) pinta(); else pendientes.push(pinta);
  }
  var conm = medidas.map(function (d, i) {
    var b = h("button", { type: "button", "aria-pressed": "false", text: d.nombre });
    b.addEventListener("click", function () { ver(i, true); });
    return b;
  });
  ver(0, false);

  // Tabla con buscador y orden por columna
  var cols = [
    ["Puesto", function (r) { return m.orden.indexOf(r) + 1; }, String],
    ["Cooperativa", function (r) { return r.n; }, String],
    ["Mora total", mora, pct],
    ["Microcrédito", moraMic, pct],
    ["Consumo", moraCon, pct],
    ["Cartera bruta", function (r) { return r.b; }, usd]
  ];
  var estado = { col: 0, asc: true, q: "" };
  var filasT = h("tbody"), cuenta = h("span", { class: "cuenta" });
  var cab = h("tr", {}, cols.map(function (c, k) {
    var b = h("button", { type: "button", text: c[0] });
    b.addEventListener("click", function () { estado.asc = estado.col === k ? !estado.asc : k < 2; estado.col = k; pintarFilas(); });
    return h("th", { scope: "col" }, [b]);
  }));
  function pintarFilas() {
    var c = cols[estado.col], q = plano(estado.q);
    var filas = m.ent.filter(function (r) { return !q || plano(r.n).indexOf(q) >= 0; }).sort(function (a, b) {
      var va = c[1](a), vb = c[1](b);
      if (va === null) return 1;
      if (vb === null) return -1;
      return (typeof va === "string" ? va.localeCompare(vb, "es") : va - vb) * (estado.asc ? 1 : -1);
    });
    vaciar(filasT);
    filas.forEach(function (r) {
      filasT.appendChild(h("tr", r === J ? { class: "yo" } : {}, cols.map(function (cc) {
        var v = cc[1](r);
        return h("td", { text: v === null ? "—" : cc[2](v) });
      })));
    });
    Array.prototype.forEach.call(cab.children, function (th, k) {
      if (k === estado.col) th.setAttribute("aria-sort", estado.asc ? "ascending" : "descending"); else th.removeAttribute("aria-sort");
    });
    cuenta.textContent = filas.length === m.N ? m.N + " cooperativas" : filas.length + " de " + m.N + " cooperativas";
  }
  var buscar = h("input", { type: "search", id: "buscar", placeholder: "Jaspe", autocomplete: "off" });
  buscar.addEventListener("input", function () { estado.q = buscar.value; pintarFilas(); });
  pintarFilas();
  var tablaTodas = h("details", { class: "acordeon con-tabla" }, [
    h("summary", { text: "Ver la tabla de las " + m.N + " cooperativas" }),
    h("div", { class: "acordeon-cuerpo" }, [
      h("div", { class: "buscador" }, [h("label", { for: "buscar", text: "Buscar cooperativa" }), buscar, cuenta]),
      h("div", { class: "tabla-caja", tabindex: "0", role: "region", "aria-label": "Tabla de cooperativas, desplazable" }, [h("table", { class: "tabla rank" }, [h("thead", {}, [cab]), filasT])])
    ])
  ]);
  return seccion("pares", "Frente a las " + m.N + " cooperativas del segmento", "Tres maneras de ver la misma comparación.",
    [h("div", { class: "conmutador", role: "group", "aria-label": "Medida que se compara" }, conm), cuerpo, tablaTodas]);
}

/* ---------- Simulador ---------- */
function secSimulador(m) {
  var J = m.J, actual = m.mic;
  var desl = h("input", { type: "range", id: "sim", min: "2", max: "16", step: "0.01", value: actual.toFixed(2) });
  var oMic = h("p", { class: "sim-lectura" }), oTot = h("p", { class: "grande" }), oDif = h("p", { class: "sim-dif" });
  var relleno = h("i"), medio = h("b");
  var escala = Math.ceil(Math.max(m.mora, 14) / 2) * 2;
  medio.style.left = (m.med / escala * 100).toFixed(2) + "%";
  var atajos = [["Hoy", actual], ["Mediana de microcrédito", m.medMic], ["Igualar la mediana total", m.micObjetivo]].map(function (a) {
    var b = h("button", { type: "button", class: "atajo", "aria-pressed": "false" }, [a[0] + " ", h("b", { text: pct(a[1]) })]);
    b._v = +a[1].toFixed(2);
    b.addEventListener("click", function () { desl.value = b._v; calcular(); });
    return b;
  });
  function poner(el, valor, unidad) { vaciar(el).appendChild(document.createTextNode(valor)); el.appendChild(h("small", { text: unidad })); }
  function calcular() {
    var tasa = parseFloat(desl.value), tot = (J.mb * tasa / 100 + J.ci) / J.b * 100;
    var dif = Math.round((tot - m.med) * 100) / 100;
    poner(oMic, num(tasa), "%"); poner(oTot, num(tot), "%");
    oDif.textContent = dif === 0 ? "Igual a la mediana del segmento" : num(Math.abs(dif)) + " pp " + (dif > 0 ? "sobre" : "bajo") + " la mediana";
    oDif.className = "sim-dif" + (dif <= 0 ? " ok" : "");
    relleno.style.width = Math.min(100, tot / escala * 100).toFixed(2) + "%";
    atajos.forEach(function (b) { b.setAttribute("aria-pressed", Math.abs(b._v - tasa) < 0.005 ? "true" : "false"); });
  }
  desl.addEventListener("input", calcular);
  calcular();
  var caja = h("div", { class: "carta sim" }, [
    h("div", { class: "sim-control" }, [
      h("label", { for: "sim", text: "Morosidad de microcrédito" }), oMic, desl,
      h("div", { class: "sim-eje" }, [h("span", { text: "2 %" }), h("span", { text: "16 %" })]),
      h("div", { class: "atajos" }, atajos)
    ]),
    h("div", { class: "sim-salida", "aria-live": "polite" }, [
      h("p", { class: "rot", text: "Mora total resultante" }), oTot, oDif,
      h("div", { class: "sim-pista-wrap" }, [h("div", { class: "sim-pista" }, [relleno, medio]),
        h("div", { class: "sim-pista-ejes" }, [h("span", { text: "0 %" }), h("span", { text: "La marca es la mediana: " + pct(m.med) }), h("span", { text: escala + " %" })])])
    ])
  ]);
  return seccion("simulador", "¿Y si microcrédito mejora?",
    "Con microcrédito en " + pct(m.micObjetivo) + ", Jaspe igualaría la mediana del segmento. El cálculo deja fijos la cartera de consumo y los montos.", [caja]);
}

/* ---------- Alcance y método ---------- */
function secMetodo(m) {
  var sep = m.id === "sep", J = m.J;
  var alcance = h("ul", { class: "alcance" }, [
    ["Qué muestra", "Lo que dicen los datos públicos de la SEPS sobre la cartera de Jaspe y del segmento 4."],
    ["Qué no evalúa", "Decisiones de gestión. Dependen de información que solo existe dentro de la cooperativa."],
    ["Qué haría falta", "Mora por agencia, oficial de crédito, actividad económica y fecha de otorgamiento, para explicar las causas."]
  ].map(function (a) { return h("li", { class: "carta" }, [h("b", { text: a[0] }), a[1]]); }));

  var dl = h("dl");
  [["Cartera que no devenga intereses", J.nd], ["Cartera vencida", J.vn], ["Cartera improductiva", J.i, true], ["Cartera bruta total", J.b]].forEach(function (f) {
    dl.appendChild(h("dt", { class: f[2] ? "total" : "", text: f[0] }));
    dl.appendChild(h("dd", { class: f[2] ? "total" : "", text: usd(f[1]) }));
  });
  var calculo = h("details", { class: "acordeon auditoria" }, [h("summary", { text: "Cómo se calcula la mora total" }),
    h("div", { class: "acordeon-cuerpo" }, [dl, h("p", { class: "formula", text: num(J.i, 0) + " ÷ " + num(J.b, 0) + " = " + pct(m.mora) })])]);

  var filas = [
    ["Fuente", sep
      ? "Base de estados financieros mensuales de la SEPS, nueve cortes de enero a septiembre de 2026, a nivel de cuenta contable de cuatro dígitos."
      : "Boletín Financiero del Segmento 4 de la SEPS, cortes al 31 de marzo y al 30 de junio de 2026."],
    sep ? ["Verificación", "El corte de junio reconstruido desde esta base reproduce al centavo, cooperativa por cooperativa, las " + MODELOS.jun.N +
      " entidades del Boletín Financiero del Segmento 4. La base trae una entidad más, por eso su mediana difiere levemente de la del boletín."] : null,
    ["Universo", sep
      ? m.N + " cooperativas con cartera reportada en septiembre (" + m.nEnero + " en enero), Jaspe incluida. Con las " + m.nPanel +
        " presentes en los nueve cortes la mediana sería " + pct(m.medPanel) + " y la conclusión no cambia."
      : m.N + " cooperativas con cartera reportada en junio, Jaspe incluida; " + m.enAmbos + " están en ambos cortes. Según el boletín, el segmento tenía " +
        m.enSegmento + " y " + (m.enSegmento - m.N) + " no habían enviado información."],
    ["Fórmula", "Morosidad = (cartera que no devenga intereses + cartera vencida) ÷ cartera bruta. Es la definición de la SEPS, aplicada igual a todas las entidades."],
    ["Referencia", "Mediana y no promedio, porque la distribución está sesgada: el decil superior supera el " + pct(m.p90, 0) + " y el máximo llega al " + pct(m.maxMora, 0) +
      ". Promedio simple: " + pct(m.promedio, 1) + ". Morosidad agregada del segmento: " + pct(m.agregada) + "."],
    ["Control por mezcla", "Las " + m.nMezcla + " cooperativas cuya proporción de microcrédito está a menos de 12,5 puntos de la de Jaspe tienen una mediana de " + pct(m.medMezcla) +
      "; con 15 puntos de tolerancia, " + pct(m.medMezcla15) + ". La mezcla de productos no explica la diferencia con el segmento."],
    ["Por producto", "Cada mediana usa solo las cooperativas con cartera de ese tipo: " + m.nMic + " en microcrédito y " + m.nCon + " en consumo."],
    sep ? ["Sin respuesta pública", "Qué parte de los castigos corresponde a cartera refinanciada y por qué en los últimos cortes reportan menos cooperativas."] : null,
    ["Proceso", "Datos cargados y limpiados en Power Query; cálculos replicados de forma independiente. Todas las cifras se calculan en el navegador a partir de los saldos por cooperativa (archivos en data/)."],
    ["Documento", "INF-SEPS-01, revisión 3. Elaborado por Jhoann Gonza, noviembre de 2026."]
  ].filter(Boolean);
  var ficha = h("details", { class: "acordeon" }, [h("summary", { text: "Ficha técnica" }),
    h("div", { class: "acordeon-cuerpo" }, [h("dl", { class: "ficha" }, filas.map(function (f) { return h("div", {}, [h("dt", { text: f[0] }), h("dd", { text: f[1] })]); }))])]);
  return seccion("metodo", "Alcance y método", null, [alcance, calculo, ficha]);
}

/* ====================================================================
   5. Corte activo, navegación e impresión
   ==================================================================== */
/* Secciones: clave, nombre en la navegación, constructor y, si aplica, el único corte que la tiene. */
var SECCIONES = [
  ["resumen", "Resumen", secResumen],
  ["origen", "La baja", secOrigen, "sep"],
  ["senales", "Señales", secSenales, "sep"],
  ["pares", "Comparación", secPares],
  ["simulador", "Simulador", secSimulador],
  ["metodo", "Método", secMetodo]
];
function seccionesDe(m) { return SECCIONES.filter(function (sec) { return !sec[3] || sec[3] === m.id; }); }

var espia = null;
function pintarIndice(m) {
  var ol = vaciar($("indice")), enlaces = {};
  seccionesDe(m).forEach(function (sec) {
    var a = h("a", { href: "#" + sec[0], text: sec[1] });
    enlaces[sec[0]] = a;
    ol.appendChild(h("li", {}, [a]));
  });
  if (espia) espia.disconnect();
  enlaces.resumen.setAttribute("aria-current", "true");
  if (!("IntersectionObserver" in window)) return;
  espia = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      for (var k in enlaces) enlaces[k].removeAttribute("aria-current");
      var a = enlaces[e.target.id];
      a.setAttribute("aria-current", "true");
      var nav = a.closest(".nav");
      if (nav && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.offsetWidth / 2 });
    });
  }, { rootMargin: "-20% 0px -70% 0px" });
  Array.prototype.forEach.call(document.querySelectorAll("#secciones > section"), function (sec) { espia.observe(sec); });
}

function pintar(id) {
  var m = MODELOS[id];
  Array.prototype.forEach.call(document.querySelectorAll(".corte button"), function (b) {
    b.setAttribute("aria-pressed", b.getAttribute("data-corte") === id ? "true" : "false");
  });
  document.documentElement.setAttribute("data-corte", id);
  pendientes = [];
  pintarPortada(m);
  var cont = vaciar($("secciones"));
  seccionesDe(m).forEach(function (sec) { cont.appendChild(sec[2](m)); });
  pendientes.forEach(function (f) { f(); });
  pintarIndice(m);
}
function corteInicial() {
  var q = /[?&]corte=(jun|sep)\b/.exec(location.search);
  return q ? q[1] : "sep";
}
Array.prototype.forEach.call(document.querySelectorAll(".corte button"), function (b) {
  b.addEventListener("click", function () {
    var id = b.getAttribute("data-corte");
    pintar(id);
    if (history.replaceState) history.replaceState(null, "", id === "sep" ? location.pathname : "?corte=" + id);
  });
});

var imprimir = h("button", { type: "button", class: "boton", text: "Imprimir o guardar PDF" });
imprimir.addEventListener("click", function () { window.print(); });
$("pie").appendChild(h("p", { text: "Elaborado por Jhoann Gonza con información pública de la Superintendencia de Economía Popular y Solidaria del Ecuador. Las cifras se calculan en el navegador a partir de los saldos por cooperativa." }));
$("pie").appendChild(imprimir);

/* Al imprimir se despliega el contexto de cada figura; las tablas de datos quedan plegadas. */
var abiertos = [];
window.addEventListener("beforeprint", function () {
  abiertos = Array.prototype.filter.call(document.querySelectorAll("details.plegado:not(.datos), details.acordeon:not(.con-tabla)"), function (d) { return !d.open; });
  abiertos.forEach(function (d) { d.open = true; });
});
window.addEventListener("afterprint", function () { abiertos.forEach(function (d) { d.open = false; }); abiertos = []; });

pintar(corteInicial());
if (location.hash && $(location.hash.slice(1))) $(location.hash.slice(1)).scrollIntoView();
window.INFORME = { modelos: MODELOS };  // expuesto para verificación
})();
