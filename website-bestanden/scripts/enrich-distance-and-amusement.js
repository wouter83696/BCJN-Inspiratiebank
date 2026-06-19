#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');

const dataPath = path.resolve(__dirname, '..', 'data', 'zomerprogramma_data.json');
const beheerDataPath = path.resolve(__dirname, '..', 'data', 'beheer_items.js');
const ALL_WEEKS = 'w29,w30,w31,w32,w33,w34';

const DISTANCE_LABELS = {
  terrain: 'Op terrein',
  nearby: 'Dichtbij (0-10 km)',
  region: 'In de regio (10-30 km)',
  daytrip: 'Verder weg (30-50 km)',
};

function normalized(value = '') {
  return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function inferDistanceBand(item = {}) {
  // Handmatig vastgelegde afstanden bij concrete locaties blijven leidend.
  if (item.distanceBand && item.distanceKm) return item.distanceBand;
  const location = normalized(`${item.locationType || ''} ${item.where || ''} ${item.title || ''} ${item.source || ''}`);

  if (/op groep|op terrein|online|voorbereiding/.test(location)) return DISTANCE_LABELS.terrain;
  if (/otterlo|rhenen|overloon|volkel|hemelrijk|hoge veluwe|kroller/.test(location)) return DISTANCE_LABELS.daytrip;
  if (/arnhem|cuijk|grave|gennep|beers|beugen|millingen|groesbeek|berg en dal|ewijk|mook|malden|overasselt|bemmel|elst|huissen|gendt/.test(location)) return DISTANCE_LABELS.region;
  if (/nijmegen|dukenburg|lent|wijchen|beuningen|weurt|ooij|ubbergen/.test(location)) return DISTANCE_LABELS.nearby;
  if (/buiten de deur|binnen \+ buiten/.test(location)) return DISTANCE_LABELS.nearby;
  return DISTANCE_LABELS.terrain;
}

function upsertUnique(items, additions, key = 'title') {
  const known = new Map(items.map((item, index) => [normalized(item[key]), index]));
  for (const addition of additions) {
    const id = normalized(addition[key]);
    if (!id) continue;
    if (known.has(id)) {
      const index = known.get(id);
      items[index] = { ...items[index], ...addition };
      continue;
    }
    known.set(id, items.length);
    items.push(addition);
  }
}

function dedupeByKey(items = [], key = 'title') {
  const seen = new Set();
  const result = [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    const id = normalized(item?.[key]);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.unshift(item);
  }
  return result;
}

function dedupeExternalItems(items = []) {
  const seen = new Set();
  const result = [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    const id = normalized(`${item?.title || ''}|${item?.date || ''}|${item?.where || ''}|${item?.url || ''}`);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.unshift(item);
  }
  return result;
}

function tidyTitle(title = '') {
  return String(title)
    .replace(/\s*-\s*light\b/gi, '')
    .replace(/\blight\b/gi, '')
    .replace(/\s+\/\s+/g, ' / ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+-\s+$/, '')
    .trim();
}

function softenText(value = '') {
  return String(value || '')
    .replace(/Alleen geschikt als er genoeg structuur en stopafspraken zijn\./gi, 'Leuk voor gamegerichte jongeren; budget en duur vooraf kiezen helpt.')
    .replace(/Alleen inzetten met timebox, oordoppen en exitplan\./gi, 'Kies een passende duur en neem oordoppen mee als dat prettig is.')
    .replace(/Alleen met professionele begeleiding, veiligheidsinstructie, beschermingsmateriaal en duidelijke stopafspraak\./gi, 'Professionele begeleiding en veiligheidsmateriaal vooraf checken.')
    .replace(/Maak vooraf een prikkel-, pauze- en stopafspraak\.\s*/gi, '')
    .replace(/Spreek vooraf speeltijd, pauzemoment en geluids-\/druktekeuze af\./gi, 'Speeltijd en budget vooraf kiezen maakt het overzichtelijk.')
    .replace(/Spreek een budget, tijdsduur en rustige pauzeplek af;?/gi, 'Budget en tijdsduur vooraf kiezen;')
    .replace(/Spreek vooraf een stopmoment af\./gi, 'Een eindtijd vooraf kiezen helpt.')
    .replace(/bespreek de veiligheidsregels vooraf en maak een duidelijke afspraak over pauzeren en stoppen\./gi, 'veiligheidsregels vooraf checken.')
    .replace(/Kies een programma met duidelijke stappen, controleer de loopafstand en spreek een rustige verzamelplek af\./gi, 'Loopafstand en startpunt vooraf checken.')
    .replace(/Kies vooraf een activiteit en reserveer een rustig tijdslot\./gi, 'Vooraf kiezen en reserveren is handig.')
    .replace(/Kies stoelen en starttijd vooraf en vermijd zo nodig de drukste avondvoorstellingen\./gi, 'Starttijd en stoelen vooraf kiezen is handig.')
    .replace(/Ga op een rustig tijdstip, kies een klein deel van de hal en bouw voldoende pauzes in\./gi, 'Een rustiger tijdstip werkt vaak prettiger.')
    .replace(/Kies een rustig tijdsblok, /gi, '')
    .replace(/Kies vooraf een niet-horrorervaring en begin kort\./gi, 'Kies een ervaring die past bij de groep.')
    .replace(/Niet geschikt bij sterke gevoeligheid voor beweging, desorientatie of een VR-bril op het hoofd\./gi, 'Let bij VR op bewegingsgevoeligheid.')
    .replace(/Duidelijk doel, samenwerking en uitdaging\. Zorg voor hints en veiligheidsafspraak\./gi, 'Samenwerken aan een duidelijk doel, met hints achter de hand.')
    .replace(/Duidelijke gezamenlijke missie in een afgebakende tijd\./gi, 'Gezamenlijke missie in een afgebakende tijd.')
    .replace(/Werk met een vast speelbudget, korte duur en vooraf gekozen rustige terugtrekplek\./gi, 'Budget vooraf kiezen helpt.')
    .replace(/Alleen geschikt voor jongeren die echt van spanning houden\. Kort houden en altijd een terugtrekroute afspreken\./gi, 'Voor jongeren die echt van spanning houden. Budget en duur vooraf kiezen is handig.')
    .replace(/Alleen passend als jongeren kunnen kiezen uit niveaus en rustopties\./gi, 'Passend als jongeren kunnen kiezen uit niveaus.')
    .replace(/Alleen voor jongeren die dit fysiek en prikkelmatig aankunnen\./gi, 'Voor jongeren die een stevige wandeling aankunnen.')
    .replace(/Wel alleen passend als buitenprikkels en drukte te hanteren zijn\./gi, 'Vooral fijn op een overzichtelijk moment.')
    .replace(/Altijd een rustiger alternatief klaarzetten\./gi, 'Een alternatief achter de hand kan prettig zijn.')
    .replace(/vraagt scherpe veiligheids- en emotieregulatie-afspraken\./gi, 'vraagt wel een goede check op veiligheid en begeleiding.')
    .replace(/duidelijke /gi, '')
    .replace(/Duidelijke /g, '')
    .replace(/rustplan/gi, 'plan')
    .replace(/stopkaart/gi, 'keuzekaart')
    .replace(/exitplan/gi, 'uitstapoptie')
    .replace(/timebox/gi, 'tijdblok')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function sentenceCase(value = '') {
  const text = String(value || '').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function tidyInspirationItem(item = {}) {
  const next = {
    ...item,
    title: tidyTitle(item.title),
    fit: sentenceCase(softenText(item.fit || item.note || '')),
    materials: sentenceCase(softenText(item.materials || '')),
  };
  if (next.domain === 'Actie & amusement') next.domain = 'Actie & Amusement';
  return next;
}

const removedInspirationTitles = new Set([
  'Arcade of gamehall-bezoek',
  'Arcade, pool of gamehal-light',
  'Arcadechallenge met vast budget',
  'Bioscoop met eigen rustplan',
  'Bowlen of glowgolf light',
  'Bowlingavond of korte bowlingchallenge',
  'Boulderen / klimmen',
  'Boulderen of klimintro met timebox',
  'Escape museum of speurroute buiten de deur',
  'Escape walk light in centrum',
  'Kies-je-eigen amusementmiddag',
  'Lasergame of paintball-light oriëntatie',
  'Outdoor actiedag met stopkaart',
  'Indoor actie-combi: trampoline, glowgolf, laser of arcade',
  'Wateractie: SUP, kano, e-foil of beachgames',
  'Braderie of zomermarkt met opdrachtkaart',
  'Foodtruck- of streekmarkt proefronde',
  'Kermis-light met duidelijk exitplan',
  'Kermis met duidelijk exitplan',
  'Parkoptreden of openluchtmuziek',
  'Streetfood- of foodtruckavond met budget',
  'Fundustry Nijmegen/Ewijk - paintball, airsoft en klimpark',
  'Weekmarkt Bemmel met budget- of kijkopdracht',
  'Weekmarkt Elst met proef- of fotokaart',
]);

function shouldRemoveInspiration(item = {}) {
  const title = String(item.title || '');
  const haystack = normalized(`${item.title || ''} ${item.type || ''} ${item.source || ''} ${item.url || ''}`);
  if (removedInspirationTitles.has(title)) return true;
  if (/agenda|uitagenda|weektips|festival|zomervakantie tips|zomervakantie|verbredingsbron|keuzemenu/.test(haystack)) return true;
  return false;
}

function cleanInspiration(items = []) {
  const seen = new Set();
  const result = [];
  for (const rawItem of items) {
    if (shouldRemoveInspiration(rawItem)) continue;
    const item = tidyInspirationItem(rawItem);
    const key = normalized(item.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

const flexibleOffers = [
  {
    title: 'Planet Awesome Nijmegen - karten, lasergamen, bowling en arcade',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'dagelijks, vooraf reserveren',
    domain: 'Actie & amusement',
    where: 'Planet Awesome, Energieweg 102, Nijmegen',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 4 km',
    cost: '€€',
    stimulus: 'Hoog',
    fit: 'Veel keuze op een locatie: elektrisch karten, lasergamen, bowlen, glowgolf, karaoke, shuffleboard, arcade en De vloer is lava.',
    source: 'Planet Awesome',
    url: 'https://planet-awesome.com/',
    tags: ['karten', 'lasergamen', 'bowlen', 'arcade', 'glowgolf', 'karaoke', 'nijmegen'],
  },
  {
    title: 'Olround Nijmegen - bowlen en Prison Island',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'dagelijks, reserveren aanbevolen',
    domain: 'Actie & amusement',
    where: 'Olround, Heyendaalseweg 90-92, Nijmegen',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 8 km',
    cost: '€€',
    stimulus: 'Middel/hoog',
    fit: 'Bowlen geeft een vaste beurtstructuur. Prison Island bestaat uit korte samenwerkingsopdrachten en werkt goed voor jongeren die graag puzzelen of samenwerken.',
    source: 'Olround Nijmegen',
    url: 'https://www.olroundnijmegen.nl/',
    tags: ['bowlen', 'prison island', 'samenwerken', 'nijmegen'],
  },
  {
    title: 'LaserQuest Nijmegen - lasergamen, Mystic Golf en StepZone',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'reserveren aanbevolen',
    domain: 'Actie & amusement',
    where: 'LaserQuest, Ziekerstraat 3, Nijmegen',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 7 km',
    cost: '€€',
    stimulus: 'Hoog',
    fit: 'Centrumlocatie met lasergamen, glow-in-the-dark golf, LaserSquash en interactieve StepZone.',
    source: 'LaserQuest Nijmegen',
    url: 'https://www.laserquestnijmegen.nl/',
    tags: ['lasergamen', 'glowgolf', 'stepzone', 'lasersquash', 'nijmegen'],
  },
  {
    title: 'Pop Culture Arcade Nijmegen - vrij spelen en challenges',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'check actuele openingstijden',
    domain: 'Actie & amusement',
    where: 'Pop Culture Arcade, Marienburg 28, Nijmegen',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 7 km',
    cost: '€',
    stimulus: 'Middel/hoog',
    fit: 'Veel korte spellen, herkenbare gamecultuur en directe scores. Budget en tijdsduur vooraf kiezen is handig.',
    source: 'Pop Culture Arcade',
    url: 'http://www.popculturearcade.nl/',
    tags: ['arcade', 'gaming', 'challenge', 'nijmegen'],
  },
  {
    title: 'Pathe Nijmegen - film, Pathe Games en X-Cube',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'dagelijks volgens filmagenda',
    domain: 'Actie & amusement',
    where: 'Pathe Nijmegen, Willem van Arenbergstraat 4, Nijmegen-Lent',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 9 km',
    cost: '€€',
    stimulus: 'Middel/hoog',
    fit: 'Combineer een film met arcadegames of een digitale X-Cube escape-opdracht.',
    source: 'Pathe Nijmegen',
    url: 'https://www.pathe.nl/nl/bioscopen/pathe-nijmegen',
    tags: ['bioscoop', 'film', 'arcade', 'x-cube', 'escape', 'lent'],
  },
  {
    title: 'Vue Nijmegen Plein - reguliere bioscoopfilm',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'dagelijks volgens filmagenda',
    domain: 'Actie & amusement',
    where: 'Vue Nijmegen Plein, Nijmegen',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 7 km',
    cost: '€€',
    stimulus: 'Laag/middel',
    fit: 'Een overzichtelijk uitje met vaste begin- en eindtijd. Film, starttijd en stoelen vooraf kiezen is handig.',
    source: 'Vue Nijmegen',
    url: 'https://www.vuecinemas.nl/cinema/nijmegen/nu-in-de-bioscoop',
    tags: ['bioscoop', 'film', 'nijmegen', 'binnen'],
  },
  {
    title: 'EnjoyVR Nijmegen - virtual reality in een eigen tijdsblok',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'op reservering',
    domain: 'Actie & amusement',
    where: 'EnjoyVR, Nijmegen',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 7 km',
    cost: '€€',
    stimulus: 'Hoog',
    fit: 'Sterk immersief en prikkelend. Vooral interessant voor jongeren die van gaming, techniek of avontuur houden.',
    source: 'EnjoyVR',
    url: 'https://enjoyvr.nl/groepsuitje-nijmegen/',
    tags: ['vr', 'gaming', 'immersief', 'nijmegen'],
  },
  {
    title: 'GRIP Boulderhal Nijmegen - boulderen op eigen niveau',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'dagelijks, check daluren',
    domain: 'Actie & amusement',
    where: 'GRIP Boulderhal, Nijmegen',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 6 km',
    cost: '€€',
    stimulus: 'Middel',
    fit: 'Concrete routes en direct zichtbaar resultaat. Een rustiger tijdstip werkt vaak prettiger.',
    source: 'GRIP Boulderhal Nijmegen',
    url: 'https://gripnijmegen.nl/boulderhal/',
    tags: ['boulderen', 'klimmen', 'sport', 'nijmegen'],
  },
  {
    title: 'Waalhalla Nijmegen - skateboard, BMX, step en urban sport',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'check vrije inloop en activiteiten',
    domain: 'Actie & amusement',
    where: 'Waalhalla, Winselingseweg 12, Nijmegen',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 6 km',
    cost: '€',
    stimulus: 'Middel/hoog',
    fit: 'Urban sport en creatieve sfeer. Check vooraf materiaal, beschermers en drukte; kijken of fotograferen kan ook een eerste stap zijn.',
    source: 'Waalhalla',
    url: 'https://www.waalhalla-centrum.nl/',
    tags: ['skate', 'bmx', 'step', 'urban', 'nijmegen'],
  },
  {
    title: 'Fundustry Nijmegen/Ewijk - klimpark, paintball en outdoor challenges',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'op reservering',
    domain: 'Actie & amusement',
    where: 'Fundustry, Groene Heuvels 1, Ewijk',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.region,
    distanceKm: 'ca. 14 km',
    cost: '€€€',
    stimulus: 'Hoog',
    fit: 'Dichtbij outdoor-aanbod met klimpark, paintball, airsoft, crossbaan en teamchallenges bij de Groene Heuvels.',
    source: 'Fundustry Nijmegen',
    url: 'https://www.fundustry.nl/locaties/nijmegen/',
    tags: ['klimpark', 'klimbos', 'paintball', 'airsoft', 'outdoor', 'hindernis', 'ewijk'],
  },
  {
    title: 'De Wijchense Berg - skiën, snowboarden, tuben en outdoor',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'check zomeropening en reserveer',
    domain: 'Actie & amusement',
    where: 'Skicentrum De Wijchense Berg, Wijchen',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.region,
    distanceKm: 'ca. 11 km',
    cost: '€€€',
    stimulus: 'Middel/hoog',
    fit: 'Bijzondere sportervaring met duidelijke instructie en herhaling. Naast skiën en snowboarden zijn er outdooractiviteiten en tuben; controleer vooraf welke onderdelen in de zomer beschikbaar zijn.',
    source: 'Skicentrum De Wijchense Berg',
    url: 'https://www.dewijchenseberg.nl/',
    tags: ['ski', 'snowboard', 'tuben', 'outdoor', 'wijchen', 'bijzonder'],
  },
  {
    title: 'Pretpark Tivoli Berg en Dal - attracties in compact park',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'check zomerse openingstijden',
    domain: 'Actie & amusement',
    where: 'Pretpark Tivoli, Berg en Dal',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.region,
    distanceKm: 'ca. 16 km',
    cost: '€€',
    stimulus: 'Hoog',
    fit: 'Compact pretpark waardoor een route vooraf goed af te spreken is. Let op leeftijdsbeleving, wachtrijen, geluid en kies enkele attracties in plaats van alles.',
    source: 'Pretpark Tivoli',
    url: 'https://www.parktivoli.nl/',
    tags: ['pretpark', 'attracties', 'berg en dal'],
  },
  {
    title: 'Gamestate Arnhem - arcadehal met meer dan 50 games',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'dagelijks, check rustige uren',
    domain: 'Actie & amusement',
    where: 'Gamestate, Oude Stationsstraat 11A, Arnhem',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.region,
    distanceKm: 'ca. 25 km',
    cost: '€€',
    stimulus: 'Hoog',
    fit: 'Grote arcade met veel keuze, licht en geluid. Werk met een vast speelbudget, korte duur en vooraf gekozen rustige terugtrekplek.',
    source: 'Gamestate Arnhem',
    url: 'https://www.gamestate.com/nl/arnhem',
    tags: ['arcade', 'gaming', 'arnhem'],
  },
  {
    title: 'VR SO Real Arnhem - virtual reality kiezen op niveau',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'op reservering',
    domain: 'Actie & amusement',
    where: 'VR SO Real, Kronenburgpassage 31, Arnhem',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.region,
    distanceKm: 'ca. 23 km',
    cost: '€€',
    stimulus: 'Hoog',
    fit: 'Kies vooraf een niet-horrorervaring en begin kort. Niet geschikt bij sterke gevoeligheid voor beweging, desorientatie of een VR-bril op het hoofd.',
    source: 'VR SO Real',
    url: 'http://www.vrsoreal.nl/',
    tags: ['vr', 'gaming', 'arnhem'],
  },
  {
    title: 'You Jump Nijmegen - trampolinepark en jumpactiviteiten',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'dagelijks, reserveer een tijdsblok',
    domain: 'Actie & amusement',
    where: 'You Jump, Nijmegen',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 5 km',
    cost: '€€',
    stimulus: 'Hoog',
    fit: 'Veel beweging, muziek en energie. Vooral passend voor jongeren die graag fysiek bezig zijn.',
    source: 'You Jump Nijmegen',
    url: 'https://www.trampolinepark.nl/nl/locaties/nijmegen',
    tags: ['trampoline', 'jump', 'bewegen', 'nijmegen'],
  },
  {
    title: 'Escape Boot Nijmegen - escaperooms en Escape Arena',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'op reservering',
    domain: 'Actie & amusement',
    where: 'Escape Boot, Nijmegen',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 6 km',
    cost: '€€€',
    stimulus: 'Middel/hoog',
    fit: 'Duidelijke gezamenlijke missie in een afgebakende tijd. Check vooraf het thema, mogelijke schrikeffecten en of hints snel beschikbaar zijn.',
    source: 'Escape Boot Nijmegen',
    url: 'https://escapebootnijmegen.nl/',
    tags: ['escaperoom', 'puzzels', 'samenwerken', 'nijmegen'],
  },
  {
    title: 'ROX Escape Nijmegen - escaperooms op NYMA',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'op reservering',
    domain: 'Actie & amusement',
    where: 'ROX Escape, NYMA Nijmegen',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 6 km',
    cost: '€€€',
    stimulus: 'Middel/hoog',
    fit: 'Geschikt voor jongeren die graag puzzelen en samenwerken. Bekijk vooraf de moeilijkheid, sfeer en eventuele spannende elementen en verdeel rollen binnen de groep.',
    source: 'ROX Escape Nijmegen',
    url: 'https://roxescape.nl/',
    tags: ['escaperoom', 'puzzels', 'nyma', 'nijmegen'],
  },
  {
    title: 'Nijmegen Outdoor - stadsspellen en actieve groepsuitjes',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'op reservering',
    domain: 'Actie & amusement',
    where: 'Centrum Nijmegen en omgeving',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 7 km',
    cost: '€€',
    stimulus: 'Middel/hoog',
    fit: 'Actief groepsaanbod in en rond de stad, zoals citygames en groepsopdrachten.',
    source: 'Nijmegen Outdoor',
    url: 'https://nijmegenoutdoor.nl/',
    tags: ['outdoor', 'stadsspel', 'groepsuitje', 'nijmegen'],
  },
  {
    title: 'SUP & SURF Nijmegen - suppen en watersport',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'op reservering en afhankelijk van weer',
    domain: 'Actie & amusement',
    where: 'SUP & SURF, Nijmegen',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 8 km',
    cost: '€€',
    stimulus: 'Middel/hoog',
    fit: 'Actieve waterervaring die goed in kleine stappen is op te bouwen. Check zwemvaardigheid, weer, kleding, begeleiding en een droog alternatief vooraf.',
    source: 'SUP & SURF Nijmegen',
    url: 'https://supensurf-nijmegen.nl/',
    tags: ['sup', 'watersport', 'buiten', 'nijmegen'],
  },
  {
    title: 'Ouwehands Dierenpark Rhenen - verder weg',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'dagelijks, plan als dagactiviteit',
    domain: 'Natuur & Buiten',
    where: 'Ouwehands Dierenpark, Rhenen',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.daytrip,
    distanceKm: 'ca. 42 km',
    cost: '€€€',
    stimulus: 'Middel/hoog',
    fit: 'Alleen als bewust uitje wat verder weg. Kies vooraf enkele dierengebieden, plan vervoer en rustmomenten en houd ruimte om eerder te vertrekken.',
    source: 'Ouwehands Dierenpark',
    url: 'https://www.ouwehand.nl/',
    tags: ['dieren', 'rhenen', 'daguitstap'],
  },
  {
    title: 'BillyBird Hemelrijk - strand, attracties en outdoor uitje verder weg',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'check zomerse openingstijden',
    domain: 'Actie & amusement',
    where: 'BillyBird Hemelrijk, Volkel',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.daytrip,
    distanceKm: 'ca. 38 km',
    cost: '€€',
    stimulus: 'Hoog',
    fit: 'Combinatie van strand, binnen- en buitenactiviteiten. Plan dit als uitje wat verder weg, kies vooraf een beperkt programma en neem rust- en omkleedmomenten mee.',
    source: 'BillyBird Hemelrijk',
    url: 'https://www.billybird.nl/hemelrijk/',
    tags: ['attracties', 'strand', 'outdoor', 'volkel', 'daguitstap'],
  },
  {
    title: 'ZooParc Overloon - expeditieroute wat verder weg',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'dagelijks, check openingstijden',
    domain: 'Natuur & Buiten',
    where: 'ZooParc Overloon, Overloon',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.daytrip,
    distanceKm: 'ca. 43 km',
    cost: '€€€',
    stimulus: 'Middel',
    fit: 'Overzichtelijke expeditieroute en veel buitenruimte. Plan vervoer, lunch en rust vooraf en kies eventueel maar een deel van het park.',
    source: 'ZooParc Overloon',
    url: 'https://www.zooparc.nl/',
    tags: ['dieren', 'overloon', 'daguitstap'],
  },
];

const amusementIdeas = [
  {
    title: 'Poolen, snooker of darts in Nijmegen',
    domain: 'Actie & Amusement',
    type: 'Zoekbron / extern',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    duration: '60-120 min',
    group: '2-6',
    cost: '€',
    stimulus: 'Middel',
    materials: 'Leeftijd, openingstijden en reserveren checken.',
    fit: 'Laagdrempelig voor oudere jongeren die een volwassen uitje willen zonder groot programma.',
    source: 'Actueel zoeken in Nijmegen',
    url: '',
  },
  {
    title: 'Karaoke-room of muziekchallenge',
    domain: 'Actie & Amusement',
    type: 'Bestaand extern aanbod / eigen variant',
    locationType: 'Binnen + buiten',
    distanceBand: DISTANCE_LABELS.nearby,
    duration: '45-90 min',
    group: '2-8',
    cost: '€€',
    stimulus: 'Hoog',
    materials: 'Kamer, tijdsduur en prijs checken.',
    fit: 'Leuk voor jongeren die muziek, performance of humor zoeken. Meedoen kan ook als DJ, jurylid of playlistmaker.',
    source: 'Planet Awesome / eigen aanbod',
    url: 'https://planet-awesome.com/',
  },
  {
    title: 'Bijlwerpen, archery tag of schietspel',
    domain: 'Actie & Amusement',
    type: 'Zoekbron / extern',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.region,
    duration: '60-120 min',
    group: '3-8',
    cost: '€€',
    stimulus: 'Hoog',
    materials: 'Leeftijd, begeleiding en veiligheidsmateriaal checken.',
    fit: 'Past bij jongeren die actie en focus willen.',
    source: 'Fundustry / regio-aanbod',
    url: 'https://www.fundustry.nl/locaties/nijmegen/',
  },
  {
    title: 'Hindernis- of Expeditie Robinson challenge in Ewijk',
    domain: 'Actie & Amusement',
    type: 'Bestaand extern aanbod',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.region,
    duration: '60-120 min',
    group: '4-10',
    cost: '€€€',
    stimulus: 'Hoog',
    materials: 'Activiteit, leeftijd, kleding, begeleiding en groepsgrootte checken.',
    fit: 'Voor jongeren die fysieke actie, samenwerken en competitie leuk vinden. Goed alternatief als je iets zoekt richting hindernisbaan of Wipeout, maar dan realistischer in de regio.',
    source: 'Fundustry Nijmegen/Ewijk',
    url: 'https://www.fundustry.nl/locaties/nijmegen/',
  },
  {
    title: 'Escape walk, citygame of telefoonmissie',
    domain: 'Actie & Amusement',
    type: 'Bestaand extern aanbod / eigen begeleiding',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    duration: '60-120 min',
    group: '2-6',
    cost: 'Gratis/€€',
    stimulus: 'Middel/hoog',
    materials: 'Telefoon, powerbank en route-informatie.',
    fit: 'Fijn voor 15-25 omdat het spel, stad en zelfstandigheid combineert.',
    source: 'Nijmegen Outdoor / DoeNijmegen / eigen route',
    url: 'https://nijmegenoutdoor.nl/',
  },
  {
    title: 'Skatepark, pumptrack of urban sports sessie',
    domain: 'Actie & Amusement',
    type: 'Bestaand extern aanbod / eigen begeleiding',
    locationType: 'Op pad',
    distanceBand: DISTANCE_LABELS.nearby,
    duration: '45-120 min',
    group: '1-8',
    cost: 'Gratis/€',
    stimulus: 'Middel/hoog',
    materials: 'Materiaal, helm/bescherming en locatie checken.',
    fit: 'Voor jongeren die liever doen dan praten. Ook meekijken, filmen of fotograferen kan een volwaardige deelname zijn.',
    source: 'Waalhalla / NYMA / openbare skateplekken',
    url: 'https://www.waalhalla-centrum.nl/',
  },
];

const inspirationOfferTitles = new Set([
  'Planet Awesome Nijmegen - karten, lasergamen, bowling en arcade',
  'Olround Nijmegen - bowlen en Prison Island',
  'LaserQuest Nijmegen - lasergamen, Mystic Golf en StepZone',
  'Pop Culture Arcade Nijmegen - vrij spelen en challenges',
  'Pathe Nijmegen - film, Pathe Games en X-Cube',
  'Vue Nijmegen Plein - reguliere bioscoopfilm',
  'EnjoyVR Nijmegen - virtual reality in een eigen tijdsblok',
  'GRIP Boulderhal Nijmegen - boulderen op eigen niveau',
  'Waalhalla Nijmegen - skateboard, BMX, step en urban sport',
  'Fundustry Nijmegen/Ewijk - klimpark, paintball en outdoor challenges',
  'De Wijchense Berg - skiën, snowboarden, tuben en outdoor',
  'Pretpark Tivoli Berg en Dal - attracties in compact park',
  'Gamestate Arnhem - arcadehal met meer dan 50 games',
  'VR SO Real Arnhem - virtual reality kiezen op niveau',
  'You Jump Nijmegen - trampolinepark en jumpactiviteiten',
  'Escape Boot Nijmegen - escaperooms en Escape Arena',
  'ROX Escape Nijmegen - escaperooms op NYMA',
  'Nijmegen Outdoor - stadsspellen en actieve groepsuitjes',
  'SUP & SURF Nijmegen - suppen en watersport',
]);

function offerToInspiration(offer) {
  return {
    title: offer.title,
    domain: 'Actie & Amusement',
    type: 'Bestaand extern aanbod',
    locationType: offer.locationType || 'Op pad',
    distanceBand: offer.distanceBand || inferDistanceBand(offer),
    duration: /film|bioscoop/i.test(offer.title) ? '2-3 uur' : '60-180 min',
    group: /Fundustry|Outdoor|Tivoli/i.test(offer.title) ? '4-10' : '1-8',
    cost: offer.cost || '€€',
    stimulus: offer.stimulus || 'Middel/hoog',
    materials: `Actuele openingstijden, kosten en reserveren checken. Locatie: ${offer.where || offer.source}.`,
    fit: sentenceCase(softenText(offer.fit)),
    source: offer.source,
    url: offer.url,
    tags: offer.tags || [],
  };
}

const concreteAmusementIdeas = flexibleOffers
  .filter((offer) => inspirationOfferTitles.has(offer.title))
  .map(offerToInspiration);

const rageRoomIdea = {
  title: 'Rage room / smashactiviteit in de regio checken',
  domain: 'Actie & Amusement',
  type: 'Zoekbron / extern',
  locationType: 'Op pad',
  distanceBand: DISTANCE_LABELS.region,
  duration: '45-90 min',
  group: '1-4',
  cost: '€€',
  stimulus: 'Hoog',
  materials: 'Aanbieder, leeftijd, veiligheidsmateriaal, begeleiding en prijs checken.',
  fit: 'Kan passend zijn voor jongeren die spanning en fysieke ontlading zoeken.',
  source: 'Actueel zoeken in Nijmegen/Arnhem/regio',
  url: '',
  tags: ['rage room', 'smash', 'actie', 'veiligheid', 'hoog prikkel'],
};

const restoredAgendaItems = [
  {
    title: 'Verhalenvertellers bij De Barendonk',
    week: 'w29',
    date: 'Dinsdag 14 juli 2026',
    time: '10.30',
    domain: 'Cultuur & Ontdekken',
    where: 'De Barendonk, Beers',
    locationType: 'Op pad',
    cost: 'Betaald/soms gratis',
    stimulus: 'Laag/middel',
    fit: 'Kleinschalige verhalenactiviteit met duidelijke starttijd. Fijn voor jongeren die geschiedenis en plekverhalen leuk vinden.',
    source: 'Land van Cuijk',
    url: 'https://www.landvancuijk.nl/agenda/2026/07/',
    tags: ['verhalen', 'beers', 'kleinschalig', 'cultuur', 'zomer 2026', 'regio', 'uitje'],
  },
  {
    title: 'Pop Culture Arcade – PCA Challenge',
    week: 'w29,w30,w31',
    date: '13 t/m 30 juli 2026',
    time: 'dagelijks 12.00–23.00',
    domain: 'Ontmoeten, Spel & Vaardigheden',
    where: 'Pop Culture Arcade, Mariënburg 28, Nijmegen',
    locationType: 'Op pad',
    cost: 'Gratis/laag',
    stimulus: 'Middel/hoog',
    fit: 'Uitdagend voor jongeren die houden van games, scores en korte missies. Plan dit als compact blok en check drukte vooraf.',
    source: 'Visit Nijmegen',
    url: 'https://www.visitnijmegen.com/evenementen/4179578618/pca-challenge',
    tags: ['gaming', 'challenge', 'arcade', 'nijmegen', 'zomer 2026', 'regio', 'uitje'],
  },
  {
    title: 'Verhalenvertellers bij De Barendonk',
    week: 'w31',
    date: 'Dinsdag 28 juli 2026',
    time: '10.30',
    domain: 'Cultuur & Ontdekken',
    where: 'De Barendonk, Beers',
    locationType: 'Op pad',
    cost: 'Betaald/soms gratis',
    stimulus: 'Laag/middel',
    fit: 'Kleinschalige verhalenactiviteit met duidelijke starttijd. Fijn voor jongeren die geschiedenis en plekverhalen leuk vinden.',
    source: 'Land van Cuijk',
    url: 'https://www.landvancuijk.nl/agenda/2026/07/',
    tags: ['verhalen', 'beers', 'kleinschalig', 'cultuur', 'zomer 2026', 'regio', 'uitje'],
  },
  {
    title: 'Verhalenvertellers bij De Barendonk',
    week: 'w32',
    date: 'Dinsdag 4 augustus 2026',
    time: '10.30',
    domain: 'Cultuur & Ontdekken',
    where: 'De Barendonk, Beers',
    locationType: 'Op pad',
    cost: 'Betaald/soms gratis',
    stimulus: 'Laag/middel',
    fit: 'Kleinschalige verhalenactiviteit met duidelijke starttijd. Fijn voor jongeren die geschiedenis en plekverhalen leuk vinden.',
    source: 'Land van Cuijk',
    url: 'https://www.landvancuijk.nl/agenda/2026/08/',
    tags: ['verhalen', 'beers', 'kleinschalig', 'cultuur', 'zomer 2026', 'regio', 'uitje'],
  },
  {
    title: 'Verhalenvertellers bij De Barendonk',
    week: 'w33',
    date: 'Dinsdag 11 augustus 2026',
    time: '10.30',
    domain: 'Cultuur & Ontdekken',
    where: 'De Barendonk, Beers',
    locationType: 'Op pad',
    cost: 'Betaald/soms gratis',
    stimulus: 'Laag/middel',
    fit: 'Kleinschalige verhalenactiviteit met duidelijke starttijd. Fijn voor jongeren die geschiedenis en plekverhalen leuk vinden.',
    source: 'Land van Cuijk',
    url: 'https://www.landvancuijk.nl/agenda/2026/08/',
    tags: ['verhalen', 'beers', 'kleinschalig', 'cultuur', 'zomer 2026', 'regio', 'uitje'],
  },
];

const sourceLinks = [
  ['Planet Awesome Nijmegen', 'https://planet-awesome.com/', 'Actie & amusement', 'Karten, bowlen, lasergamen, glowgolf, karaoke, arcade en meer op een locatie.'],
  ['Olround Nijmegen', 'https://www.olroundnijmegen.nl/', 'Actie & amusement', 'Bowlen en Prison Island in Nijmegen.'],
  ['LaserQuest Nijmegen', 'https://www.laserquestnijmegen.nl/', 'Actie & amusement', 'Lasergamen, Mystic Golf, LaserSquash en StepZone in het centrum van Nijmegen.'],
  ['Pop Culture Arcade', 'http://www.popculturearcade.nl/', 'Actie & amusement', 'Arcadehal in het centrum van Nijmegen.'],
  ['Pathe Nijmegen', 'https://www.pathe.nl/nl/bioscopen/pathe-nijmegen', 'Film & amusement', 'Filmagenda, Pathe Games en X-Cube in Nijmegen-Lent.'],
  ['Vue Nijmegen', 'https://www.vuecinemas.nl/cinema/nijmegen/nu-in-de-bioscoop', 'Film & amusement', 'Actuele filmagenda van Vue Nijmegen Plein.'],
  ['EnjoyVR Nijmegen', 'https://enjoyvr.nl/groepsuitje-nijmegen/', 'Actie & amusement', 'Virtual-realityervaringen voor kleine groepen.'],
  ['GRIP Boulderhal Nijmegen', 'https://gripnijmegen.nl/boulderhal/', 'Actie & amusement', 'Grote boulderhal met routes op verschillende niveaus.'],
  ['Fundustry Nijmegen/Ewijk', 'https://www.fundustry.nl/locaties/nijmegen/', 'Outdoor & amusement', 'Klimpark, paintball, crossbaan, wateractiviteiten en teamchallenges bij de Groene Heuvels.'],
  ['Skicentrum De Wijchense Berg', 'https://www.dewijchenseberg.nl/', 'Actie & amusement', 'Skiën, snowboarden, tuben en andere outdooractiviteiten in Wijchen.'],
  ['Pretpark Tivoli', 'https://www.parktivoli.nl/', 'Actie & amusement', 'Compact attractiepark in Berg en Dal, vooral passend bij een jongere ontwikkelingsleeftijd.'],
  ['Gamestate Arnhem', 'https://www.gamestate.com/nl/arnhem', 'Actie & amusement', 'Arcadehal met meer dan vijftig games in Arnhem.'],
  ['VR SO Real Arnhem', 'http://www.vrsoreal.nl/', 'Actie & amusement', 'Virtual reality in Arnhem-Kronenburg.'],
  ['You Jump Nijmegen', 'https://www.trampolinepark.nl/nl/locaties/nijmegen', 'Actie & amusement', 'Trampolinepark met verschillende jumpactiviteiten in Nijmegen.'],
  ['Escape Boot Nijmegen', 'https://escapebootnijmegen.nl/', 'Actie & amusement', 'Escaperooms en Escape Arena in Nijmegen.'],
  ['ROX Escape Nijmegen', 'https://roxescape.nl/', 'Actie & amusement', 'Escaperooms op het NYMA-terrein in Nijmegen.'],
  ['Nijmegen Outdoor', 'https://nijmegenoutdoor.nl/', 'Actie & amusement', 'Stadsspellen en actieve groepsuitjes in Nijmegen.'],
  ['SUP & SURF Nijmegen', 'https://supensurf-nijmegen.nl/', 'Actie & amusement', 'Suppen en andere watersportactiviteiten in Nijmegen.'],
  ['Ouwehands Dierenpark', 'https://www.ouwehand.nl/', 'Verder weg', 'Dierenpark in Rhenen, bedoeld als bewust uitje wat verder weg.'],
  ['BillyBird Hemelrijk', 'https://www.billybird.nl/hemelrijk/', 'Verder weg', 'Strand, attracties en binnen- en buitenactiviteiten in Volkel.'],
  ['ZooParc Overloon', 'https://www.zooparc.nl/', 'Verder weg', 'Dierenpark met expeditieroute in Overloon.'],
].map(([name, url, category, note]) => ({ name, url, category, note }));

async function main() {
  const data = JSON.parse(await fs.readFile(dataPath, 'utf8'));

  const renamedTitles = new Map([
    ['Skicentrum De Wijchense Berg - ski of snowboard', 'De Wijchense Berg - skiën, snowboarden, tuben en outdoor'],
    ['Fundustry Nijmegen/Ewijk - paintball, airsoft en klimpark', 'Fundustry Nijmegen/Ewijk - klimpark, paintball en outdoor challenges'],
  ]);
  for (const item of data.external || []) {
    if (renamedTitles.has(item.title)) item.title = renamedTitles.get(item.title);
  }

  data.external = (data.external || []).map((item) => ({ ...item, distanceBand: inferDistanceBand(item) }));
  data.inspiration = (data.inspiration || []).map((item) => {
    const next = { ...item, distanceBand: inferDistanceBand(item) };
    if (/arcade|gamehall|lasergame|paintball|escape room|karten|bowlen|virtual reality|vr-/i.test(item.title || '')) {
      next.domain = 'Actie & amusement';
    }
    return next;
  });
  data.teamIdeas = (data.teamIdeas || []).map((item) => ({ ...item, distanceBand: item.distanceBand || inferDistanceBand(item) }));

  upsertUnique(data.external, flexibleOffers);
  data.external.push(...restoredAgendaItems);
  data.external = dedupeExternalItems(data.external);
  upsertUnique(data.inspiration, [...amusementIdeas, ...concreteAmusementIdeas, rageRoomIdea]);
  data.inspiration = cleanInspiration(data.inspiration);
  upsertUnique(data.links, sourceLinks, 'name');
  data.generated = '17 juni 2026';

  await fs.writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  const beheerData = {
    generated: data.generated,
    weeks: data.weeks || [],
    external: data.external || [],
    inspiration: data.inspiration,
    teamIdeas: data.teamIdeas || [],
    links: data.links,
    sourceReview: data.sourceReview || {},
  };
  await fs.writeFile(beheerDataPath, `window.BCJN_BEHEER_BASE = ${JSON.stringify(beheerData, null, 2)};\n`, 'utf8');
  console.log(`Database bijgewerkt: ${data.external.length} uitjes, ${data.inspiration.length} inspiratie-items, ${data.links.length} links.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
