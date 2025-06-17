### Rangos OMS 2021 para PM 2,5 (media 24 h)

| Etiqueta OMS          | Intervalo (µg/m³) | Significado sanitario (resumen)                             |
| --------------------- | ----------------- | ----------------------------------------------------------- |
| **AQG (guía máxima)** | ≤ 15              | Aire "seguro"; riesgo mínimo                                |
| **IT-4**              | 15 – 25           | Riesgo leve; vigilar población sensible                     |
| **IT-3**              | 25 – 37,5         | Riesgo moderado; sensibles deben limitar actividad exterior |
| **IT-2**              | 37,5 – 50         | Riesgo alto; la población general puede notar síntomas      |
| **IT-1**              | 50 – 75           | Riesgo muy alto; evitar ejercicio al aire libre             |
| **> IT-1**            | > 75              | Riesgo extremo; permanecer en interiores                    |

Fuente de los valores: OMS 2021 Global Air Quality Guidelines, tabla 2.1.&#x20;

---

## Formato recomendado para que un LLM genere el comentario diario

Un único **JSON** (o JSON-L / JSON Lines) con:

1. **Metadatos fijos**
2. **Observaciones** (últimos 5 días)
3. **Predicciones** (hoy + mañana)

```jsonc
{
  "meta": {
    "pollutant": "PM2.5",
    "unit": "µg/m³",
    "averaging_period": "24h",
    "thresholds": {          // Rangos OMS 2021
      "AQG": 15,
      "IT-4": 25,
      "IT-3": 37.5,
      "IT-2": 50,
      "IT-1": 75
    }
  },

  "observations": [          // cinco medias móviles más recientes
    { "date": "2025-06-06", "value": 18.2 },
    { "date": "2025-06-05", "value": 20.3 },
    { "date": "2025-06-04", "value": 22.0 },
    { "date": "2025-06-03", "value": 21.9 },
    { "date": "2025-06-02", "value": 22.4 }
  ],

  "predictions": [           // hoy y mañana
    { "date": "2025-06-07", "value": 19.4 },
    { "date": "2025-06-08", "value": 28.0 }
  ]
}
```

### Por qué funciona bien para un LLM

* **Llave "meta" separada** ⇒ la IA no repite umbrales en cada punto.
* **Arrays ordenados por fecha ISO-8601** ⇒ fácil cálculo de tendencia.
* **Valores numéricos puros** ⇒ el modelo infiere la categoría comparando con `meta.thresholds`, o bien puedes precalcular un campo `category`.
* **Claridad semántica** (`observations` vs `predictions`) ⇒ evita ambigüedad en el comentario ("ayer", "hoy").

---

### Sugerencia mínima de flujo

1. **Backend**: rellena el JSON cada día (inserta la nueva observación y las 2 predicciones).
2. **LLM prompt**:

   > *"Con la siguiente entrada JSON, escribe un párrafo en castellano que describa la evolución de los últimos 5 días de PM 2,5, indica si la tendencia es al alza o a la baja, menciona en qué rango OMS queda el valor de hoy y adelanta el riesgo previsto para mañana."*
3. **Frontend**: muestra el comentario y, si quieres, una barrita de color calculada a partir de `category`.

---

#### Alternativas válidas

* **CSV** con cabecera fija

  ```
  date,value,type   # type = obs | pred
  2025-06-06,18.2,obs
  ...
  ```

  pero JSON es más autodescriptivo.
* **GraphQL / REST endpoint** devolviendo el mismo JSON.
* Añadir `delta` (variación respecto al día anterior) o `rolling_mean_7d` si prefieres que la IA se centre solo en interpretación, no en cálculo.

Con esta estructura tendrás un input limpio, consistente y fácil de escalar para que tu modelo genere el comentario diario sin esfuerzo.
