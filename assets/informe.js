/* Informe técnico: morosidad de Jaspe Ltda. frente al segmento 4.
   Todas las cifras del informe se calculan aquí a partir de data/*.js; ninguna está escrita a mano. */
(function () {
"use strict";

var SEPS = window.SEPS;
var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre"];
var MES3 = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep"];
var COLOR = { jaspe: "#1d5fc4", mediana: "#8791a3", regla: "#e4e7ec", eje: "#cfd4dc", papel: "#ffffff", tenue: "#98a2b3" };
var SVGNS = "http://www.w3.org/2000/svg";

/* ---------- formato ---------- */
function num(v, d) {
  if (d === undefined) d = 2;
  return v.toLocaleString("es-EC", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function pct(v, d) { return num(v, d) + " %"; }
function usd(v) { return num(v, 0) + " USD"; }
function signo(v, d) { return (v > 0 ? "+" : v < 0 ? "−" : "") + num(Math.abs(v), d); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ---------- estadística ---------- */
function mediana(a) {
  var s = a.slice().sort(function (x, y) { return x - y; }), n = s.length;
  if (!n) return 0;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
function mora(r) { return r.i / r.b * 100; }
function moraMic(r) { return r.mb > 0 ? r.mi / r.mb * 100 : null; }
function moraCon(r) { return r.cb > 0 ? r.ci / r.cb * 100 : null; }

/* ---------- DOM ---------- */
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
   Modelo: todo lo que el informe muestra para un corte.
   ==================================================================== */
function comun(ent, J) {
  var todas = ent.map(mora);
  var orden = ent.slice().sort(function (a, b) { return mora(a) - mora(b); });
  var mic = ent.filter(function (r) { return r.mb > 0; });
  var con = ent.filter(function (r) { return r.cb > 0; });
  var med = mediana(todas);
  return {
    J: J, N: ent.length, mora: mora(J), med: med, brecha: mora(J) - med,
    puesto: orden.indexOf(J) + 1,
    mic: moraMic(J), medMic: mediana(mic.map(moraMic)),
    con: moraCon(J), medCon: mediana(con.map(moraCon)),
    // morosidad de microcrédito con la que la mora total igualaría la mediana, lo demás constante
    micObjetivo: (med / 100 * J.b - J.ci) / J.mb * 100
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
  var p = jas[pico], u = jas[ult];
  var conCarteraPico = u.i / p.b * 100;
  var minCob = serieCob.indexOf(Math.min.apply(null, serieCob));
  m.id = "sep"; m.mes = "septiembre"; m.fecha = "30 de septiembre de 2026";
  m.fuente = "SEPS, estados financieros mensuales, enero a septiembre de 2026";
  m.fuenteCorta = "SEPS, estados financieros mensuales";
  m.etiquetas = MES3.slice(0, ult + 1); m.etiquetasLargas = MESES.slice(0, ult + 1);
  m.serieJ = serieJ; m.serieMed = serieMed; m.serieCob = serieCob;
  m.serieBrecha = serieJ.map(function (v, i) { return v - serieMed[i]; });
  m.saldos = jas;
  m.pico = pico; m.baja = serieJ[pico] - serieJ[ult];
  m.bajaMed = serieMed[pico] - serieMed[ult];
  m.porCartera = conCarteraPico - serieJ[ult];        // puntos que aporta el crecimiento de la cartera
  m.porImproductiva = serieJ[pico] - conCarteraPico;  // puntos que aporta la reducción de la improductiva
  m.crecCartera = (u.b / p.b - 1) * 100;
  m.bajaImpUsd = p.i - u.i;
  m.cobertura = serieCob[ult]; m.minCob = minCob;
  return m;
}

function modeloJun() {
  var ent = SEPS.jun.entidades;
  var J = ent.filter(function (r) { return r.n.toUpperCase().indexOf("JASPE") >= 0; })[0];
  var m = comun(ent, J);
  var conMar = ent.filter(function (r) { return r.pb; });
  var moraMar = function (r) { return r.pi / r.pb * 100; };
  var medMar = mediana(conMar.map(moraMar));
  m.id = "jun"; m.mes = "junio"; m.fecha = "30 de junio de 2026";
  m.fuente = "SEPS, Boletín Financiero del Segmento 4, cortes de marzo y junio de 2026";
  m.fuenteCorta = "SEPS, Boletín Financiero del Segmento 4";
  m.etiquetas = ["mar", "jun"]; m.etiquetasLargas = ["marzo", "junio"];
  m.serieJ = [moraMar(J), m.mora]; m.serieMed = [medMar, m.med];
  m.saldos = [{ i: J.pi, b: J.pb }, { i: J.i, b: J.b }];
  m.pico = 0; m.baja = moraMar(J) - m.mora;
  m.enAmbos = conMar.length;
  m.mejoraron = conMar.filter(function (r) { return mora(r) < moraMar(r); }).length;
  // La cobertura no viene en el boletín: se toma del saldo mensual de junio si coincide con el boletín.
  var jj = SEPS.sep && SEPS.sep.jaspe[5];
  m.cobertura = jj && Math.abs(jj.b - J.b) < 0.01 && Math.abs(jj.i - J.i) < 0.01 ? jj.pv / jj.i * 100 : null;
  return m;
}

var MODELOS = { sep: modeloSep(), jun: modeloJun() };

/* ====================================================================
   Gráfico de líneas con ejes, lectura por cursor o teclado y tabla gemela.
   ==================================================================== */
function graficoLineas(lienzo, cfg) {
  var svg = s("svg", { role: "img", tabindex: "0", "aria-label": cfg.descripcion });
  var pista = h("div", { class: "pista-lectura", hidden: "" });
  vaciar(lienzo); lienzo.appendChild(svg); lienzo.appendChild(pista);
  var n = cfg.etiquetas.length, activo = -1, geo = null;

  var todos = [];
  cfg.series.forEach(function (se) { todos = todos.concat(se.valores); });
  var paso = cfg.paso || 2;
  var lo = Math.floor(Math.min.apply(null, todos) / paso) * paso;
  var hi = Math.ceil(Math.max.apply(null, todos) / paso) * paso;
  if (Math.min.apply(null, todos) - lo < paso * 0.25) lo -= paso;
  if (lo < 0) lo = 0;

  function dibujar() {
    var W = Math.max(280, Math.round(lienzo.clientWidth));
    var ancho = W >= 560;
    var H = cfg.alto ? cfg.alto(W) : (ancho ? 300 : 240);
    var mg = { t: 16, r: ancho ? 132 : 62, b: 30, l: 34 };
    var x0 = mg.l + (n === 2 ? 28 : 8), x1 = W - mg.r;
    var x = function (i) { return n === 1 ? x0 : x0 + i * (x1 - x0) / (n - 1); };
    var y = function (v) { return mg.t + (hi - v) / (hi - lo) * (H - mg.t - mg.b); };
    geo = { x: x, y: y, W: W, H: H, mg: mg };
    vaciar(svg);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("height", H);

    var v, ty;
    for (v = lo; v <= hi + 1e-9; v += paso) {
      ty = Math.round(y(v)) + 0.5;
      svg.appendChild(s("line", { x1: mg.l, y1: ty, x2: x1, y2: ty, stroke: v === lo ? COLOR.eje : COLOR.regla, "stroke-width": 1 }));
      svg.appendChild(s("text", { x: mg.l - 8, y: ty + 4, "text-anchor": "end", class: "eje" }, num(v, 0)));
    }
    cfg.etiquetas.forEach(function (e, i) {
      svg.appendChild(s("text", { x: x(i), y: H - 8, "text-anchor": "middle" }, n === 2 ? cfg.etiquetasLargas[i] + " 2026" : e));
    });

    var cursor = s("line", { y1: mg.t, y2: y(lo), stroke: COLOR.tenue, "stroke-width": 1, visibility: "hidden" });
    svg.appendChild(cursor);

    var puntos = [];
    cfg.series.forEach(function (se) {
      var d = se.valores.map(function (val, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(val).toFixed(1); }).join(" ");
      svg.appendChild(s("path", { d: d, fill: "none", stroke: se.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    });
    cfg.series.forEach(function (se) {
      // marcador final siempre visible; los demás aparecen con el cursor
      var fila = se.valores.map(function (val, i) {
        var c = s("circle", { cx: x(i), cy: y(val), r: 4, fill: se.color, stroke: COLOR.papel, "stroke-width": 2 });
        if (i !== n - 1 && !(n === 2)) c.setAttribute("visibility", "hidden");
        svg.appendChild(c);
        return c;
      });
      puntos.push(fila);
    });

    // rótulos directos al final de cada serie, separados si se acercan
    var fin = cfg.series.map(function (se) { return { se: se, y: y(se.valores[n - 1]) }; })
      .sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < fin.length; k++) if (fin[k].y - fin[k - 1].y < 18) fin[k].y = fin[k - 1].y + 18;
    fin.forEach(function (f) {
      var txt = (ancho ? f.se.corto + " " : "") + pct(f.se.valores[n - 1], 2);
      svg.appendChild(s("text", { x: x1 + 12, y: f.y + 4, class: "fin" + (f.se.enfasis ? " fuerte" : "") }, txt));
    });

    // rótulo selectivo: el extremo que cuenta la historia
    if (cfg.marcar !== undefined && cfg.marcar !== n - 1) {
      var mv = cfg.series[0].valores[cfg.marcar];
      puntos[0][cfg.marcar].setAttribute("visibility", "visible");
      svg.appendChild(s("text", { x: x(cfg.marcar), y: y(mv) - 11, "text-anchor": cfg.marcar === 0 ? "start" : "middle", class: "marca" },
        "Pico: " + pct(mv, 2)));
    }

    function mostrar(i) {
      activo = i;
      puntos.forEach(function (fila) {
        fila.forEach(function (c, j) {
          var fijo = j === n - 1 || n === 2 || (cfg.marcar === j && fila === puntos[0]);
          c.setAttribute("visibility", j === i || fijo ? "visible" : "hidden");
          c.setAttribute("r", j === i ? 5 : 4);
        });
      });
      if (i < 0) { cursor.setAttribute("visibility", "hidden"); pista.hidden = true; return; }
      cursor.setAttribute("x1", x(i)); cursor.setAttribute("x2", x(i)); cursor.setAttribute("visibility", "visible");
      vaciar(pista);
      pista.appendChild(h("div", { class: "t", text: cap(cfg.etiquetasLargas[i]) + " de 2026" }));
      cfg.series.forEach(function (se) {
        var llave = h("i"); llave.style.borderTopColor = se.color;
        pista.appendChild(h("div", { class: "f" }, [llave, se.nombre, h("b", { text: pct(se.valores[i], 2) })]));
      });
      if (cfg.extra) pista.appendChild(h("div", { class: "x", text: cfg.extra(i) }));
      pista.hidden = false;
      var pw = pista.offsetWidth, ph = pista.offsetHeight;
      var px = x(i) + 14; if (px + pw > W) px = x(i) - 14 - pw; if (px < 0) px = 0;
      var py = Math.min(y(cfg.series[0].valores[i]) - ph / 2, H - mg.b - ph); if (py < 0) py = 0;
      pista.style.transform = "translate(" + Math.round(px) + "px," + Math.round(py) + "px)";
    }
    function desde(ev) {
      var caja = svg.getBoundingClientRect();
      var px = (ev.clientX - caja.left) / caja.width * W;
      var i = n === 1 ? 0 : Math.round((px - x0) / ((x1 - x0) / (n - 1)));
      mostrar(Math.max(0, Math.min(n - 1, i)));
    }
    svg.onpointermove = desde;
    svg.onpointerdown = desde;
    svg.onpointerleave = function (ev) { if (ev.pointerType === "mouse") mostrar(-1); };
    svg.onblur = function () { mostrar(-1); };
    svg.onkeydown = function (ev) {
      var i = activo < 0 ? n - 1 : activo;
      if (ev.key === "ArrowRight") i++; else if (ev.key === "ArrowLeft") i--;
      else if (ev.key === "Home") i = 0; else if (ev.key === "End") i = n - 1;
      else if (ev.key === "Escape") { mostrar(-1); return; } else return;
      ev.preventDefault(); mostrar(Math.max(0, Math.min(n - 1, i)));
    };
    if (activo >= 0) mostrar(activo);
  }

  dibujar();
  if (lienzo._ro) lienzo._ro.disconnect();
  if ("ResizeObserver" in window) {
    var ultimo = lienzo.clientWidth;
    lienzo._ro = new ResizeObserver(function () {
      if (Math.abs(lienzo.clientWidth - ultimo) < 1) return;
      ultimo = lienzo.clientWidth; dibujar();
    });
    lienzo._ro.observe(lienzo);
  }
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
    svg.appendChild(s("text", { x: W + 6, y: y(ref) + 4, "font-size": 12, fill: "#667085" }, num(ref, 0) + " %"));
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
   Vistas
   ==================================================================== */
function pintarPortada(m) {
  var lede = vaciar($("lede"));
  var b = function (t) { return h("b", { text: t }); };
  lede.appendChild(document.createTextNode("A " + m.mes + " de 2026 la mora total de Jaspe es "));
  lede.appendChild(b(pct(m.mora)));
  lede.appendChild(document.createTextNode(", " + num(m.brecha) + " puntos sobre la mediana de las " + m.N + " cooperativas del segmento 4. "));
  if (m.id === "sep") {
    lede.appendChild(document.createTextNode("Bajó " + num(m.baja) + " puntos desde " + MESES[m.pico] + ", pero " +
      (m.porCartera > m.porImproductiva
        ? "más por el crecimiento de la cartera que por la reducción de la cartera improductiva."
        : "más por la reducción de la cartera improductiva que por el crecimiento de la cartera.")));
  } else {
    lede.appendChild(document.createTextNode("Bajó " + num(m.baja) + " puntos frente a marzo; la brecha se concentra en microcrédito."));
  }

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

function indicador(rotulo, valor, unidad, nota, grafico) {
  var v = h("p", { class: "ind-valor" }, [valor, unidad ? h("small", { text: " " + unidad }) : null]);
  return h("div", { class: "ind" }, [
    h("p", { class: "ind-rotulo", text: rotulo }), v,
    h("p", { class: "ind-nota", text: nota }),
    grafico ? h("div", { class: "ind-graf" }, [grafico]) : null
  ]);
}

function pintarIndicadores(m) {
  var caja = vaciar($("indicadores"));
  var serie = m.id === "sep";
  var marca = h("i"); marca.style.left = ((m.puesto - 1) / (m.N - 1) * 100).toFixed(1) + "%";
  var pista = h("div", {}, [
    h("div", { class: "pista" }, [h("b"), marca]),
    h("div", { class: "pista-ejes" }, [h("span", { text: "menor mora" }), h("span", { text: "mayor" })])
  ]);

  caja.appendChild(indicador("Mora total", num(m.mora), "%",
    serie ? pct(m.serieJ[m.pico]) + " en " + MESES[m.pico] + ", el punto más alto del año" : pct(m.serieJ[0]) + " en marzo",
    serie ? tendencia(m.serieJ) : null));
  caja.appendChild(indicador("Brecha frente a la mediana", signo(m.brecha), "pp",
    "Mediana del segmento 4: " + pct(m.med),
    serie ? tendencia(m.serieBrecha) : null));
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

function pintarFig1(m) {
  var fig = vaciar($("fig1"));
  var serie = m.id === "sep";
  fig.appendChild(h("h3", {
    text: serie ? "La mora de Jaspe baja desde " + MESES[m.pico] + " y sigue por encima de la mediana"
                : "La mora de Jaspe bajó en el trimestre y sigue por encima de la mediana"
  }));
  fig.appendChild(h("p", { class: "figura-sub" }, [h("span", { class: "ref", text: "Figura 1." }),
    serie ? " Morosidad total mensual, enero a septiembre de 2026, en % de la cartera bruta"
          : " Morosidad total, marzo y junio de 2026, en % de la cartera bruta"]));
  var ley = h("div", { class: "leyenda" });
  [["Jaspe", COLOR.jaspe], ["Mediana del segmento 4", COLOR.mediana]].forEach(function (l) {
    var i = h("i"); i.style.borderTopColor = l[1];
    ley.appendChild(h("span", {}, [i, l[0]]));
  });
  fig.appendChild(ley);
  var lienzo = h("div", { class: "lienzo" });
  fig.appendChild(lienzo);

  var tabla = h("table", { class: "tabla" });
  tabla.appendChild(h("thead", {}, [h("tr", {}, ["Mes", "Jaspe", "Mediana", "Brecha", "Improductiva", "Cartera bruta"].map(function (t) { return h("th", { scope: "col", text: t }); }))]));
  var cuerpo = h("tbody");
  m.etiquetasLargas.forEach(function (mes, i) {
    cuerpo.appendChild(h("tr", {}, [cap(mes), pct(m.serieJ[i]), pct(m.serieMed[i]), signo(m.serieJ[i] - m.serieMed[i]) + " pp",
      usd(m.saldos[i].i), usd(m.saldos[i].b)].map(function (t) { return h("td", { text: t }); })));
  });
  tabla.appendChild(cuerpo);
  fig.appendChild(h("div", { class: "figura-pie" }, [
    h("p", { text: "Fuente: " + m.fuenteCorta + ". " + (serie
      ? "La mediana se calcula cada mes sobre las cooperativas que reportan ese mes."
      : "Mediana de marzo sobre las " + m.enAmbos + " cooperativas presentes en ambos cortes.") }),
    h("details", { class: "datos" }, [h("summary", { text: "Ver datos de la figura" }), tabla])
  ]));

  graficoLineas(lienzo, {
    descripcion: "Morosidad total de Jaspe y mediana del segmento 4. Use las flechas para recorrer los meses.",
    etiquetas: m.etiquetas, etiquetasLargas: m.etiquetasLargas,
    series: [
      { nombre: "Jaspe", corto: "Jaspe", color: COLOR.jaspe, valores: m.serieJ, enfasis: true },
      { nombre: "Mediana del segmento", corto: "Mediana", color: COLOR.mediana, valores: m.serieMed }
    ],
    marcar: serie ? m.pico : undefined,
    extra: function (i) { return usd(m.saldos[i].i) + " improductivos de " + usd(m.saldos[i].b); }
  });
}

function pintarHallazgos(m) {
  var ol = vaciar($("hallazgos"));
  var items;
  if (m.id === "sep") {
    items = [
      ["La mora bajó " + num(m.baja) + " puntos desde " + MESES[m.pico],
       "De " + pct(m.serieJ[m.pico]) + " a " + pct(m.mora) + ". En el mismo lapso la mediana del segmento bajó " + num(m.bajaMed) + " puntos."],
      [(m.porCartera > m.porImproductiva ? "Más de la mitad" : "Menos de la mitad") + " de la baja viene del crecimiento de la cartera",
       num(m.porCartera, 1) + " puntos se explican porque la cartera creció " + num(m.crecCartera, 1) + " %; " + num(m.porImproductiva, 1) +
       " porque la cartera improductiva bajó " + usd(m.bajaImpUsd) + ".", "origen"],
      ["La brecha con el segmento está en microcrédito",
       pct(m.mic) + " frente a una mediana de " + pct(m.medMic) + ". Consumo está en línea: " + pct(m.con) + " frente a " + pct(m.medCon) + ".", "pares"]
    ];
  } else {
    items = [
      ["La mora bajó " + num(m.baja) + " puntos en el trimestre",
       "De " + pct(m.serieJ[0]) + " en marzo a " + pct(m.mora) + " en junio. " + m.mejoraron + " de las " + m.enAmbos +
       " cooperativas presentes en ambos cortes también la redujeron."],
      ["La brecha con el segmento está en microcrédito",
       pct(m.mic) + " frente a una mediana de " + pct(m.medMic) + ". Consumo está en línea: " + pct(m.con) + " frente a " + pct(m.medCon) + ".", "pares"],
      ["Para igualar la mediana, microcrédito tendría que bajar a " + pct(m.micObjetivo),
       "Hoy está en " + pct(m.mic) + ". El cálculo mantiene fijos la cartera de consumo y los montos.", "simulador"]
    ];
  }
  items.forEach(function (it) {
    ol.appendChild(h("li", {}, [h("h3", { text: it[0] }), h("p", { text: it[1] }),
      it[2] ? h("span", { class: "ir", text: "Detalle en la sección " + numeroDe(m, it[2]) + " (pendiente)" }) : null]));
  });
}

/* Secciones del informe: clave, título, si ya está construida y, si aplica, el único corte que la tiene.
   Los números se asignan según las secciones que aplican al corte activo. */
var SECCIONES = [
  ["resumen", "Resumen ejecutivo", true],
  ["origen", "Origen de la baja", false, "sep"],
  ["senales", "Señales de la cartera", false, "sep"],
  ["pares", "Comparación con pares", false],
  ["simulador", "Simulador", false],
  ["limites", "Límites del análisis", false],
  ["ficha", "Ficha técnica", false, null, "A"]
];
function seccionesDe(m) {
  var k = 0;
  return SECCIONES.filter(function (sec) { return !sec[3] || sec[3] === m.id; })
    .map(function (sec) { return { clave: sec[0], titulo: sec[1], lista: sec[2], num: sec[4] || String(++k) }; });
}
function numeroDe(m, clave) {
  return seccionesDe(m).filter(function (x) { return x.clave === clave; })[0].num;
}
function pintarIndice(m) {
  var ol = vaciar($("indice")), secs = seccionesDe(m);
  secs.forEach(function (sec) {
    var cont = [h("span", { class: "num", text: sec.num }), sec.titulo];
    ol.appendChild(h("li", {}, [sec.lista ? h("a", { href: "#" + sec.clave, "aria-current": "true" }, cont) : h("span", {}, cont)]));
  });
  $("pendiente").textContent = "Vista previa de la revisión 2: cabecera y resumen ejecutivo. Las secciones 2 a " +
    (secs.length - 1) + " y la ficha técnica se construyen después de aprobar esta parte.";
}

/* ---------- corte activo ---------- */
function pintar(id) {
  var m = MODELOS[id];
  Array.prototype.forEach.call(document.querySelectorAll(".corte button"), function (b) {
    b.setAttribute("aria-pressed", b.getAttribute("data-corte") === id ? "true" : "false");
  });
  pintarPortada(m); pintarIndicadores(m); pintarFig1(m); pintarHallazgos(m); pintarIndice(m);
  document.documentElement.setAttribute("data-corte", id);
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

pintar(corteInicial());
window.INFORME = { modelos: MODELOS };  // expuesto para verificación
})();
