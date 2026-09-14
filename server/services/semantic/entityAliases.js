import { normalizeSemanticText } from './paymentExtractor.js';

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
    canonicalTitle: 'Nirvana - MTV Unplugged in New York',
    searchQuery: 'Nirvana MTV Unplugged in New York',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['unplugged', 'umplugged', 'nirvana unplugged', 'nirvana umplugged', 'mtv unplugged', 'unplugged nirvana', 'el acustico de nirvana', 'acustico nirvana']
  },
  {
    canonicalTitle: 'Nirvana - Nevermind',
    searchQuery: 'Nirvana Nevermind',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['nevermind', 'nirvana nevermind', 'el bebe en la piscina', 'bebe nadando', 'bebe en la piscina']
  },
  {
    canonicalTitle: 'Nirvana - In Utero',
    searchQuery: 'Nirvana In Utero',
    category: 'MUSICA',
    defaultSizeId: 'PORTADA_ALBUM',
    aliases: ['in utero', 'nirvana in utero', 'el angel de nirvana']
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
    canonicalTitle: 'Spider-Man - Traje Avanzado en Óleo y Acuarela',
    searchQuery: 'Spider-Man Traje Avanzado Óleo y Acuarela',
    category: 'SUPERHEROES',
    aliases: [
      'spiderman acuarela azul', 'spider man acuarela azul', 'spider-man acuarela azul',
      'spider acuarela azul', 'spiderman azul', 'spider-man azul', 'spiderman oleo y acuarela',
      'spider man oleo y acuarela', 'spider oleo y acuarela', 'spiderman oleo', 'spider man oleo',
      'spider oleo', 'traje avanzado oleo y acuarela', 'traje avanzado en oleo y acuarela',
      'spiderman acuarela y oleo'
    ]
  },
  {
    canonicalTitle: 'Spider-Man - Traje Avanzado en Acuarela',
    searchQuery: 'Spider-Man Traje Avanzado Acuarela',
    category: 'SUPERHEROES',
    aliases: [
      'spiderman acuarela', 'spider-man acuarela', 'spider man acuarela', 'spider acuarela',
      'traje avanzado acuarela', 'spiderman blanco acuarela', 'spiderman traje avanzado'
    ]
  },
  {
    canonicalTitle: 'Spider-Man Vintage Comic',
    searchQuery: 'Spider-Man',
    category: 'SUPERHEROES',
    aliases: [
      'spiderman', 'spider-man', 'el hombre arana', 'el hombre araña', 'hombre arana',
      'peter parker', 'miles morales', 'spiderverse', 'into the spider verse', 'arana marvel'
    ]
  },
  {
    canonicalTitle: 'Batman - The Dark Knight',
    searchQuery: 'Batman',
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
    searchQuery: 'Dragon Ball Goku',
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
    aliases: ['el beso de klimt', 'el beso klimt', 'gustav klimt el beso', 'klimt el beso', 'gustav klimt', 'klimt', 'el beso']
  },
  {
    canonicalTitle: 'Edvard Munch - El Grito',
    searchQuery: 'El Grito Edvard Munch',
    category: 'ARTE',
    aliases: ['el grito', 'el grito de munch', 'munch']
  },

  // ── FÚTBOL & DEPORTES (Catar 2022 y Leyendas) ──────────────────────────────
  {
    canonicalTitle: 'Messi - El Beso Eterno',
    searchQuery: 'Messi El Beso Eterno',
    category: 'FUTBOL',
    aliases: [
      'el beso eterno', 'beso eterno', 'messi el beso eterno', 'messi beso eterno',
      'messi besando la copa', 'besando la copa messi', 'messi besando copa',
      'messi beso copa', 'beso copa messi', 'el beso eterno messi',
      'messi con la copa besandola', 'el beso de messi copa', 'messi vuelta olimpica copa',
      'messi besando copa mundo', 'messi besando trofeo'
    ]
  },
  {
    canonicalTitle: 'Messi - El Beso de la Gloria',
    searchQuery: 'Messi El Beso de la Gloria',
    category: 'FUTBOL',
    aliases: [
      'el beso de la gloria', 'beso de la gloria', 'messi el beso de la gloria',
      'messi beso de la gloria', 'messi beso gloria', 'messi beso podio',
      'messi balon de oro y copa', 'el beso de la gloria messi',
      'messi besando la copa podio', 'messi balon de oro copa', 'beso de la gloria podio'
    ]
  },
  {
    canonicalTitle: 'Lionel Messi',
    searchQuery: 'Messi',
    category: 'FUTBOL',
    aliases: [
      'messi', 'lionel messi', 'la pulga', 'd10s messi', 'lio messi', 'leo messi'
    ]
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
 * Aplica coincidencia exacta prioritaria y límites de palabra ordenados por longitud descendente
 * para que frases compuestas específicas ("el beso eterno") siempre se cotejen antes que
 * fragmentos cortos ("el beso").
 * @param {string} query - Término o apodo buscado por el usuario.
 * @returns {{ matched: boolean, canonicalTitle?: string, searchQuery?: string, category?: string, defaultSizeId?: string, query: string }}
 */
export function resolveEntityAlias(query) {
  if (!query || typeof query !== 'string') return { matched: false, query: '' };
  const clean = normalizeSemanticText(query);

  // Aplanar todos los alias
  const allEntries = [];
  for (const entity of STAND_ENTITY_ALIASES) {
    for (const alias of entity.aliases) {
      allEntries.push({
        entity,
        alias,
        cleanAlias: normalizeSemanticText(alias)
      });
    }
  }

  // 1. Coincidencia exacta con cualquier alias
  for (const item of allEntries) {
    if (clean === item.cleanAlias) {
      return {
        matched: true,
        canonicalTitle: item.entity.canonicalTitle,
        searchQuery: item.entity.searchQuery,
        category: item.entity.category,
        defaultSizeId: item.entity.defaultSizeId || null,
        query,
      };
    }
  }

  // 2. Coincidencia con límites de palabra (\b), ordenando por longitud DESCENDENTE
  // (frases largas y específicas primero para evitar que alias cortos capturen consultas complejas)
  const sortedByLength = [...allEntries].sort((a, b) => b.cleanAlias.length - a.cleanAlias.length);

  for (const item of sortedByLength) {
    if (item.cleanAlias.length >= 3) {
      const escaped = item.cleanAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp(`(^|\\s)${escaped}(\\s|$)`, 'i');
      if (wordBoundaryRegex.test(clean)) {
        return {
          matched: true,
          canonicalTitle: item.entity.canonicalTitle,
          searchQuery: item.entity.searchQuery,
          category: item.entity.category,
          defaultSizeId: item.entity.defaultSizeId || null,
          query,
        };
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
