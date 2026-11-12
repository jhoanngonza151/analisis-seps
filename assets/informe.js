/* Informe técnico: morosidad de Jaspe Ltda. frente al segmento 4.
   Todas las cifras del informe se calculan aquí a partir de data/*.js; ninguna está escrita a mano.

   Orden del archivo:
     1. utilidades (formato, estadística, DOM)
     2. modelo: lo que el informe muestra para cada corte
     3. componentes de gráfico (líneas, columnas, distribución, barras horizontales)
     4. vistas: portada, indicadores y secciones
     5. corte activo, índice e impresión */
(function () {
"use strict";

var SEPS = window.SEPS;
var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre"];
var MES3 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep"];
var COLOR = {
  jaspe: "#1d5fc4", jaspeClaro: "#7fa8e3", mediana: "#8791a3", adverso: "#b45309",
  suave: "#c3cad6", barra: "#cfd6e0", regla: "#e4e7ec", eje: "#cfd4dc", tinta3: "#667085", papel: "#ffffff"
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
      svg.appendChild(s("text", { x: mg.l + 6, y: ry - 6, class: "marca" }, cfg.ref.texto));
    }
    cfg.etiquetas.forEach(function (e, i) {
      svg.appendChild(s("text", { x: x(i), y: H - 8, "text-anchor": "middle" }, n === 2 ? cfg.etiquetasLargas[i] + " 2026" : e));
    });
    var cursor = s("line", { y1: mg.t, y2: y(lo), stroke: COLOR.mediana, "stroke-width": 1, visibility: "hidden" });
    svg.appendChild(cursor);

    cfg.series.forEach(function (se) {
      var d = se.valores.map(function (val, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(val).toFixed(1); }).join(" ");
      svg.appendChild(s("path", { d: d, fill: "none", stroke: se.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
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
    var banda = (W - mg.l - mg.r) / n, bw = Math.min(24, banda * 0.62);
    var y = function (v) { return mg.t + (hi - v) / hi * (H - mg.t - mg.b); };
    var base = y(0);
    vaciar(svg);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("height", H);
    var fondo = s("rect", { y: mg.t - 6, width: banda, height: base - mg.t + 6, fill: "#f3f4f6", visibility: "hidden" });
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
            ? s("path", { d: barraArriba(cx - bw / 2, top, bw, alto - hueco, 4), fill: color })
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

/* ---------- distribución: todas las cooperativas ordenadas ---------- */
function graficoDistribucion(lienzo, m) {
  var svg = s("svg", { role: "img", tabindex: "0",
    "aria-label": "Morosidad de las " + m.N + " cooperativas ordenadas de menor a mayor. Use las flechas para recorrerlas." });
  vaciar(lienzo); lienzo.appendChild(svg);
  var pista = crearPista(lienzo);
  var orden = m.orden, n = orden.length, TOPE = m.tope, jIdx = m.puesto - 1;

  alRedimensionar(lienzo, function () {
    var W = Math.max(260, Math.round(lienzo.clientWidth)), H = W >= 560 ? 270 : 230;
    var mg = { t: 30, r: 8, b: 30, l: 40 };
    var banda = (W - mg.l - mg.r) / n, bw = Math.max(banda - (banda > 3 ? 1 : 0.5), 0.8);
    var y = function (v) { return mg.t + (TOPE - Math.min(v, TOPE)) / TOPE * (H - mg.t - mg.b); };
    var base = y(0);
    vaciar(svg);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("height", H);
    [0, 5, 10, 15, 20].forEach(function (v) {
      var ty = Math.round(y(v)) + 0.5;
      svg.appendChild(s("line", { x1: mg.l, y1: ty, x2: W - mg.r, y2: ty, stroke: v === 0 ? COLOR.eje : COLOR.regla, "stroke-width": 1 }));
      svg.appendChild(s("text", { x: mg.l - 8, y: ty + 4, "text-anchor": "end", class: "eje" }, v === TOPE ? "≥ " + v : String(v)));
    });
    var barras = orden.map(function (r, i) {
      var b = s("rect", { x: (mg.l + i * banda).toFixed(2), y: y(mora(r)), width: bw.toFixed(2), height: base - y(mora(r)), fill: r === m.J ? COLOR.jaspe : COLOR.barra });
      svg.appendChild(b);
      return b;
    });
    var my = Math.round(y(m.med)) + 0.5;
    svg.appendChild(s("line", { x1: mg.l, y1: my, x2: W - mg.r, y2: my, stroke: COLOR.tinta3, "stroke-width": 1 }));
    svg.appendChild(s("text", { x: mg.l + 4, y: my - 6, class: "marca" }, "Mediana " + pct(m.med)));
    svg.appendChild(s("text", { x: mg.l, y: H - 8 }, "menor mora"));
    svg.appendChild(s("text", { x: W - mg.r, y: H - 8, "text-anchor": "end" }, "mayor mora"));
    var jx = mg.l + jIdx * banda + bw / 2, jy = y(m.mora);
    svg.appendChild(s("line", { x1: jx, y1: jy - 4, x2: jx, y2: jy - 16, stroke: COLOR.jaspe, "stroke-width": 1.5 }));
    svg.appendChild(s("text", { x: jx, y: jy - 22, "text-anchor": "middle", class: "fin fuerte" }, "Jaspe " + pct(m.mora)));

    var previo = -1;
    recorrer(svg, n, function (ev) { return Math.floor((xEnSvg(svg, ev, W) - mg.l) / banda); }, function (i) {
      if (previo >= 0) barras[previo].setAttribute("fill", orden[previo] === m.J ? COLOR.jaspe : COLOR.barra);
      previo = i;
      if (i < 0) { pista.ocultar(); return; }
      var r = orden[i];
      if (r !== m.J) barras[i].setAttribute("fill", COLOR.tinta3);
      pista.mostrar(mg.l + i * banda + bw, y(mora(r)), W, (r === m.J ? "Jaspe Ltda" : r.n),
        [{ nombre: "Mora total", valor: pct(mora(r)) }, { nombre: "Puesto", valor: (i + 1) + " de " + n }], "Cartera bruta " + usd(r.b));
    });
  });
}

/* ---------- barras horizontales (HTML): cascada y comparación por producto ---------- */
function barrasH(host, cfg) {
  vaciar(host);
  var caja = h("div", { class: "bh" });
  if (cfg.rotulo) caja.style.setProperty("--rot", cfg.rotulo + "px");
  host.appendChild(caja);
  var pista = crearPista(host);
  var pos = function (v) { return (v / cfg.max * 100).toFixed(3) + "%"; };
  var rejilla = "repeating-linear-gradient(to right," + COLOR.regla + " 0 1px,transparent 1px " + (cfg.paso / cfg.max * 100).toFixed(4) + "%)";
  cfg.filas.forEach(function (f) {
    var lineas = f.barras.map(function (b) {
      var izq = Math.min(b.desde, b.hasta), der = Math.max(b.desde, b.hasta);
      var barra = h("span", { class: "bh-barra" + (b.desde > b.hasta ? " baja" : ""), tabindex: "0", role: "img", "aria-label": b.nombre + ": " + b.texto });
      barra.style.left = pos(izq); barra.style.width = pos(der - izq); barra.style.background = b.color;
      var val = h("span", { class: "bh-val" + (b.fuerte ? " fuerte" : ""), text: b.texto });
      val.style.left = pos(der);
      var linea = h("div", { class: "bh-linea" }, [barra, val]);
      var ver = function () {
        var c = caja.getBoundingClientRect(), r = barra.getBoundingClientRect();
        pista.mostrar(r.left - c.left + Math.min(r.width, 60), r.bottom - c.top + 44, host.clientWidth, b.nombre,
          [{ nombre: b.rotuloValor || "Valor", color: b.color, caja: true, valor: b.texto }], b.extra);
      };
      barra.addEventListener("pointerenter", ver); barra.addEventListener("focus", ver);
      barra.addEventListener("pointerleave", pista.ocultar); barra.addEventListener("blur", pista.ocultar);
      return linea;
    });
    var zona = h("div", { class: "bh-zona" }, lineas);
    zona.style.backgroundImage = rejilla;
    caja.appendChild(h("div", { class: "bh-fila" }, [h("div", { class: "bh-rot", text: f.rotulo }), h("div", { class: "bh-pista" }, [zona])]));
  });
  var eje = h("div", { class: "bh-zona bh-eje" });
  for (var v = 0; v <= cfg.max + 1e-9; v += cfg.paso) {
    var t = h("span", { text: num(v, 0) }); t.style.left = pos(v); eje.appendChild(t);
  }
  caja.appendChild(h("div", { class: "bh-fila eje" }, [h("div", { class: "bh-rot" }), h("div", { class: "bh-pista" }, [eje])]));
}

/* Minigráfico de tendencia para los indicadores: una línea tenue y el último punto destacado. */
function tendencia(valores, ref) {
  var W = 132, H = 30, p = 5;
  var todos = ref === undefined ? valores : valores.concat([ref]);
  var lo = Math.min.apply(null, todos), hi = Math.max.apply(null, todos);
  var x = function (i) { return p + i * (W - 2 * p) / (valores.length - 1); };
  var y = function (v) { return p + (hi - v) / (hi - lo || 1) * (H - 2 * p); };
  var svg = s("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, "aria-hidden": "true", overflow: "visible" });
  if (ref !== undefined) {
    svg.appendChild(s("line", { x1: 0, y1: y(ref), x2: W, y2: y(ref), stroke: COLOR.eje, "stroke-width": 1 }));
    svg.appendChild(s("text", { x: W + 6, y: y(ref) + 4, "font-size": 12, fill: COLOR.tinta3 }, num(ref, 0) + " %"));
  }
  svg.appendChild(s("path", {
    d: valores.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" "),
    fill: "none", stroke: COLOR.mediana, "stroke-width": 1.5, "stroke-linejoin": "round", "stroke-linecap": "round"
  }));
  var u = valores.length - 1;
  svg.appendChild(s("circle", { cx: x(u), cy: y(valores[u]), r: 3.5, fill: COLOR.jaspe, stroke: COLOR.papel, "stroke-width": 1.5 }));
  return svg;
}

/* ====================================================================
   4. Vistas
   ==================================================================== */
var contador, pendientes;        // numeración de figuras y tablas; gráficos por dibujar una vez montado el DOM

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
/* Figura: título que enuncia el hallazgo, referencia numerada, gráfico, una frase de lectura,
   matices plegados y tabla con los mismos datos. */
function figura(o) {
  var n = ++contador.fig;
  var lienzo = h("div", { class: "lienzo" });
  var fig = h("figure", { class: "figura" + (o.clase ? " " + o.clase : "") }, [
    o.signo ? h("p", { class: "etiqueta " + (o.signo > 0 ? "favor" : "contra"), text: o.signo > 0 ? "Favorable" : "Para seguimiento" }) : null,
    h("h3", { text: o.titulo }),
    h("p", { class: "figura-sub" }, [h("span", { class: "ref", text: "Figura " + n + "." }), " " + o.sub]),
    o.leyenda ? leyenda(o.leyenda) : null,
    lienzo,
    o.lectura ? h("p", { class: "lectura", text: o.lectura }) : null,
    o.detalle ? h("details", { class: "detalle" }, [h("summary", { text: "Matices" })].concat(o.detalle.map(function (t) { return h("p", { text: t }); }))) : null,
    h("div", { class: "figura-pie" }, [
      h("p", { text: "Fuente: " + o.fuente }),
      o.datos ? h("details", { class: "datos" }, [h("summary", { text: "Ver datos de la figura" }), h("div", { class: "tabla-ancha" }, [tabla(o.datos[0], o.datos[1])])]) : null
    ])
  ]);
  if (o.dibujar) pendientes.push(function () { o.dibujar(lienzo); });
  return fig;
}
function seccion(m, clave, hijos) {
  var info = seccionesDe(m).filter(function (x) { return x.clave === clave; })[0];
  return h("section", { class: "seccion", id: clave, "aria-labelledby": "h-" + clave }, [
    h("div", { class: "seccion-cab" }, [h("span", { class: "num", text: info.num }), h("h2", { id: "h-" + clave, text: info.titulo })])
  ].concat(hijos));
}

/* ---------- portada ---------- */
function pintarPortada(m) {
  var lede = vaciar($("lede"));
  lede.appendChild(document.createTextNode("A " + m.mes + " de 2026 la mora total de Jaspe es "));
  lede.appendChild(h("b", { text: pct(m.mora) }));
  lede.appendChild(document.createTextNode(", " + num(m.brecha) + " puntos sobre la mediana de las " + m.N + " cooperativas del segmento 4. " +
    (m.id === "sep"
      ? "Bajó " + num(m.baja) + " puntos desde " + MESES[m.pico] + ": " + num(m.porCartera, 1) + " por el crecimiento de la cartera y " +
        num(m.porImproductiva, 1) + " por la reducción de la cartera improductiva."
      : "Bajó " + num(m.baja) + " puntos frente a marzo; la diferencia con el segmento se concentra en microcrédito.")));

  var caj = vaciar($("cajetin"));
  [["Documento", "INF-SEPS-01", "cod"], ["Revisión", "2", "cod"],
   ["Entidad analizada", "Cooperativa Jaspe Ltda., segmento 4", "", true],
   ["Corte", m.fecha], ["Universo", m.N + " cooperativas"],
   ["Fuente", m.fuente, "", true],
   ["Elaboró", "Jhoann Gonza"], ["Fecha", "Noviembre de 2026"]
  ].forEach(function (c) {
    caj.appendChild(h("div", c[3] ? { class: "ancho" } : {}, [h("dt", { text: c[0] }), h("dd", { class: c[2] || "", text: c[1] })]));
  });
}

/* ---------- indicadores ---------- */
function indicador(rotulo, valor, unidad, nota, grafico) {
  return h("div", { class: "ind" }, [
    h("p", { class: "ind-rotulo", text: rotulo }),
    h("p", { class: "ind-valor" }, [valor, unidad ? h("small", { text: " " + unidad }) : null]),
    h("p", { class: "ind-nota", text: nota }),
    grafico ? h("div", { class: "ind-graf" }, [grafico]) : null
  ]);
}
function pintarIndicadores(m) {
  var caja = vaciar($("indicadores")), serie = m.id === "sep";
  var marca = h("i"); marca.style.left = ((m.puesto - 1) / (m.N - 1) * 100).toFixed(1) + "%";
  var pista = h("div", {}, [
    h("div", { class: "pista" }, [h("b"), marca]),
    h("div", { class: "pista-ejes" }, [h("span", { text: "menor mora" }), h("span", { text: "mayor" })])
  ]);
  caja.appendChild(indicador("Mora total", num(m.mora), "%",
    serie ? pct(m.serieJ[m.pico]) + " en " + MESES[m.pico] + ", el punto más alto del año" : pct(m.serieJ[0]) + " en marzo",
    serie ? tendencia(m.serieJ) : null));
  caja.appendChild(indicador("Brecha frente a la mediana", signo(m.brecha), "pp",
    "Mediana del segmento 4: " + pct(m.med), serie ? tendencia(m.serieBrecha) : null));
  caja.appendChild(indicador("Posición en el segmento", String(m.puesto), "de " + m.N,
    "Ordenadas de menor a mayor mora; " + (m.N - m.puesto) + " tienen más", pista));
  caja.appendChild(indicador("Cobertura de provisiones", m.cobertura === null ? "s/d" : num(m.cobertura, 1), m.cobertura === null ? "" : "%",
    serie ? pct(m.serieCob[m.minCob], 1) + " en " + MESES[m.minCob] + ", el mínimo del año" : "Provisiones sobre cartera improductiva",
    serie ? tendencia(m.serieCob, 100) : null));

  var J = m.J, dl = vaciar($("auditoria"));
  [["Cartera que no devenga intereses", J.nd], ["Cartera vencida", J.vn], ["Cartera improductiva", J.i, true], ["Cartera bruta total", J.b]]
    .forEach(function (f) {
      dl.appendChild(h("dt", { class: f[2] ? "total" : "", text: f[0] }));
      dl.appendChild(h("dd", { class: f[2] ? "total" : "", text: usd(f[1]) }));
    });
  $("formula").textContent = num(J.i, 0) + " ÷ " + num(J.b, 0) + " = " + pct(m.mora);
}

/* ---------- Resumen ejecutivo ---------- */
function secResumen(m) {
  var serie = m.id === "sep";
  var acorta = m.serieJ[m.pico] - m.serieMed[m.pico] > m.brecha;   // la distancia con la mediana es menor que al inicio
  var fig = figura({
    titulo: (serie ? "La mora de Jaspe baja desde " + MESES[m.pico] : "La mora de Jaspe bajó en el trimestre") +
      (acorta ? " y acorta su distancia con la mediana" : " y mantiene su distancia con la mediana"),
    sub: serie ? "Morosidad total mensual, enero a septiembre de 2026, en % de la cartera bruta"
               : "Morosidad total, marzo y junio de 2026, en % de la cartera bruta",
    leyenda: [["Jaspe", COLOR.jaspe], ["Mediana del segmento 4", COLOR.mediana]],
    fuente: m.fuenteCorta + ". " + (serie ? "La mediana se calcula cada mes sobre las cooperativas que reportan ese mes."
                                          : "Mediana de marzo sobre las " + m.enAmbos + " cooperativas presentes en ambos cortes."),
    datos: [["Mes", "Jaspe", "Mediana", "Brecha", "Improductiva", "Cartera bruta"], m.etiquetasLargas.map(function (mes, i) {
      return [cap(mes), pct(m.serieJ[i]), pct(m.serieMed[i]), signo(m.serieJ[i] - m.serieMed[i]) + " pp", usd(m.saldos[i].i), usd(m.saldos[i].b)];
    })],
    dibujar: function (lienzo) {
      graficoLineas(lienzo, {
        descripcion: "Morosidad total de Jaspe y mediana del segmento 4. Use las flechas para recorrer los meses.",
        etiquetas: m.etiquetas, etiquetasLargas: m.etiquetasLargas, paso: 2,
        series: [
          { nombre: "Jaspe", corto: "Jaspe", color: COLOR.jaspe, valores: m.serieJ, enfasis: true },
          { nombre: "Mediana del segmento", corto: "Mediana", color: COLOR.mediana, valores: m.serieMed }
        ],
        marcar: serie ? m.pico : undefined, marcarTexto: "Pico: ",
        extra: function (i) { return usd(m.saldos[i].i) + " improductivos de " + usd(m.saldos[i].b); }
      });
    }
  });

  var brechaMic = ["La diferencia con el segmento se concentra en microcrédito",
    pct(m.mic) + " frente a una mediana de " + pct(m.medMic) + ". Consumo está en línea: " + pct(m.con) + " frente a " + pct(m.medCon) + ".", "pares"];
  var items = serie ? [
    ["La mora bajó " + num(m.baja) + " puntos desde " + MESES[m.pico],
     "De " + pct(m.serieJ[m.pico]) + " a " + pct(m.mora) + ". En el mismo lapso la mediana del segmento bajó " + num(m.bajaMed) + " puntos."],
    ["La baja combina crecimiento de la cartera y menor cartera improductiva",
     num(m.porCartera, 1) + " puntos se explican porque la cartera creció " + num(m.crecCartera, 1) + " %; " + num(m.porImproductiva, 1) +
     " porque la cartera improductiva bajó " + usd(m.bajaImpUsd) + ".", "origen"],
    brechaMic
  ] : [
    ["La mora bajó " + num(m.baja) + " puntos en el trimestre",
     "De " + pct(m.serieJ[0]) + " en marzo a " + pct(m.mora) + " en junio. " + m.mejoraron + " de las " + m.enAmbos +
     " cooperativas presentes en ambos cortes también la redujeron; la variación mediana fue de " + signo(m.varMediana) + " puntos."],
    brechaMic,
    ["Con microcrédito en " + pct(m.micObjetivo) + ", Jaspe igualaría la mediana",
     "Hoy está en " + pct(m.mic) + ". El cálculo mantiene fijos la cartera de consumo y los montos.", "simulador"]
  ];
  var hall = h("ol", { class: "hallazgos", "aria-label": "Hallazgos principales" }, items.map(function (it) {
    return h("li", {}, [h("h3", { text: it[0] }), h("p", { text: it[1] }),
      it[2] ? h("a", { class: "ir", href: "#" + it[2], text: "Ver sección " + numeroDe(m, it[2]) }) : null]);
  }));
  return seccion(m, "resumen", [h("div", { class: "dos-col" }, [fig, hall])]);
}

/* ---------- Origen de la baja (solo septiembre) ---------- */
function secOrigen(m) {
  var p = m.saldoPico, u = m.saldoUlt, mp = MESES[m.pico], mu = m.mes;
  var max = Math.ceil(m.serieJ[m.pico] / 2) * 2;
  var fig = figura({
    titulo: "De los " + num(m.baja) + " puntos de baja, " + num(m.porCartera, 1) + " vienen de que la cartera creció",
    sub: "Descomposición de la variación de la mora total entre " + mp + " y " + mu + " de 2026, en puntos porcentuales",
    fuente: m.fuenteCorta + ". El efecto de la improductiva se mide con la cartera de " + mp + "; el resto es el efecto del crecimiento.",
    dibujar: function (lienzo) {
      barrasH(lienzo, { max: max, paso: 2, filas: [
        { rotulo: "Mora en " + mp, barras: [{ desde: 0, hasta: m.serieJ[m.pico], color: COLOR.jaspe, texto: pct(m.serieJ[m.pico]), fuerte: true,
            nombre: "Mora total en " + mp, rotuloValor: "Mora total", extra: usd(p.i) + " improductivos de " + usd(p.b) }] },
        { rotulo: "La cartera improductiva bajó", barras: [{ desde: m.serieJ[m.pico], hasta: m.conCarteraPico, color: COLOR.jaspeClaro, texto: "−" + num(m.porImproductiva, 1) + " pp",
            nombre: "Efecto de la reducción de la improductiva", rotuloValor: "Aporte", extra: "La improductiva bajó " + usd(m.bajaImpUsd) }] },
        { rotulo: "La cartera bruta creció", barras: [{ desde: m.conCarteraPico, hasta: m.mora, color: COLOR.adverso, texto: "−" + num(m.porCartera, 1) + " pp",
            nombre: "Efecto del crecimiento de la cartera", rotuloValor: "Aporte", extra: "La cartera creció " + usd(u.b - p.b) }] },
        { rotulo: "Mora en " + mu, barras: [{ desde: 0, hasta: m.mora, color: COLOR.jaspe, texto: pct(m.mora), fuerte: true,
            nombre: "Mora total en " + mu, rotuloValor: "Mora total", extra: usd(u.i) + " improductivos de " + usd(u.b) }] }
      ] });
    }
  });

  var nT = ++contador.tab;
  var fila = function (rot, a, b, clase) {
    return { clase: clase, celdas: [rot, num(a, 0), num(b, 0), signo(b - a, 0), signo((b / a - 1) * 100, 1) + " %"] };
  };
  var lado = h("div", { class: "lado" }, [
    h("p", { class: "tabla-titulo" }, [h("span", { class: "ref", text: "Tabla " + nT + "." }), " Saldos de Jaspe en USD, " + mp + " frente a " + mu + " de 2026"]),
    h("div", { class: "tabla-ancha" }, [tabla(["", cap(mp), cap(mu), "Variación", "%"], [
      fila("Cartera bruta", p.b, u.b), fila("Microcrédito", p.mb, u.mb, "sub"), fila("Consumo", p.cb, u.cb, "sub"),
      fila("Cartera improductiva", p.i, u.i),
      { clase: "total", celdas: ["Mora total", pct(m.serieJ[m.pico]), pct(m.mora), "−" + num(m.baja) + " pp", ""] }
    ], "compacta")]),
    h("ul", { class: "puntos" }, [
      h("li", { text: "Con la cartera de " + mp + ", la mora de " + mu + " sería " + pct(m.conCarteraPico) + " en lugar de " + pct(m.mora) + "." }),
      h("li", { text: "El crecimiento vino sobre todo de consumo, una cartera reciente cuya morosidad todavía no se puede evaluar." }),
      h("li", { text: "En el último trimestre la cartera improductiva " + (m.varImpTrim > 0 ? "aumentó " : "bajó ") + usd(Math.abs(m.varImpTrim)) +
        " y la cartera total creció " + num(m.crecTrim, 1) + " %. Con la cartera de " + MESES[m.mesTrim] + ", la mora sería " + pct(m.moraConCarteraTrim) + "." })
    ])
  ]);
  return seccion(m, "origen", [h("div", { class: "dos-col mitad" }, [fig, lado])]);
}

/* ---------- Señales de la cartera (solo septiembre) ---------- */
function secSenales(m) {
  var E = m.etiquetas, EL = m.etiquetasLargas, u = m.ult, fuente = m.fuenteCorta + ", saldos de Jaspe.";
  var porMes = function (cab, cols) { return [["Mes"].concat(cab), EL.map(function (mes, i) { return [cap(mes)].concat(cols.map(function (c) { return usd(c[i]); })); })]; };
  var saltos = lista(m.mesesSalto);

  var castigos = figura({
    signo: -1,
    titulo: "Los activos castigados aumentaron " + usd(m.subeCastigos) + " desde enero",
    sub: "Saldo de activos castigados, en miles de USD",
    lectura: "El aumento se concentró en " + saltos + ". En el mismo periodo la cartera improductiva bajó " + usd(m.bajaImpDesdeEnero) + ".",
    detalle: [
      "Un crédito castigado sale de la cartera y deja de contar en la mora. Como referencia, si esos créditos siguieran en la cartera la mora de " + m.mes + " estaría cerca de " + pct(m.moraSinCastigos, 1) + ".",
      "Castigar es el tratamiento contable que corresponde a un crédito que ya no se va a recuperar, y Jaspe contaba con las provisiones para hacerlo. El aumento equivale al " + pct(m.castigosSobreCartera, 1) + " de la cartera; la mediana del segmento es " + pct(m.medCastigos, 1) + " y el decil superior empieza en " + pct(m.p90Castigos, 1) + ".",
      "La cuenta incluye otros activos además de cartera y baja cuando se recupera un castigado, así que la comparación es aproximada."
    ],
    fuente: fuente, datos: porMes(["Activos castigados"], [m.castigos]),
    dibujar: function (l) {
      graficoColumnas(l, { descripcion: "Saldo mensual de activos castigados de Jaspe.", etiquetas: E, etiquetasLargas: EL, fmtEje: mil, rotular: [0, u],
        pilas: [{ nombre: "Activos castigados", color: COLOR.suave, valores: m.castigos }],
        colorDe: function (i) { return m.saltos[i] ? COLOR.adverso : COLOR.suave; },
        extra: function (i) { return i ? signo(m.castigos[i] - m.castigos[i - 1], 0) + " USD frente al mes anterior" : null; } });
    }
  });

  var edad = figura({
    signo: -1,
    titulo: "La cartera vencida gana peso dentro de la improductiva",
    sub: "Cartera que no devenga intereses y cartera vencida, en miles de USD",
    leyenda: [["No devenga intereses (mora reciente)", COLOR.mediana], ["Vencida (mora antigua)", COLOR.adverso]],
    lectura: "La vencida subió " + num(m.subeVencida, 1) + " % desde enero y la que no devenga intereses bajó " + num(m.bajaNoDevenga, 1) + " %.",
    detalle: ["La vencida era el " + pct(m.pesoVencidaIni, 1) + " de la cartera improductiva y hoy es el " + pct(m.pesoVencida, 1) + "; la mediana del segmento es " + pct(m.medPesoVencida, 1) + ". La cartera improductiva de hoy tiene más antigüedad que la de enero."],
    fuente: fuente, datos: porMes(["No devenga", "Vencida"], [m.noDevenga, m.vencida]),
    dibujar: function (l) {
      graficoLineas(l, { descripcion: "Cartera que no devenga intereses y cartera vencida de Jaspe, por mes.", etiquetas: E, etiquetasLargas: EL,
        alto: 230, izq: 54, finAncho: 66, fmt: mil, fmtEje: mil, fmtPista: usd,
        series: [{ nombre: "Vencida", color: COLOR.adverso, valores: m.vencida, enfasis: true }, { nombre: "No devenga intereses", color: COLOR.mediana, valores: m.noDevenga }] });
    }
  });

  var ref = figura({
    signo: 1,
    titulo: "La cartera refinanciada que sigue al día cayó " + num(m.bajaRefVigente, 0) + " %",
    sub: "Cartera refinanciada y reestructurada, en miles de USD",
    leyenda: [["Por vencer", COLOR.jaspe, true], ["Ya improductiva", COLOR.suave, true]],
    lectura: "De " + usd(m.refVigente[0]) + " a " + usd(m.refVigente[u]) + ". La baja de la mora no se apoya en refinanciamientos.",
    detalle: [
      "El saldo total pasó de " + usd(m.refVigente[0] + m.refImp[0]) + " a " + usd(m.refVigente[u] + m.refImp[u]) + ". La parte improductiva pasó de " + usd(m.refImp[0]) + " a " + usd(m.refImp[u]) + " y es el " + pct(m.pesoRefImp, 1) + " de toda la cartera improductiva.",
      "El saldo representa el " + pct(m.refSobreCartera, 1) + " de la cartera de Jaspe; " + m.sinRef + " de las " + m.N + " cooperativas no registran saldo y la mediana es " + pct(m.medRef, 1) + ".",
      "Buena parte de la baja ocurrió en " + saltos + "; los datos públicos no permiten distinguir cuánto corresponde a cobros y cuánto a castigos."
    ],
    fuente: fuente, datos: porMes(["Por vencer", "Ya improductiva", "Total"], [m.refVigente, m.refImp, m.refVigente.map(function (v, i) { return v + m.refImp[i]; })]),
    dibujar: function (l) {
      graficoColumnas(l, { descripcion: "Cartera refinanciada de Jaspe, por vencer y ya improductiva, por mes.", etiquetas: E, etiquetasLargas: EL, fmtEje: mil, rotular: [0, u],
        pilas: [{ nombre: "Ya improductiva", color: COLOR.suave, valores: m.refImp }, { nombre: "Por vencer", color: COLOR.jaspe, valores: m.refVigente }] });
    }
  });

  var cob = figura({
    signo: 1,
    titulo: "Las provisiones ya cubren toda la cartera improductiva",
    sub: "Provisiones acumuladas sobre cartera improductiva, en %",
    lectura: (m.cruceCob >= 0 ? "Cruzó el 100 % en " + MESES[m.cruceCob] + " y está en " : "Está en ") + pct(m.cobertura, 1) + "; la mediana del segmento es " + pct(m.medCob, 1) + ".",
    detalle: [(m.cruceCob > 0 ? "El aumento se concentró en " + MESES[m.cruceCob] + ", cuando las provisiones subieron " + usd(m.subeProvCruce) + ". " : "") +
      "La cuenta de provisiones incluye también lo constituido sobre cartera por vencer."],
    fuente: fuente,
    datos: [["Mes", "Cobertura", "Provisiones", "Improductiva"], EL.map(function (mes, i) { return [cap(mes), pct(m.serieCob[i], 1), usd(m.saldos[i].pv), usd(m.saldos[i].i)]; })],
    dibujar: function (l) {
      graficoLineas(l, { descripcion: "Cobertura de provisiones de Jaspe por mes, con la referencia de 100 por ciento.", etiquetas: E, etiquetasLargas: EL,
        alto: 230, izq: 40, finAncho: 66, fmt: function (v) { return pct(v, 1); }, ref: { valor: 100, texto: "100 %: improductiva cubierta" },
        marcar: m.minCob, marcarTexto: "Mínimo: ", marcarAbajo: true,
        series: [{ nombre: "Cobertura", color: COLOR.jaspe, valores: m.serieCob, enfasis: true }],
        extra: function (i) { return usd(m.saldos[i].pv) + " provisionados"; } });
    }
  });

  return seccion(m, "senales", [
    h("p", { class: "entrada", text: "Cuatro indicadores que complementan el porcentaje de mora: dos favorables y dos que conviene seguir." }),
    h("div", { class: "rejilla-2" }, [castigos, edad, ref, cob])
  ]);
}

/* ---------- Comparación con pares ---------- */
function secPares(m) {
  var J = m.J;
  var max = Math.ceil(Math.max(m.mic, m.medMic, m.con, m.medCon) * 1.05 / 2) * 2;
  var par = function (rot, j, med, cnt, imp, bruta) {
    return { rotulo: rot, barras: [
      { desde: 0, hasta: j, color: COLOR.jaspe, texto: pct(j), fuerte: true, nombre: rot + ", Jaspe", rotuloValor: "Morosidad", extra: usd(imp) + " improductivos de " + usd(bruta) },
      { desde: 0, hasta: med, color: COLOR.mediana, texto: pct(med), nombre: rot + ", mediana del segmento", rotuloValor: "Morosidad", extra: "Mediana de las " + cnt + " cooperativas con este producto" }
    ] };
  };
  var producto = figura({
    titulo: "La diferencia con el segmento está en microcrédito",
    sub: "Morosidad por producto en " + m.mes + " de 2026, en %",
    leyenda: [["Jaspe", COLOR.jaspe, true], ["Mediana del segmento", COLOR.mediana, true]],
    lectura: "En microcrédito Jaspe está " + num(m.mic - m.medMic, 1) + " puntos sobre la mediana, y ahí se concentra el " + num(m.pesoMicEnImp, 0) +
      " % de su cartera improductiva. Consumo está en línea con la mediana; como creció " + num(m.crecConsumo, 0) + " % " + m.crecConsumoDesde + ", es una cartera reciente y conviene seguir su evolución.",
    fuente: m.fuenteCorta + ". Cada mediana se calcula sobre las cooperativas que tienen ese producto.",
    dibujar: function (l) {
      barrasH(l, { max: max, paso: max > 10 ? 4 : 2, rotulo: 96, filas: [par("Microcrédito", m.mic, m.medMic, m.nMic, J.mi, J.mb), par("Consumo", m.con, m.medCon, m.nCon, J.ci, J.cb)] });
    }
  });
  var dist = figura({
    titulo: "Jaspe ocupa el puesto " + m.puesto + " de " + m.N + " por morosidad",
    sub: "Morosidad total de cada cooperativa del segmento 4, ordenadas de menor a mayor, en %",
    lectura: "El eje se corta en " + m.tope + " %: " + m.sobreTope + " cooperativas lo superan y la más alta llega al " + num(m.maxMora, 0) +
      " %. Por esa cola se compara contra la mediana y no contra el promedio simple, que es " + pct(m.promedio, 1) + ".",
    fuente: m.fuenteCorta + ".",
    dibujar: function (l) { graficoDistribucion(l, m); }
  });

  // Tabla con buscador y orden por columna
  var nT = ++contador.tab;
  var cols = [
    ["Puesto", function (r) { return m.orden.indexOf(r) + 1; }, String],
    ["Cooperativa", function (r) { return r.n; }, String],
    ["Mora total", mora, pct],
    ["Microcrédito", moraMic, pct],
    ["Consumo", moraCon, pct],
    ["Cartera bruta", function (r) { return r.b; }, usd]
  ];
  var estado = { col: 0, asc: true, q: "" };
  var cuerpo = h("tbody"), cuenta = h("span", { class: "cuenta" });
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
    vaciar(cuerpo);
    filas.forEach(function (r) {
      cuerpo.appendChild(h("tr", r === m.J ? { class: "yo" } : {}, cols.map(function (cc) {
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
  var ranking = h("div", { class: "figura ranking" }, [
    h("div", { class: "ranking-cab" }, [
      h("p", { class: "tabla-titulo" }, [h("span", { class: "ref", text: "Tabla " + nT + "." }), " Cooperativas del segmento 4 por morosidad, " + m.mes + " de 2026"]),
      h("div", { class: "buscador" }, [h("label", { for: "buscar", text: "Buscar cooperativa" }), buscar, cuenta])
    ]),
    h("div", { class: "tabla-caja", tabindex: "0", role: "region", "aria-label": "Tabla de cooperativas, desplazable" }, [h("table", { class: "tabla rank" }, [h("thead", {}, [cab]), cuerpo])])
  ]);

  return seccion(m, "pares", [h("div", { class: "dos-col pares" }, [producto, dist]), ranking]);
}

/* ---------- Simulador ---------- */
function secSimulador(m) {
  var J = m.J, actual = m.mic;
  var desl = h("input", { type: "range", id: "sim", min: "2", max: "16", step: "0.01", value: actual.toFixed(2) });
  var oMic = h("p", { class: "ind-valor" }), oTot = h("p", { class: "ind-valor" }), oDif = h("p", { class: "ind-valor" });
  var marca = h("i"), medio = h("b");
  var escala = Math.ceil(Math.max(m.mora, 14) / 2) * 2;
  medio.style.left = (m.med / escala * 100).toFixed(2) + "%";
  function poner(el, valor, unidad) { vaciar(el).appendChild(document.createTextNode(valor)); el.appendChild(h("small", { text: " " + unidad })); }
  function calcular() {
    var tasa = parseFloat(desl.value), tot = (J.mb * tasa / 100 + J.ci) / J.b * 100;
    var dif = Math.round((tot - m.med) * 100) / 100;
    poner(oMic, num(tasa), "%"); poner(oTot, num(tot), "%"); poner(oDif, signo(dif), "pp");
    marca.style.width = Math.min(100, tot / escala * 100).toFixed(2) + "%";
  }
  desl.addEventListener("input", calcular);
  var bObj = h("button", { type: "button", class: "boton", text: "Igualar la mediana" });
  var bIni = h("button", { type: "button", class: "boton", text: "Volver al valor actual" });
  bObj.addEventListener("click", function () { desl.value = m.micObjetivo.toFixed(2); calcular(); });
  bIni.addEventListener("click", function () { desl.value = actual.toFixed(2); calcular(); });
  calcular();
  var caja = h("div", { class: "figura sim" }, [
    h("h3", { text: "Con microcrédito en " + pct(m.micObjetivo) + ", Jaspe igualaría la mediana del segmento" }),
    h("p", { class: "figura-sub", text: "Hoy está en " + pct(actual) + ". Mueva la morosidad de microcrédito y vea cómo responde la mora total; la cartera de consumo y los montos quedan fijos." }),
    h("div", { class: "sim-cuerpo" }, [
      h("div", { class: "sim-control" }, [
        h("label", { for: "sim", text: "Morosidad de microcrédito simulada" }), desl,
        h("div", { class: "sim-eje" }, [h("span", { text: "2 %" }), h("span", { text: "16 %" })]),
        h("div", { class: "sim-acciones" }, [bObj, bIni])
      ]),
      h("div", { class: "sim-salida", "aria-live": "polite" }, [
        h("div", {}, [h("p", { class: "ind-rotulo", text: "Morosidad de microcrédito" }), oMic]),
        h("div", {}, [h("p", { class: "ind-rotulo", text: "Mora total resultante" }), oTot]),
        h("div", {}, [h("p", { class: "ind-rotulo", text: "Distancia a la mediana" }), oDif]),
        h("div", { class: "sim-barra" }, [h("div", { class: "pista ancha" }, [marca, medio]),
          h("div", { class: "pista-ejes" }, [h("span", { text: "0 %" }), h("span", { text: "La marca es la mediana: " + pct(m.med) }), h("span", { text: escala + " %" })])])
      ])
    ]),
    h("div", { class: "figura-pie" }, [h("p", { text: "El cálculo suma microcrédito y consumo, que son toda la cartera de Jaspe." })])
  ]);
  return seccion(m, "simulador", [caja]);
}

/* ---------- Límites ---------- */
function secLimites(m) {
  var puntos = [
    "Este informe describe lo que muestran los datos públicos. No evalúa decisiones de gestión, que dependen de información que solo existe dentro de la cooperativa.",
    "Las causas de la morosidad se explican con información interna: mora por agencia, por oficial de crédito, por actividad económica y por fecha de otorgamiento."
  ];
  if (m.id === "sep") puntos.push(
    "Con información pública tampoco se puede saber qué parte de los castigos corresponde a cartera refinanciada ni por qué en los últimos cortes reportan menos cooperativas.");
  return seccion(m, "limites", [h("div", { class: "limites" }, puntos.map(function (t) { return h("p", { text: t }); }))]);
}

/* ---------- Ficha técnica ---------- */
function secFicha(m) {
  var sep = m.id === "sep";
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
    ["Proceso", "Datos cargados y limpiados en Power Query; cálculos replicados de forma independiente. Todas las cifras de este informe se calculan en el navegador a partir de los saldos por cooperativa (archivos en data/)."]
  ].filter(Boolean);
  return seccion(m, "ficha", [h("dl", { class: "ficha" }, filas.map(function (f) { return h("div", {}, [h("dt", { text: f[0] }), h("dd", { text: f[1] })]); }))]);
}

/* ====================================================================
   5. Corte activo, índice e impresión
   ==================================================================== */
/* Secciones: clave, título, constructor y, si aplica, el único corte que la tiene.
   Los números se asignan según las secciones que aplican al corte activo. */
var SECCIONES = [
  ["resumen", "Resumen ejecutivo", secResumen],
  ["origen", "Origen de la baja", secOrigen, "sep"],
  ["senales", "Señales de la cartera", secSenales, "sep"],
  ["pares", "Comparación con pares", secPares],
  ["simulador", "Simulador", secSimulador],
  ["limites", "Límites del análisis", secLimites],
  ["ficha", "Ficha técnica", secFicha, null, "A"]
];
function seccionesDe(m) {
  var k = 0;
  return SECCIONES.filter(function (sec) { return !sec[3] || sec[3] === m.id; })
    .map(function (sec) { return { clave: sec[0], titulo: sec[1], crear: sec[2], num: sec[4] || String(++k) }; });
}
function numeroDe(m, clave) {
  return seccionesDe(m).filter(function (x) { return x.clave === clave; })[0].num;
}

var espia = null;
function pintarIndice(m) {
  var ol = vaciar($("indice")), enlaces = {};
  seccionesDe(m).forEach(function (sec) {
    var a = h("a", { href: "#" + sec.clave }, [h("span", { class: "num", text: sec.num }), sec.titulo]);
    enlaces[sec.clave] = a;
    ol.appendChild(h("li", {}, [a]));
  });
  if (espia) espia.disconnect();
  enlaces.resumen.setAttribute("aria-current", "true");
  if (!("IntersectionObserver" in window)) return;
  espia = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      for (var k in enlaces) enlaces[k].removeAttribute("aria-current");
      enlaces[e.target.id].setAttribute("aria-current", "true");
    });
  }, { rootMargin: "-15% 0px -75% 0px" });
  Array.prototype.forEach.call(document.querySelectorAll("#secciones > section"), function (sec) { espia.observe(sec); });
}

function pintar(id) {
  var m = MODELOS[id];
  Array.prototype.forEach.call(document.querySelectorAll(".corte button"), function (b) {
    b.setAttribute("aria-pressed", b.getAttribute("data-corte") === id ? "true" : "false");
  });
  document.documentElement.setAttribute("data-corte", id);
  contador = { fig: 0, tab: 0 }; pendientes = [];
  pintarPortada(m); pintarIndicadores(m);
  var cont = vaciar($("secciones"));
  seccionesDe(m).forEach(function (sec) { cont.appendChild(sec.crear(m)); });
  pendientes.forEach(function (f) { f(); });   // los gráficos necesitan el ancho real, ya montados
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
$("imprimir").addEventListener("click", function () { window.print(); });

/* Al imprimir se despliegan los matices y el cálculo de la mora; las tablas de datos quedan plegadas. */
var abiertos = [];
window.addEventListener("beforeprint", function () {
  abiertos = Array.prototype.filter.call(document.querySelectorAll("details.detalle, details.auditoria"), function (d) { return !d.open; });
  abiertos.forEach(function (d) { d.open = true; });
});
window.addEventListener("afterprint", function () { abiertos.forEach(function (d) { d.open = false; }); abiertos = []; });

pintar(corteInicial());
if (location.hash && $(location.hash.slice(1))) $(location.hash.slice(1)).scrollIntoView();
window.INFORME = { modelos: MODELOS };  // expuesto para verificación
})();
