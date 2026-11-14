# Morosidad de Jaspe Ltda. frente al segmento 4

Análisis interactivo (INF-SEPS-01, revisión 3) con datos públicos de la Superintendencia de Economía
Popular y Solidaria del Ecuador. Elaborado por Jhoann Gonza.

Publicado en https://jhoanngonza151.github.io/analisis-seps/

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html` | Documento. Solo estructura; el contenido se genera desde los datos. |
| `assets/informe.js` | Modelo de cálculo, componentes de gráfico y secciones. |
| `assets/informe.css` | Estilos de pantalla e impresión (A4). |
| `assets/fonts/` | Bricolage Grotesque e IBM Plex (SIL Open Font License; licencias en la misma carpeta). |
| `data/sep-2026.js` | Corte de septiembre: saldos por cooperativa, serie mensual y saldos de Jaspe. |
| `data/jun-2026.js` | Corte de junio: saldos por cooperativa del boletín trimestral. |
| `septiembre/` | Redirección al informe (dirección anterior). |

## Cortes

El informe abre en el corte de septiembre de 2026. El de junio está en `?corte=jun`.

## Reproducibilidad

Ninguna cifra está escrita a mano: todas se calculan en el navegador a partir de `data/`.
Morosidad = (cartera que no devenga intereses + cartera vencida) ÷ cartera bruta.
La referencia del segmento es la mediana. El detalle está en la ficha técnica del informe.

Para verlo en local hay que servir la carpeta, por ejemplo con `python3 -m http.server`.
