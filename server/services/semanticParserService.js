/**
 * server/services/semanticParserService.js
 * 
 * Parser Semántico, Extractor de Métodos de Pago y Diccionario Cultural de Entidades
 * para STAND {IA} (Deco Vintage Guate & Deko Labs).
 * 
 * Garantiza resolución determinística de lenguaje natural en ventas rápidas de stand,
 * traducción de jerga/apodos de clientes y blindaje de integridad contable.
 */

/**
 * Normaliza cadenas de texto para comparaciones léxicas robustas:
 * minúsculas, eliminación de diacríticos/tildes y espacios redundantes.
 * @param {string} text
 * @returns {string}
 */
export function normalizeSemanticText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. EXTRACTOR ROBUSTO DE MÉTODOS DE PAGO
 * ─────────────────────────────────────────────────────────────────────────────
 * Extrae determinísticamente si el cliente/vendedor indicó TARJETA, TRANSFERENCIA o EFECTIVO.
 * 
 * Regla de precisión:
 * La palabra "quetzales" o "quetzal" por sí sola indica moneda/precio (ej. "a 65 quetzales"),
 * NO método de pago. Por tanto, no se clasifica como EFECTIVO a menos que venga acompañado
 * de "en efectivo", "billete", "cash", "mano" o "al contado".
 */

const PAYMENT_PATTERNS = {
  TARJETA: [
    /\b(tarjeta[s]?|pos|visa|credomatic|debito|credito|card|credit\s*card|debit\s*card|mastercard|terminal|neonet|visalink|link\s*de\s*pago)\b/i,
    /\b(con\s+tarjeta|en\s+tarjeta|por\s+pos|con\s+pos|pasa\s+la\s+tarjeta|desliza)\b/i,
  ],
  TRANSFERENCIA: [
    /\b(transferencia[s]?|transfe|transfer|deposito[s]?|banca|bi\s*en\s*linea|banco\s*industrial|banrural|bac|gyt|ach|comprobante|boleta)\b/i,
    /\b(por\s+transferencia|con\s+transferencia|por\s+transfe|por\s+deposito|banca\s*movil)\b/i,
  ],
  EFECTIVO: [
    /\b(efectivo|billete[s]?|cash|cashito|en\s+mano|al\s+contado|contado|suelto|sencillo|vuelto|cambio)\b/i,
    /\b(en\s+efectivo|con\s+efectivo|pago\s+en\s+mano|con\s+billete)\b/i,
  ],
};

/**
 * Extrae el método de pago a partir de texto libre o transcripción de voz.
 * @param {string} text - Mensaje del usuario o dictado de voz.
 * @returns {'TARJETA' | 'TRANSFERENCIA' | 'EFECTIVO' | null} Método canónico o null si no se especificó.
 */
export function extractPaymentMethod(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = normalizeSemanticText(text);

  // 1. Evaluación contextual prioritaria con preposiciones ("en tarjeta", "por transferencia", "en efectivo")
  if (/\b(en|con|por|mediante|via|vía)\s+(tarjeta|pos|visa|credomatic|debito|credito|card)\b/i.test(clean)) {
    return 'TARJETA';
  }
  if (/\b(en|con|por|mediante|via|vía)\s+(transferencia|transfe|transfer|deposito|banca|ach)\b/i.test(clean)) {
    return 'TRANSFERENCIA';
  }
  if (/\b(en|con|por|mediante|al)\s+(efectivo|cash|billete|mano|contado)\b/i.test(clean)) {
    return 'EFECTIVO';
  }

  // 2. Coincidencia por patrones directos individuales con límites de palabra
  for (const pattern of PAYMENT_PATTERNS.TARJETA) {
    if (pattern.test(clean)) return 'TARJETA';
  }
  for (const pattern of PAYMENT_PATTERNS.TRANSFERENCIA) {
    if (pattern.test(clean)) return 'TRANSFERENCIA';
  }
  for (const pattern of PAYMENT_PATTERNS.EFECTIVO) {
    if (pattern.test(clean)) return 'EFECTIVO';
  }

  return null;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. DICCIONARIO CULTURAL DE ENTIDADES Y OBRAS DE ARTE (STAND_ENTITY_ALIASES)
 * ─────────────────────────────────────────────────────────────────────────────
 * Mapea la jerga coloquial, apodos y peticiones frecuentes de clientes en eventos
 * hacia los títulos canónicos y términos óptimos de búsqueda en el catálogo.
 */
export const STAND_ENTITY_ALIASES = [
  // ── MÚSICA & ÁLBUMES (Con afinidad a PORTADA_ALBUM) ───────────────────────
  {
    canonicalTitle: 'Bad Bunny - Un Verano Sin Ti',
    searchQuery: 'Un Verano Sin Ti Bad Bunny',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: [
      'un verano sin ti', 'verano sin ti', 'bad bunny', 'conejo malo', 'el conejo malo',
      'benito', 'el corazon de bad bunny', 'corazon con ojos', 'corazon triste',
      'bad buni', 'badbunny', 'el conejo', 'el benito'
    ]
  },
  {
    canonicalTitle: 'Bad Bunny - YHLQMDLG',
    searchQuery: 'YHLQMDLG Bad Bunny',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['yhlqmdlg', 'yo hago lo que me da la gana', 'el del nino en bicicleta']
  },
  {
    canonicalTitle: 'Bad Bunny - Nadie Sabe Lo Que Va a Pasar Mañana',
    searchQuery: 'Nadie Sabe Bad Bunny',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['nadie sabe', 'nadie sabe lo que va a pasar manana', 'bad bunny caballo']
  },
  {
    canonicalTitle: 'Taylor Swift - The Eras Tour / 1989',
    searchQuery: 'Taylor Swift Eras Tour 1989',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: [
      'taylor swift', 'la taylor', 'la de taylor', 'swiftie', 'eras tour', 'the eras tour',
      '1989', 'folklore', 'midnights', 'reputation', 'red taylor', 'lover taylor'
    ]
  },
  {
    canonicalTitle: 'The Beatles - Abbey Road',
    searchQuery: 'The Beatles Abbey Road',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['the beatles', 'beatles', 'los beatles', 'abbey road', 'cruzando la calle', 'john lennon']
  },
  {
    canonicalTitle: 'Pink Floyd - The Dark Side of the Moon',
    searchQuery: 'Pink Floyd Dark Side Moon',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['pink floyd', 'el prisma', 'dark side of the moon', 'el arcoiris en el triangulo', 'the wall']
  },
  {
    canonicalTitle: 'Queen - Freddie Mercury',
    searchQuery: 'Queen Freddie Mercury',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['queen', 'freddie mercury', 'bohemian rhapsody', 'el de queen']
  },
  {
    canonicalTitle: 'Nirvana - Nevermind',
    searchQuery: 'Nirvana Nevermind',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['nirvana', 'kurt cobain', 'nevermind', 'el bebe en la piscina', 'bebe nadando']
  },
  {
    canonicalTitle: 'Michael Jackson - King of Pop',
    searchQuery: 'Michael Jackson Thriller',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['michael jackson', 'el rey del pop', 'thriller', 'billie jean']
  },
  {
    canonicalTitle: 'Canserbero - Vida y Muerte',
    searchQuery: 'Canserbero Vida Muerte',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['canserbero', 'el can', 'tyrone gonzalez', 'vida y muerte canserbero']
  },
  {
    canonicalTitle: 'Gustavo Cerati / Soda Stereo',
    searchQuery: 'Gustavo Cerati Soda Stereo',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['cerati', 'gustavo cerati', 'soda stereo', 'bocanada', 'fuerza natural']
  },
  {
    canonicalTitle: 'Feid - Ferxxo',
    searchQuery: 'Feid Ferxxo',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['feid', 'ferxxo', 'el ferxxo', 'mor', 'feliz cumpleanos ferxxo']
  },
  {
    canonicalTitle: 'Karol G - Mañana Será Bonito',
    searchQuery: 'Karol G Manana Sera Bonito',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['karol g', 'la bichota', 'manana sera bonito', 'bichota']
  },
  {
    canonicalTitle: 'Daft Punk - Discovery / RAM',
    searchQuery: 'Daft Punk Robots',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['daft punk', 'los robots', 'random access memories', 'discovery']
  },
  {
    canonicalTitle: 'Gorillaz - Demon Days',
    searchQuery: 'Gorillaz Demon Days',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['gorillaz', 'demon days', 'los 4 cuadros de gorillaz', '2d gorillaz']
  },
  {
    canonicalTitle: 'The Weeknd - Starboy / After Hours',
    searchQuery: 'The Weeknd Starboy',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['the weeknd', 'starboy', 'after hours', 'blinding lights']
  },

  // ── SUPERHÉROES & CÓMICS ──────────────────────────────────────────────────
  {
    canonicalTitle: 'Spider-Man Vintage Comic',
    searchQuery: 'Spider-Man Vintage Comic Marvel',
    category: 'SUPERHEROES',
    aliases: [
      'spiderman', 'spider-man', 'el hombre arana', 'el hombre araña', 'hombre arana',
      'peter parker', 'miles morales', 'spiderverse', 'into the spider verse', 'arana marvel'
    ]
  },
  {
    canonicalTitle: 'Batman - The Dark Knight',
    searchQuery: 'Batman Dark Knight DC',
    category: 'SUPERHEROES',
    aliases: [
      'batman', 'el caballero de la noche', 'dark knight', 'el bati', 'bruce wayne', 'batman vintage'
    ]
  },
  {
    canonicalTitle: 'Joker - Heath Ledger / Phoenix',
    searchQuery: 'Joker Guason DC',
    category: 'SUPERHEROES',
    aliases: ['joker', 'el guason', 'el bromas', 'heath ledger', 'joker escaleras', 'why so serious']
  },
  {
    canonicalTitle: 'Marvel - Avengers & Iron Man',
    searchQuery: 'Avengers Iron Man Marvel',
    category: 'SUPERHEROES',
    aliases: ['iron man', 'ironman', 'tony stark', 'avengers', 'los vengadores', 'capitan america', 'thor']
  },
  {
    canonicalTitle: 'Deadpool & Wolverine',
    searchQuery: 'Deadpool Wolverine Marvel',
    category: 'SUPERHEROES',
    aliases: ['deadpool', 'wolverine', 'guepardo', 'lobezno', 'ryan reynolds']
  },

  // ── ANIME & MANGA ─────────────────────────────────────────────────────────
  {
    canonicalTitle: 'Dragon Ball - Goku Ultra Instinct',
    searchQuery: 'Goku Dragon Ball Ultra Instinct',
    category: 'ANIME',
    aliases: [
      'goku', 'dragon ball', 'dragon ball z', 'kakaroto', 'sayayin', 'supersayayin',
      'ultra instinto', 'vegeta', 'gohan', 'trunks', 'shenlong'
    ]
  },
  {
    canonicalTitle: 'Chainsaw Man - Denji & Pochita',
    searchQuery: 'Chainsaw Man Denji Pochita',
    category: 'ANIME',
    aliases: [
      'chainsaw man', 'chainsawman', 'el pibe motosierra', 'el vato motosierra',
      'motosierra', 'denji', 'pochita', 'makima', 'power chainsaw'
    ]
  },
  {
    canonicalTitle: 'Demon Slayer - Kimetsu no Yaiba',
    searchQuery: 'Demon Slayer Kimetsu Tanjiro',
    category: 'ANIME',
    aliases: [
      'demon slayer', 'kimetsu', 'kimetsu no yaiba', 'tanjiro', 'nezuko',
      'zenitsu', 'rengoku', 'los pilares'
    ]
  },
  {
    canonicalTitle: 'Attack on Titan - Shingeki no Kyojin',
    searchQuery: 'Attack on Titan Shingeki Eren',
    category: 'ANIME',
    aliases: [
      'attack on titan', 'shingeki', 'shingeki no kyojin', 'titan', 'titanes',
      'eren', 'eren jaeger', 'levi', 'levi ackerman'
    ]
  },
  {
    canonicalTitle: 'One Piece - Monkey D. Luffy',
    searchQuery: 'One Piece Luffy Gear 5',
    category: 'ANIME',
    aliases: ['one piece', 'luffy', 'monkey d luffy', 'zoro', 'gear 5', 'los mugiwara']
  },
  {
    canonicalTitle: 'Jujutsu Kaisen - Gojo Satoru',
    searchQuery: 'Jujutsu Kaisen Gojo Satoru',
    category: 'ANIME',
    aliases: ['jujutsu kaisen', 'gojo', 'gojo satoru', 'sukuna', 'itadori', 'megumi']
  },
  {
    canonicalTitle: 'Death Note - Ryuk & L',
    searchQuery: 'Death Note Ryuk L',
    category: 'ANIME',
    aliases: ['death note', 'ryuk', 'kira', 'light yagami']
  },
  {
    canonicalTitle: 'Naruto Shippuden',
    searchQuery: 'Naruto Shippuden Sasuke',
    category: 'ANIME',
    aliases: ['naruto', 'naruto shippuden', 'sasuke', 'itachi', 'kakashi']
  },

  // ── MOTORSPORT & AUTOS ────────────────────────────────────────────────────
  {
    canonicalTitle: 'F1 - Red Bull Racing (Checo Pérez & Verstappen)',
    searchQuery: 'Formula 1 Red Bull Checo Perez Verstappen',
    category: 'AUTOS',
    aliases: [
      'f1', 'formula 1', 'formula uno', 'checo', 'checo perez', 'checo pérez',
      'sergio perez', 'verstappen', 'max verstappen', 'red bull racing', 'el de checo'
    ]
  },
  {
    canonicalTitle: 'F1 - Ayrton Senna / Ferrari',
    searchQuery: 'Ayrton Senna Ferrari F1',
    category: 'AUTOS',
    aliases: ['senna', 'ayrton senna', 'ferrari f1', 'leclerc', 'hamilton', 'mclaren f1']
  },
  {
    canonicalTitle: 'Porsche 911 Clásico & GT3',
    searchQuery: 'Porsche 911 Clasico Turbo',
    category: 'AUTOS',
    aliases: ['porsche', 'porsche 911', 'el 911', 'porsche turbo', 'porsche gt3']
  },
  {
    canonicalTitle: 'Nissan Skyline GT-R R34',
    searchQuery: 'Nissan Skyline GTR R34',
    category: 'AUTOS',
    aliases: ['skyline', 'gtr', 'gt-r', 'skyline r34', 'r34', 'godzilla']
  },
  {
    canonicalTitle: 'Supercars - Ferrari & Lamborghini',
    searchQuery: 'Ferrari Lamborghini Supercars',
    category: 'AUTOS',
    aliases: ['ferrari', 'lamborghini', 'lambo', 'testarossa', 'countach', 'aventador']
  },

  // ── CINE & SERIES DE CULTO ────────────────────────────────────────────────
  {
    canonicalTitle: 'Pablo Escobar (Sonrisa / Mugshot)',
    searchQuery: 'Pablo Escobar Sonrisa Mugshot',
    category: 'HISTORICOS',
    aliases: [
      'pablo', 'pablo escobar', 'el patron', 'el patrón', 'la sonrisa de pablo',
      'el mugshot de pablo', 'pablo sonriendo', 'cartel de medellin', 'escobar'
    ]
  },
  {
    canonicalTitle: 'Star Wars - Darth Vader & Grogu',
    searchQuery: 'Star Wars Darth Vader Grogu Mandalorian',
    category: 'SERIESYPELICULAS',
    aliases: [
      'star wars', 'la guerra de las galaxias', 'darth vader', 'vader', 'yoda',
      'baby yoda', 'grogu', 'mandalorian', 'el mandaloriano', 'anakin', 'stormtrooper'
    ]
  },
  {
    canonicalTitle: 'The Godfather - El Padrino',
    searchQuery: 'The Godfather El Padrino Marlon Brando',
    category: 'SERIESYPELICULAS',
    aliases: ['el padrino', 'the godfather', 'don vito', 'vito corleone', 'marlon brando']
  },
  {
    canonicalTitle: 'Pulp Fiction - Tiempos Violentos',
    searchQuery: 'Pulp Fiction Tiempos Violentos Tarantino',
    category: 'SERIESYPELICULAS',
    aliases: ['pulp fiction', 'tiempos violentos', 'mia wallace', 'vincent vega', 'tarantino']
  },
  {
    canonicalTitle: 'Scarface - Tony Montana',
    searchQuery: 'Scarface Tony Montana Cara Cortada',
    category: 'SERIESYPELICULAS',
    aliases: ['scarface', 'cara cortada', 'tony montana', 'al pacino']
  },
  {
    canonicalTitle: 'Breaking Bad - Walter White Heisenberg',
    searchQuery: 'Breaking Bad Walter White Heisenberg',
    category: 'SERIESYPELICULAS',
    aliases: ['breaking bad', 'walter white', 'heisenberg', 'los pollos hermanos', 'jesse pinkman']
  },
  {
    canonicalTitle: 'Peaky Blinders - Thomas Shelby',
    searchQuery: 'Peaky Blinders Thomas Shelby',
    category: 'SERIESYPELICULAS',
    aliases: ['peaky blinders', 'thomas shelby', 'tommy shelby', 'los peaky blinders']
  },
  {
    canonicalTitle: 'Fight Club - El Club de la Pelea',
    searchQuery: 'Fight Club El Club de la Pelea Brad Pitt',
    category: 'SERIESYPELICULAS',
    aliases: ['fight club', 'el club de la pelea', 'tyler durden']
  },

  // ── OBRAS DE ARTE CLÁSICAS ────────────────────────────────────────────────
  {
    canonicalTitle: 'Leonardo da Vinci - La Mona Lisa (La Gioconda)',
    searchQuery: 'La Mona Lisa Gioconda Da Vinci',
    category: 'ARTE',
    aliases: ['mona lisa', 'la mona lisa', 'la gioconda', 'gioconda', 'da vinci', 'leonardo da vinci']
  },
  {
    canonicalTitle: 'Vincent van Gogh - La Noche Estrellada',
    searchQuery: 'La Noche Estrellada Van Gogh',
    category: 'ARTE',
    aliases: ['la noche estrellada', 'noche estrellada', 'van gogh', 'starry night']
  },
  {
    canonicalTitle: 'Gustav Klimt - El Beso',
    searchQuery: 'El Beso Gustav Klimt',
    category: 'ARTE',
    aliases: ['el beso', 'el beso de klimt', 'klimt', 'gustav klimt']
  },
  {
    canonicalTitle: 'Edvard Munch - El Grito',
    searchQuery: 'El Grito Edvard Munch',
    category: 'ARTE',
    aliases: ['el grito', 'el grito de munch', 'munch']
  },

  // ── GAMING ────────────────────────────────────────────────────────────────
  {
    canonicalTitle: 'Five Nights at Freddy\'s (FNAF)',
    searchQuery: 'Five Nights at Freddys FNAF',
    category: 'GAMING',
    aliases: ['five nights at freddys', 'fnaf', 'freddy', 'los animatronicos', 'golden freddy']
  },
  {
    canonicalTitle: 'Minecraft / Nintendo',
    searchQuery: 'Minecraft Super Mario Zelda Pokemon',
    category: 'GAMING',
    aliases: ['minecraft', 'mario', 'super mario', 'zelda', 'link', 'pokemon', 'pikachu']
  }
];

/**
 * Resuelve una consulta de cliente o vendedor contrastándola con el diccionario cultural.
 * Aplica coincidencia exacta prioritaria y límites de palabra para evitar colisiones
 * (ej. "rengoku" no debe colisionar con el substring "goku").
 * @param {string} query - Término o apodo buscado por el usuario.
 * @returns {{ matched: boolean, canonicalTitle?: string, searchQuery?: string, category?: string, defaultSizeId?: string, query: string }}
 */
export function resolveEntityAlias(query) {
  if (!query || typeof query !== 'string') return { matched: false, query: '' };
  const clean = normalizeSemanticText(query);

  // 1. Coincidencia exacta con cualquier alias
  for (const entity of STAND_ENTITY_ALIASES) {
    for (const alias of entity.aliases) {
      const cleanAlias = normalizeSemanticText(alias);
      if (clean === cleanAlias) {
        return {
          matched: true,
          canonicalTitle: entity.canonicalTitle,
          searchQuery: entity.searchQuery,
          category: entity.category,
          defaultSizeId: entity.defaultSizeId || null,
          query,
        };
      }
    }
  }

  // 2. Coincidencia con límites de palabra (\b) para frases compuestas
  for (const entity of STAND_ENTITY_ALIASES) {
    for (const alias of entity.aliases) {
      const cleanAlias = normalizeSemanticText(alias);
      if (cleanAlias.length >= 3) {
        const escaped = cleanAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordBoundaryRegex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i');
        if (wordBoundaryRegex.test(clean)) {
          return {
            matched: true,
            canonicalTitle: entity.canonicalTitle,
            searchQuery: entity.searchQuery,
            category: entity.category,
            defaultSizeId: entity.defaultSizeId || null,
            query,
          };
        }
      }
    }
  }

  return { matched: false, query };
}

/**
 * Normaliza y enriquece la consulta de búsqueda de catálogo:
 * traduce alias culturales y limpia palabras de relleno comunes en stand.
 * @param {string} rawQuery - Consulta cruda del usuario.
 * @returns {string} Consulta canónica optimizada para searchWebPosters.
 */
export function normalizeArtworkQuery(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') return '';
  const aliasRes = resolveEntityAlias(rawQuery);
  if (aliasRes.matched && aliasRes.searchQuery) {
    return aliasRes.searchQuery;
  }

  // Si no coincidió con un alias exacto, limpiar frases de relleno de mostrador
  return rawQuery
    .replace(/\b(el de|la de|el póster de|el poster de|el cuadro de|la portada de|un poster de|uno de|una de|el diseño de)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. PARSER SEMÁNTICO COMPLETO DE INTENCIÓN DE VENTA EN STAND (parseStandIntent)
 * ─────────────────────────────────────────────────────────────────────────────
 * Analiza frases complejas en lenguaje natural como:
 * "1 de un verano sin ti portada en tarjeta"
 * "2 spiderman mediano en efectivo y 1 de batman grande con visa"
 */

const NUMBER_WORDS = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
};

/**
 * Extrae la cantidad numérica entera mencionada en un segmento.
 * @param {string} segment
 * @returns {number}
 */
function extractQuantity(segment) {
  const numMatch = segment.match(/\b([1-9]|10)\b/);
  if (numMatch) return parseInt(numMatch[1], 10);

  const clean = normalizeSemanticText(segment);
  for (const [word, val] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(clean)) return val;
  }
  return 1;
}

/**
 * Extrae el identificador de tamaño normalizado de un segmento de texto.
 * @param {string} segment
 * @returns {string|null}
 */
function extractSizeIdFromSegment(segment) {
  const clean = normalizeSemanticText(segment);

  // 1. Portada de Álbum / Vinilo cuadrado
  if (/\b(portada|portada\s*de\s*album|vinilo|album|álbum|cuadrad[oa]|disco|12\s*x\s*12|30\s*x\s*30)\b/i.test(clean)) {
    return 'PORTADA_ALBUM';
  }
  // 2. Gigante
  if (/\b(gigante|extra\s*grande|xl|24\s*x\s*36|36\s*x\s*24|60\s*x\s*90|90\s*x\s*60)\b/i.test(clean)) {
    return 'GIGANTE';
  }
  // 3. Grande
  if (/\b(grande|large|l|18\s*x\s*24|24\s*x\s*18|45\s*x\s*60|60\s*x\s*45)\b/i.test(clean)) {
    return 'GRANDE';
  }
  // 4. Pequeño
  if (/\b(peque[ñn]o|chico|small|s|8\s*x\s*10|10\s*x\s*8|21\s*x\s*27|27\s*x\s*21)\b/i.test(clean)) {
    return 'PEQUENO';
  }
  // 5. Mini
  if (/\b(mini|miniatura|xs|5\s*x\s*7|7\s*x\s*5|6\s*x\s*8|8\s*x\s*6|14\s*x\s*21|21\s*x\s*14)\b/i.test(clean)) {
    return 'MINI';
  }
  // 6. Mediano (por defecto en pósters estándar)
  if (/\b(mediano?|medio|medium|m|12\s*x\s*18|18\s*x\s*12|30\s*x\s*45|45\s*x\s*30)\b/i.test(clean)) {
    return 'MEDIANO';
  }

  return null;
}

const SIZE_STANDARD_PRICES = {
  MINI: 25.0,
  PEQUENO: 35.0,
  MEDIANO: 65.0,
  GRANDE: 125.0,
  GIGANTE: 180.0,
  PORTADA_ALBUM: 55.0,
};

/**
 * Parsea determinísticamente un texto libre de venta rápida en stand.
 * @param {string} text - Texto libre dictado o escrito por el vendedor.
 * @returns {object} Objeto con items estructurados, total estimado y método de pago.
 */
export function parseStandIntent(text) {
  if (!text || typeof text !== 'string') {
    return {
      isSaleIntent: false,
      paymentMethod: 'EFECTIVO',
      items: [],
      estimatedTotal: 0,
      confidence: 0,
    };
  }

  const raw = text.trim();
  const paymentMethod = extractPaymentMethod(raw) || 'EFECTIVO';
  const isExplicitSale = /\b(vendi|vendí|venta|cobro|cobre|cobré|anota|cliente\s+paga|lleva|compro|compró|pagado)\b/i.test(raw);

  // Limpiar mención del método de pago y palabras de comando para aislar las obras
  let cleanedForItems = raw
    .replace(/\b(en|con|por)\s+(tarjeta|pos|visa|credomatic|debito|credito|transferencia|transfe|deposito|efectivo|cash)\b/gi, '')
    .replace(/\b(vendi|vendí|anota\s+venta\s+de|anota|cliente\s+paga|acabo\s+de\s+cobrar|cobro|venta)\b/gi, '')
    .trim();

  // Dividir por conjunciones si hay múltiples artículos (" y ", " + ", ",")
  const segments = cleanedForItems
    .split(/\s+y\s+|\s*\+\s*|,\s*/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const parsedItems = [];
  let grandTotal = 0;

  for (const seg of segments) {
    const qty = extractQuantity(seg);
    let sizeId = extractSizeIdFromSegment(seg);

    // Aislar nombre de la obra removiendo cantidad y tamaño del segmento
    let rawTitle = seg
      .replace(/\b([1-9]|10|un|uno|una|dos|tres|cuatro|cinco)\b/gi, '')
      .replace(/\b(de|el|la|los|las|un|una|en|a|por|poster|cuadro|obra)\b/gi, '')
      .replace(/\b(portada|portada\s*de\s*album|vinilo|disco|cuadrad[oa]|gigante|grande|mediano|pequeno|pequeño|mini)\b/gi, '')
      .replace(/\b(18x24|12x18|24x36|30x45|45x60|60x90|14x21|21x27|12x12|30x30)\b/gi, '')
      .replace(/\b(\d+(\.\d+)?\s*quetzales|q\s*\d+)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!rawTitle) rawTitle = 'Póster';

    // Resolver con diccionario cultural de entidades
    const aliasRes = resolveEntityAlias(rawTitle);
    const canonicalName = aliasRes.matched ? aliasRes.canonicalTitle : rawTitle;
    const effectiveSearchQuery = aliasRes.matched ? aliasRes.searchQuery : rawTitle;

    // Si el tamaño no se mencionó explícitamente pero el alias tiene defaultSizeId (ej. música -> PORTADA_ALBUM)
    if (!sizeId) {
      sizeId = aliasRes.defaultSizeId || 'MEDIANO';
    }

    const unitPrice = SIZE_STANDARD_PRICES[sizeId] || 65.0;
    const subtotal = Number((qty * unitPrice).toFixed(2));
    grandTotal += subtotal;

    parsedItems.push({
      rawTitle,
      canonicalName,
      searchQuery: effectiveSearchQuery,
      quantity: qty,
      sizeId,
      unitPrice,
      subtotal,
    });
  }

  return {
    isSaleIntent: isExplicitSale || parsedItems.length > 0,
    paymentMethod,
    items: parsedItems,
    estimatedTotal: Number(grandTotal.toFixed(2)),
    confidence: parsedItems.length > 0 ? 0.95 : 0.4,
  };
}
