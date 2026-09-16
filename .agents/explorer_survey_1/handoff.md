# 📋 INFORME FORENSE DE INVESTIGACIÓN: R1 (CIRUGÍA 2.1) — SINCRONIZACIÓN UNIVERSAL DE STOP-WORDS, WHITELIST DE ENTIDADES CORTAS Y ALIAS CULTURALES

**Agente:** Explorer Survey 1 (`teamwork_preview_explorer`)  
**Directorio de Trabajo:** `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\explorer_survey_1`  
**Destinatario:** Parent Orchestrator (`db233a73-dd6b-4945-8057-cdd1e9a20608`)  
**Fecha de Emisión:** 2026-09-16T00:08:00Z  
**Misión:** Levantamiento forense de código para R1 (Cirugía 2.1 de la Fase 2 del Roadmap Cero Deuda): Sincronización de `UNIVERSAL_STOP_WORDS`, whitelist `KNOWN_SHORT_ENTITIES` ("F1", "CR7"), y diccionario cultural `STAND_ENTITY_ALIASES`.

---

## 1. OBSERVATION

Se realizó una inspección directa, quirúrgica y exhaustiva del código fuente en producción, tests automatizados y scripts de auditoría. Se registraron las siguientes observaciones empíricas:

### 1.1 `server/services/embeddingService.js` (Líneas exactas y filtrado de tokens)
- **Ruta del Archivo:** `server/services/embeddingService.js`
- **Métricas de Tamaño:** 177 líneas (152 líneas no vacías según `Measure-Object`), 8,457 bytes.
- **Techo Arquitectónico Autorizado:** $\le 200$ líneas. Margen disponible: **23 líneas**.
- **Línea 3 (Imports cruzados):**
  ```javascript
  import { searchWebPosters, deduplicatePosters, getCachedProducts } from './webCatalogService.js';
  ```
- **Línea 124 (Tokenización y Stop-Words deficientes):**
  ```javascript
  const normQueryTokens = cleanQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter((t) => t.length > 2 && !['para', 'con', 'del', 'los', 'las', 'una', 'uno', 'unos', 'unas', 'por', 'que'].includes(t));
  ```
  *Deficiencias observadas:*
  1. La lista de stop-words está hardcodeada a solo **11 palabras**. Carece de preposiciones, artículos, verbos coloquiales de mostrador ferial y pronombres esenciales (`de`, `la`, `el`, `en`, `y`, `un`, `cuanto`, `cuánto`, `cuesta`, `cuestan`, `precio`, `precios`, `tienen`, `tienes`, `hay`, `muestrame`, `muéstrame`, `mostrar`, `muestra`, `tenemos`, `disponible`, `disponibles`, `catalogo`, `catálogo`, `ver`, `mira`, `dame`, `quiero`, `busca`, `buscar`).
  2. La regla de longitud `t.length > 2` purga indiscriminadamente cualquier token de 2 caracteres (`f1`, `u2`, `r34`, `go`, `up`). Para una búsqueda `"f1"`, `normQueryTokens` resulta en un array vacío `[]`.
  3. `resolveEntityAlias(cleanQuery)` no es invocado en ningún punto de `embeddingService.js`, omitiendo la expansión a títulos canónicos o términos enriquecidos.
- **Líneas 147–153 (Compuerta de similitud y falso positivo por token vacío):**
  ```javascript
  for (const [key, vecEntry] of vectorScores.entries()) {
    if (!combinedScores.has(key) && vecEntry.similarity >= 0.60) {
      const posterText = `${vecEntry.poster.titulo || ''} ${vecEntry.poster.subtitulo || ''} ${Array.isArray(vecEntry.poster.tags) ? vecEntry.poster.tags.join(' ') : ''}`.toLowerCase();
      if (normQueryTokens.length === 0 || normQueryTokens.some((tok) => posterText.includes(tok))) {
        combinedScores.set(key, { poster: vecEntry.poster, hybridScore: vecEntry.similarity * 0.5, isLexicalMatch: false, vecSim: vecEntry.similarity });
      }
    }
  }
  ```
  *Causa raíz observada:*
  Cuando `normQueryTokens` queda vacío (ej. `"f1"` purgado por `t.length > 2`), la condición `normQueryTokens.length === 0` evalúa a `true`. Por consiguiente, cualquier póster en el catálogo cuyo vector supere el umbral base `0.60` (como obras de baloncesto o anime que comparten similitud genérica en el hipercono 768d/3072d) es admitido indiscriminadamente en la mezcla híbrida.
- **Líneas 159–164 (Compuerta estricta frágil de títulos):**
  ```javascript
  if (lexicalList.length > 0 && lexicalList.length <= 4) {
    const topEntityTitles = lexicalList.map((p) => p.titulo.toLowerCase().trim());
    if (topEntityTitles.every((t) => t === topEntityTitles[0])) {
      filteredList = filteredList.filter((p) => p.titulo.toLowerCase().trim() === topEntityTitles[0]);
    }
  }
  ```
  *Deficiencia observada:* Exige igualdad estricta de cadenas de texto (`t === topEntityTitles[0]`). Si una búsqueda de Messi devuelve *"Messi - El Beso Eterno"* y *"Messi - El Beso de la Gloria"*, la condición `every` falla y desactiva la protección, permitiendo que obras vectoriales de otros personajes contaminen la respuesta.

---

### 1.2 `server/services/webCatalogService.js` (Stop-Words y procesamiento de tokens)
- **Ruta del Archivo:** `server/services/webCatalogService.js`
- **Métricas de Tamaño:** 558 líneas (489 líneas no vacías según `Measure-Object`), 21,918 bytes.
- **Líneas 1–3 (Dependencia circular actual con `embeddingService`):**
  ```javascript
  import { prisma } from '../config/prisma.js';
  import { invalidateVectorCache, searchHybridPosters, searchPostersByEmbedding } from './embeddingService.js';
  import { resolveEntityAlias } from './semantic/entityAliases.js';
  ```
  Y en línea 556:
  ```javascript
  export { searchHybridPosters, searchPostersByEmbedding };
  ```
- **Líneas 351–359 (Definición local y no exportada de `STOP_WORDS`):**
  ```javascript
  const STOP_WORDS = new Set([
    'de', 'la', 'el', 'los', 'las', 'en', 'y', 'un', 'una', 'unos', 'unas',
    'con', 'por', 'para', 'cuanto', 'cuánto', 'cuesta', 'cuestan', 'precio',
    'precios', 'tienen', 'tienes', 'hay', 'que', 'del', 'al', 'o', 'poster',
    'posters', 'cuadro', 'cuadros', 'obra', 'obras', 'diseño', 'diseños',
    'hola', 'buenas', 'buenos', 'muestrame', 'mustrame', 'muéstrame',
    'mostrar', 'muestra', 'tenemos', 'disponible', 'disponibles', 'catalogo',
    'catálogo', 'ver', 'mira', 'dame', 'quiero', 'busca', 'buscar'
  ]);
  ```
  *Observación:* Esta lista contiene 52 términos y reside encerrada dentro del ámbito local de `searchWebPosters` (declarada en L351). No se exporta, impidiendo su reutilización en `embeddingService.js` y `liveCatalogSyncService.js`.
- **Líneas 360–363 (Uso de `STOP_WORDS` en tokens de alias):**
  ```javascript
  const aliasRes = resolveEntityAlias(cleanQuery);
  const aliasTokens = (aliasRes.matched && aliasRes.searchQuery)
    ? normalize(aliasRes.searchQuery).split(/\s+/).filter((t) => !STOP_WORDS.has(t) && t.length > 1)
    : [];
  ```
- **Líneas 374–376 (Filtrado de tokens significativos):**
  ```javascript
  const allTokens = Array.from(new Set([...rawTokens, ...aliasTokens, ...expandedTokens]));
  const meaningfulTokens = allTokens.filter((t) => !STOP_WORDS.has(t) && t.length > 1);
  const tokens = meaningfulTokens.length > 0 ? meaningfulTokens : (allTokens.length > 0 ? allTokens : rawTokens);
  ```
- **Líneas 378–382 (Generación de frase condensada sin stop-words):**
  ```javascript
  const getCondensed = (str) =>
    normalize(str)
      .split(/\s+/)
      .filter((t) => !STOP_WORDS.has(t) && t.length > 0)
      .join(' ');
  ```
- **Observación Adicional en `server/services/catalog/liveCatalogSyncService.js:196–200`:**
  Existe una **tercera** definición aislada de `STOP_WORDS` con 18 términos:
  ```javascript
  const STOP_WORDS = new Set([
    'de', 'la', 'el', 'los', 'las', 'en', 'y', 'un', 'una', 'con', 'por', 'para',
    'poster', 'posters', 'cuadro', 'cuadros', 'obra', 'obras', 'dame', 'quiero'
  ]);
  ```

---

### 1.3 `server/services/semantic/entityAliases.js` (Estructura y entidades solicitadas)
- **Ruta del Archivo:** `server/services/semantic/entityAliases.js`
- **Métricas de Tamaño:** 512 líneas (495 líneas no vacías según `Measure-Object`), 20,162 bytes.
- **Techo Arquitectónico Autorizado:** $\le 600$ líneas (autorizado explícitamente en `scripts/audit-monoliths.js`). Margen disponible: **88 líneas**.
- **Estructura Modular Actual:**
  1. `// ── MÚSICA & ÁLBUMES (Con afinidad a PORTADA_ALBUM) ──` (L11–L140): Bad Bunny, Taylor Swift, The Beatles, Pink Floyd, Queen, Nirvana, Michael Jackson, etc.
  2. `// ── CÓMICS, SUPERHÉROES & PELÍCULAS ──` (L141–L217): Spider-Man, Batman, Joker, Pulp Fiction, Star Wars, Harry Potter, etc.
  3. `// ── ANIME & MANGA ──` (L218–L265): Chainsaw Man, Dragon Ball Z, Dragon Ball Super, Demon Slayer, Attack on Titan, One Piece, Naruto.
  4. `// ── MOTORSPORT & AUTOS ──` (L266–L302):
     - L267: `F1 - Red Bull Racing (Checo Pérez & Verstappen)`
     - L276: `F1 - Ayrton Senna / Ferrari`
     - L282: `Porsche 911 Clásico & GT3`
     - L293: `Nissan Skyline GT-R (R34)`
  5. `// ── CULTURA, CINE DE CULTO & SERIES ──` (L303–L345): Pablo Escobar, Los Simpson, Rick and Morty, Pokémon, Studio Ghibli.
  6. `// ── ARTE CLÁSICO & PINTURA ──` (L346–L378): Van Gogh, La Gran Ola, Gustav Klimt, Mona Lisa.
  7. `// ── FÚTBOL & DEPORTES ──` (L379–L415):
     - L380: `Lionel Messi - El Beso Eterno`
     - L395: `Lionel Messi - El Beso de la Gloria`
     - L407: `Lionel Messi`
  8. `// ── GAMING ──` (L416–L429): Five Nights at Freddy's (FNAF), Minecraft / Nintendo.
- **Líneas 439–491 (`resolveEntityAlias`):**
  - Paso 1 (L456–L467): Coincidencia exacta de cadena normalizada (`clean === item.cleanAlias`).
  - Paso 2 (L471–L488): Coincidencia por límites de palabra (`\b...`), ordenando por longitud descendente con la compuerta `if (item.cleanAlias.length >= 3)`.
  *Hallazgo crítico:* Dado que `cleanAlias.length >= 3` descarta tokens de 2 letras en el Paso 2, una consulta conversacional como `"muéstrame de f1"` no hace match exacto en Paso 1 y es ignorada en Paso 2 a menos que:
    a) Se eliminen las stop-words antes de la resolución; o
    b) Se admita `KNOWN_SHORT_ENTITIES` en el Paso 2 (`if (item.cleanAlias.length >= 3 || KNOWN_SHORT_ENTITIES.has(item.cleanAlias))`).
- **Estado de Entidades Requeridas:**
  - `Cristiano Ronaldo - CR7`: **Inexistente** en todo el repositorio (`grep_search` retornó 0 coincidencias en `server/` y `tests/`).
  - `Formula 1 - F1`: Existen entradas particulares para Red Bull y Senna (`AUTOS`), pero falta la entidad canónica unificada `Formula 1 - F1` con alias `['f1', 'formula 1', 'formula uno', 'carreras', 'ferrari f1', 'red bull f1', 'verstappen', 'hamilton', 'senna', 'ayrton senna']`.

---

## 2. LOGIC CHAIN

A partir de las observaciones directas, se construye la cadena causal deductiva:

1. **Premisa 1 (Discrepancia léxica entre servicios):**
   - En L124 de `embeddingService.js`, el array de stop words contiene únicamente 11 palabras (`['para', 'con', 'del', 'los', 'las', 'una', 'uno', 'unos', 'unas', 'por', 'que']`).
   - En L351–L359 de `webCatalogService.js`, existe un Set de 52 stop words que incluye verbos de mostrador (`muestrame`, `tenemos`, `cuanto cuesta`, `hay`, `dame`).
   - *Inferencia:* Consultas coloquiales de clientes en el stand como `"muéstrame lo que tenemos de messi"` conservan `['muestrame', 'tenemos', 'messi']` en `embeddingService.js`, distorsionando los tokens de consulta y arruinando el filtrado de entidades.

2. **Premisa 2 (Purga de entidades cortas y contaminación por array vacío):**
   - En L124 de `embeddingService.js`, el filtro `t.length > 2` descarta todo token de 2 caracteres sin excepciones.
   - En una búsqueda de `"f1"`, el token `"f1"` (longitud 2) es purgado, dejando `normQueryTokens = []`.
   - En L149 de `embeddingService.js`, la compuerta de inclusión evalúa:
     `if (normQueryTokens.length === 0 || normQueryTokens.some((tok) => posterText.includes(tok)))`
   - Dado que `normQueryTokens.length === 0` es `true`, la compuerta queda totalmente abierta. Cualquier obra del catálogo con similitud vectorial $\ge 0.60$ (umbral basal débil) es incorporada a los resultados combinados, provocando la aparición de pósters de baloncesto o anime en búsquedas de F1.

3. **Premisa 3 (Riesgo de Dependencia Circular y Temporal Dead Zone en ESM):**
   - `webCatalogService.js:2` importa funciones desde `embeddingService.js`.
   - `embeddingService.js:3` importa funciones desde `webCatalogService.js`.
   - Si `UNIVERSAL_STOP_WORDS` se exportara como una constante `const Set` desde `webCatalogService.js` y se importara en `embeddingService.js`, el orden de resolución de módulos de Node.js ESM durante la fase de evaluación estática puede provocar un error crítico de Temporal Dead Zone (`ReferenceError: Cannot access 'UNIVERSAL_STOP_WORDS' before initialization`).
   - *Inferencia:* Definir `UNIVERSAL_STOP_WORDS` en una capa inferior común e independiente (como `server/services/semantic/entityAliases.js` o un submódulo de constantes sin dependencias) elimina radicalmente cualquier acoplamiento circular.

4. **Premisa 4 (Capacidad de Techos de Líneas):**
   - `embeddingService.js` tiene 177 líneas (techo 200 $\rightarrow$ 23 líneas libres). La adición de la importación y la lógica de filtrado de entidades cortas toma aproximadamente 6 a 8 líneas, quedando en $\sim 183$ líneas ($\le 200$).
   - `entityAliases.js` tiene 512 líneas (techo 600 $\rightarrow$ 88 líneas libres). La adición de `UNIVERSAL_STOP_WORDS`, `KNOWN_SHORT_ENTITIES` y las 2 entidades con sus alias toma aproximadamente 44 líneas, quedando en $\sim 556$ líneas ($\le 600$).

---

## 3. CAVEATS

1. **Aislamiento de Base de Datos en Tests Unitarios:**
   - Durante la ejecución de tests aislados en desarrollo local, Prisma intenta conectar al puerto `host-db-dokploy:5432` y cae al fallback de memoria. Los componentes probados cuentan con mocks resilientes o paracaídas léxicos que previenen bloqueos, pero las pruebas que requieran la base de datos completa deben ejecutarse en el contenedor o con mocks locales de Prisma.
2. **Impacto en Pruebas Preexistentes de Alias:**
   - En `tests/semantic/semantic-parser.test.js:80-81, 99`, se evalúan las consultas `'checo perez'` y `'el de checo'`. La entidad `F1 - Red Bull Racing (Checo Pérez & Verstappen)` debe conservar dichos alias específicos de pilotos para no romper los tests existentes, mientras que la nueva entidad `Formula 1 - F1` debe absorber los alias genéricos de la categoría (`f1`, `formula 1`, `formula uno`, `carreras`, etc.).
3. **Normalización de Tildes en Stop-Words:**
   - Para garantizar coincidencia del 100%, tanto la versión acentuada (`cuánto`, `catálogo`, `muéstrame`) como la versión normalizada NFD sin diacríticos (`cuanto`, `catalogo`, `muestrame`) deben cohabitar en `UNIVERSAL_STOP_WORDS`.

---

## 4. CONCLUSION

### 4.1 Plan de Acción y Ubicación Exacta de Cambios

#### A. Definición y Exportación de `UNIVERSAL_STOP_WORDS` y `KNOWN_SHORT_ENTITIES`
- **Ubicación Recomendada:** `server/services/semantic/entityAliases.js` (y re-exportada en `server/services/semanticParserService.js`).
- **Razón Arquitectónica:** `entityAliases.js` no depende de `webCatalogService.js` ni de `embeddingService.js`. Ambas capas de búsqueda ya consumen la capa semántica. Se erradica por diseño el riesgo de TDZ por ciclos ESM.
- **Definición Canónica:**
  ```javascript
  export const UNIVERSAL_STOP_WORDS = new Set([
    'de', 'la', 'el', 'los', 'las', 'en', 'y', 'un', 'una', 'unos', 'unas',
    'con', 'por', 'para', 'cuanto', 'cuánto', 'cuesta', 'cuestan', 'precio',
    'precios', 'tienen', 'tienes', 'hay', 'que', 'del', 'al', 'o', 'poster',
    'posters', 'cuadro', 'cuadros', 'obra', 'obras', 'diseño', 'diseños',
    'hola', 'buenas', 'buenos', 'muestrame', 'mustrame', 'muéstrame',
    'mostrar', 'muestra', 'tenemos', 'disponible', 'disponibles', 'catalogo',
    'catálogo', 'ver', 'mira', 'dame', 'quiero', 'busca', 'buscar'
  ]);

  export const KNOWN_SHORT_ENTITIES = new Set(['f1', 'u2', 'r34', 'go', 'up', 'cr7']);
  ```

#### B. Nuevas Entidades en `server/services/semantic/entityAliases.js`
1. **Formula 1 - F1:**
   - **Ubicación:** Sección `// ── MOTORSPORT & AUTOS ──` (inmediatamente antes de Red Bull Racing, $\sim$ L266).
   - **Estructura:**
     ```javascript
     {
       canonicalTitle: 'Formula 1 - F1',
       searchQuery: 'Formula 1 F1 Ferrari Red Bull',
       category: 'DEPORTES',
       aliases: [
         'f1', 'formula 1', 'formula uno', 'carreras', 'ferrari f1', 'red bull f1',
         'verstappen', 'hamilton', 'senna', 'ayrton senna'
       ]
     },
     ```
2. **Cristiano Ronaldo - CR7:**
   - **Ubicación:** Sección `// ── FÚTBOL & DEPORTES ──` (inmediatamente después de Lionel Messi, $\sim$ L415).
   - **Estructura:**
     ```javascript
     {
       canonicalTitle: 'Cristiano Ronaldo - CR7',
       searchQuery: 'Cristiano Ronaldo CR7',
       category: 'FUTBOL',
       aliases: [
         'el bicho', 'cr7', 'cristiano ronaldo', 'cristiano', 'ronaldo', 'siuu', 'el comandante'
       ]
     },
     ```
3. **Ajuste en `resolveEntityAlias` (L474):**
   Actualizar el filtro de longitud para que tokens en `KNOWN_SHORT_ENTITIES` puedan hacer match por límites de palabra en frases complejas:
   ```javascript
   if (item.cleanAlias.length >= 3 || KNOWN_SHORT_ENTITIES.has(item.cleanAlias)) {
   ```

#### C. Intervención en `server/services/embeddingService.js`
- **Imports:**
  ```javascript
  import { UNIVERSAL_STOP_WORDS, KNOWN_SHORT_ENTITIES, resolveEntityAlias } from './semantic/entityAliases.js';
  ```
- **Refactorización de Línea 124:**
  ```javascript
  const aliasRes = resolveEntityAlias(cleanQuery);
  const effectiveQuery = (aliasRes.matched && aliasRes.searchQuery) ? aliasRes.searchQuery : cleanQuery;
  const normQueryTokens = effectiveQuery
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter((t) => (t.length > 2 || KNOWN_SHORT_ENTITIES.has(t)) && !UNIVERSAL_STOP_WORDS.has(t));
  ```

#### D. Intervención en `server/services/webCatalogService.js`
- Reemplazar la declaración local `const STOP_WORDS = new Set([...])` en L351–L359 por la importación directa desde `./semantic/entityAliases.js`.
- Exportar `UNIVERSAL_STOP_WORDS` y `KNOWN_SHORT_ENTITIES` para retrocompatibilidad.

---

## 5. VERIFICATION METHOD

El implementador y el auditor podrán verificar de forma independiente la correcta ejecución de estos cambios mediante los siguientes pasos y comandos:

### 5.1 Comandos de Arnés y Validación Automatizada
1. **Auditoría de Límites de Líneas y Monolitos:**
   ```bash
   npm run audit:monoliths
   ```
   *Condición de éxito:* `embeddingService.js` $\le 200$ líneas; `entityAliases.js` $\le 600$ líneas bajo regla autorizada de cohesión semántica.
2. **Auditoría Zero-Trust de Seguridad:**
   ```bash
   npm run test:security
   npm run audit:secrets
   ```
   *Condición de éxito:* 9/9 tests pasando en verde, 0 secretos o violaciones de aislamiento detectadas.
3. **Suite RAG Vectorial y Similitud Coseno:**
   ```bash
   node --test tests/ai/embeddingService.test.js
   node --test tests/adversarial/m1-embeddings-adversarial.test.js
   ```
   *Condición de éxito:* 17/17 tests y 23/23 tests pasando en verde (100% PASS).
4. **Suite de Parser Semántico y Diccionario Cultural:**
   ```bash
   node --test tests/semantic/semantic-parser.test.js
   ```

### 5.2 Pruebas Unitarias de Regresión Requeridas para R1
Crear o ejecutar un script de aserciones directas que compruebe:
```javascript
// Test 1: Filtrado de stop words coloquiales
const query1 = "muéstrame lo que tenemos de messi";
// normQueryTokens debe ser exactamente ['messi'] (descartando muéstrame, lo, que, tenemos, de).

// Test 2: Retención de entidades cortas
const query2 = "f1";
// normQueryTokens debe retener ['f1'] y no quedar vacío.

// Test 3: Resolución de apodos culturales
assert.strictEqual(resolveEntityAlias('el bicho').canonicalTitle, 'Cristiano Ronaldo - CR7');
assert.strictEqual(resolveEntityAlias('cr7').canonicalTitle, 'Cristiano Ronaldo - CR7');
assert.strictEqual(resolveEntityAlias('formula 1').canonicalTitle, 'Formula 1 - F1');
```

### 5.3 Condiciones de Invalidación
Cualquiera de los siguientes eventos invalida la solución:
- Que `embeddingService.js` supere las 200 líneas.
- Que `entityAliases.js` supere las 600 líneas.
- Que ocurra un `ReferenceError: Cannot access 'UNIVERSAL_STOP_WORDS' before initialization` por ciclo de importación ESM.
- Que la búsqueda de `"f1"` retorne un array vacío de tokens y permita colar pósters de baloncesto en la mezcla híbrida.
