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
  daytrip: 'Daguitstap (30-50 km)',
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

const flexibleOffers = [
  {
    title: 'Planet Awesome Nijmegen - karten, lasergamen, bowling en arcade',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'dagelijks, vooraf reserveren',
    domain: 'Actie & amusement',
    where: 'Planet Awesome, Energieweg 102, Nijmegen',
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 4 km',
    cost: '€€',
    stimulus: 'Hoog',
    bus: 'Nee/soms',
    fit: 'Veel keuze op een locatie: elektrisch karten, lasergamen, bowlen, glowgolf, karaoke, shuffleboard, arcade en De vloer is lava. Kies vooraf een activiteit en reserveer een rustig tijdslot.',
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
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 8 km',
    cost: '€€',
    stimulus: 'Middel/hoog',
    bus: 'Nee/soms',
    fit: 'Bowlen geeft een voorspelbare beurtstructuur. Prison Island bestaat uit korte samenwerkingsopdrachten; kies een beperkt aantal kamers en spreek vooraf een stopmoment af.',
    source: 'Olround Nijmegen',
    url: 'https://www.olroundnijmegen.nl/',
    tags: ['bowlen', 'prison island', 'samenwerken', 'nijmegen'],
  },
  {
    title: 'Pop Culture Arcade Nijmegen - vrij spelen en challenges',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'check actuele openingstijden',
    domain: 'Actie & amusement',
    where: 'Pop Culture Arcade, Marienburg 28, Nijmegen',
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 7 km',
    cost: '€',
    stimulus: 'Middel/hoog',
    bus: 'Nee/soms',
    fit: 'Veel korte spellen en duidelijke scores. Spreek een budget, tijdsduur en rustige pauzeplek af; doordeweeks vroeg op de dag is vaak overzichtelijker.',
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
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 9 km',
    cost: '€€',
    stimulus: 'Middel/hoog',
    bus: 'Soms',
    fit: 'Combineer een film met arcadegames of een digitale X-Cube escape-opdracht. Kies stoelen en starttijd vooraf en vermijd zo nodig de drukste avondvoorstellingen.',
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
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 7 km',
    cost: '€€',
    stimulus: 'Laag/middel',
    bus: 'Nee/soms',
    fit: 'Een duidelijk afgebakend uitje met vaste begin- en eindtijd. Kies vooraf een passende film, rustige voorstelling en stoelen aan het gangpad als tussendoor weggaan prettig is.',
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
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 7 km',
    cost: '€€',
    stimulus: 'Hoog',
    bus: 'Nee/soms',
    fit: 'Sterk immersief en prikkelend. Begin met een korte, rustige ervaring, check gevoeligheid voor beweging en plan herstelruimte na afloop.',
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
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 6 km',
    cost: '€€',
    stimulus: 'Middel',
    bus: 'Nee/soms',
    fit: 'Concrete routes en direct zichtbaar resultaat. Ga op een rustig tijdstip, kies een klein deel van de hal en bouw voldoende pauzes in.',
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
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 6 km',
    cost: '€',
    stimulus: 'Middel/hoog',
    bus: 'Nee/soms',
    fit: 'Urban sport en creatieve sfeer. Check vooraf materiaal, beschermers en drukte; kijken of fotograferen kan ook een eerste stap zijn.',
    source: 'Waalhalla',
    url: 'https://www.waalhalla-centrum.nl/',
    tags: ['skate', 'bmx', 'step', 'urban', 'nijmegen'],
  },
  {
    title: 'Fundustry Nijmegen/Ewijk - paintball, airsoft en klimpark',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'op reservering',
    domain: 'Actie & amusement',
    where: 'Fundustry, Groene Heuvels 1, Ewijk',
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.region,
    distanceKm: 'ca. 14 km',
    cost: '€€€',
    stimulus: 'Hoog',
    bus: 'Ja/soms',
    fit: 'Groot aanbod met paintball, airsoft, klimpark en andere groepsactiviteiten. Kies een duidelijke activiteit, vraag naar rustige begeleiding en maak vooraf veiligheids- en stopafspraken.',
    source: 'Fundustry Nijmegen',
    url: 'https://www.fundustry.nl/locaties/nijmegen/',
    tags: ['paintball', 'airsoft', 'klimpark', 'outdoor', 'ewijk'],
  },
  {
    title: 'De Wijchense Berg - skiën, snowboarden, tuben en outdoor',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'check zomeropening en reserveer',
    domain: 'Actie & amusement',
    where: 'Skicentrum De Wijchense Berg, Wijchen',
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.region,
    distanceKm: 'ca. 11 km',
    cost: '€€€',
    stimulus: 'Middel/hoog',
    bus: 'Soms',
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
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.region,
    distanceKm: 'ca. 16 km',
    cost: '€€',
    stimulus: 'Hoog',
    bus: 'Soms',
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
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.region,
    distanceKm: 'ca. 25 km',
    cost: '€€',
    stimulus: 'Hoog',
    bus: 'Ja/soms',
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
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.region,
    distanceKm: 'ca. 23 km',
    cost: '€€',
    stimulus: 'Hoog',
    bus: 'Ja/soms',
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
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 5 km',
    cost: '€€',
    stimulus: 'Hoog',
    bus: 'Nee/soms',
    fit: 'Veel beweging, muziek en andere springers. Kies een rustig tijdsblok, bespreek de veiligheidsregels vooraf en maak een duidelijke afspraak over pauzeren en stoppen.',
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
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 6 km',
    cost: '€€€',
    stimulus: 'Middel/hoog',
    bus: 'Nee/soms',
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
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 6 km',
    cost: '€€€',
    stimulus: 'Middel/hoog',
    bus: 'Nee/soms',
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
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 7 km',
    cost: '€€',
    stimulus: 'Middel/hoog',
    bus: 'Nee/soms',
    fit: 'Actief groepsaanbod in en rond de stad. Kies een programma met duidelijke stappen, controleer de loopafstand en spreek een rustige verzamelplek af.',
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
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.nearby,
    distanceKm: 'ca. 8 km',
    cost: '€€',
    stimulus: 'Middel/hoog',
    bus: 'Soms',
    fit: 'Actieve waterervaring die goed in kleine stappen is op te bouwen. Check zwemvaardigheid, weer, kleding, begeleiding en een droog alternatief vooraf.',
    source: 'SUP & SURF Nijmegen',
    url: 'https://supensurf-nijmegen.nl/',
    tags: ['sup', 'watersport', 'buiten', 'nijmegen'],
  },
  {
    title: 'Ouwehands Dierenpark Rhenen - bijzondere daguitstap',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'dagelijks, plan als dagactiviteit',
    domain: 'Natuur & Buiten',
    where: 'Ouwehands Dierenpark, Rhenen',
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.daytrip,
    distanceKm: 'ca. 42 km',
    cost: '€€€',
    stimulus: 'Middel/hoog',
    bus: 'Ja',
    fit: 'Alleen als bewuste daguitstap. Kies vooraf enkele dierengebieden, plan vervoer en rustmomenten en houd ruimte om eerder te vertrekken.',
    source: 'Ouwehands Dierenpark',
    url: 'https://www.ouwehand.nl/',
    tags: ['dieren', 'rhenen', 'daguitstap'],
  },
  {
    title: 'BillyBird Hemelrijk - strand, attracties en outdoor daguitstap',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'check zomerse openingstijden',
    domain: 'Actie & amusement',
    where: 'BillyBird Hemelrijk, Volkel',
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.daytrip,
    distanceKm: 'ca. 38 km',
    cost: '€€',
    stimulus: 'Hoog',
    bus: 'Ja',
    fit: 'Combinatie van strand, binnen- en buitenactiviteiten. Plan dit als daguitstap, kies vooraf een beperkt programma en neem rust- en omkleedmomenten mee.',
    source: 'BillyBird Hemelrijk',
    url: 'https://www.billybird.nl/hemelrijk/',
    tags: ['attracties', 'strand', 'outdoor', 'volkel', 'daguitstap'],
  },
  {
    title: 'ZooParc Overloon - expeditieroute als daguitstap',
    week: ALL_WEEKS,
    date: '13 juli t/m 23 augustus 2026',
    time: 'dagelijks, check openingstijden',
    domain: 'Natuur & Buiten',
    where: 'ZooParc Overloon, Overloon',
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.daytrip,
    distanceKm: 'ca. 43 km',
    cost: '€€€',
    stimulus: 'Middel',
    bus: 'Ja',
    fit: 'Overzichtelijke expeditieroute en veel buitenruimte. Plan vervoer, lunch en rust vooraf en kies eventueel maar een deel van het park.',
    source: 'ZooParc Overloon',
    url: 'https://www.zooparc.nl/',
    tags: ['dieren', 'overloon', 'daguitstap'],
  },
];

const amusementIdeas = [
  {
    title: 'Kies-je-eigen amusementmiddag',
    domain: 'Actie & amusement',
    type: 'Eigen aanbod',
    locationType: 'Binnen + buiten',
    distanceBand: DISTANCE_LABELS.nearby,
    duration: '2-4 uur',
    group: '2-8',
    cost: '€€',
    stimulus: 'Middel',
    bus: 'Soms',
    materials: 'Keuzekaart met maximaal drie activiteiten, budget, reservering en rustplan.',
    fit: 'Laat jongeren kiezen tussen bijvoorbeeld film, bowlen, arcade of boulderen. Beperk de keuze vooraf zodat het leuk blijft zonder keuzestress.',
    source: 'Eigen aanbod',
    url: '',
  },
  {
    title: 'Arcadechallenge met vast budget',
    domain: 'Actie & amusement',
    type: 'Eigen aanbod',
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.nearby,
    duration: '60-90 min',
    group: '2-6',
    cost: '€',
    stimulus: 'Hoog',
    bus: 'Nee/soms',
    materials: 'Vast speelbudget, timer, scorekaart en afgesproken pauzeplek.',
    fit: 'Maak van een drukke arcade een voorspelbare opdracht: kies drie spellen, noteer scores en stop op een afgesproken moment.',
    source: 'Eigen aanbod',
    url: '',
  },
  {
    title: 'Bioscoop met eigen rustplan',
    domain: 'Actie & amusement',
    type: 'Eigen aanbod',
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.nearby,
    duration: '2-3 uur',
    group: '2-8',
    cost: '€€',
    stimulus: 'Middel',
    bus: 'Nee/soms',
    materials: 'Filmkeuze, stoelen aan gangpad, oordoppen, vaste verzamelplek en eindtijd.',
    fit: 'Een bioscoopbezoek wordt overzichtelijker door filmduur, trailerdrukte, zitplek en een mogelijke uitstappauze vooraf te bespreken.',
    source: 'Eigen aanbod',
    url: '',
  },
  {
    title: 'Outdoor actiedag met stopkaart',
    domain: 'Actie & amusement',
    type: 'Eigen aanbod',
    locationType: 'Buiten de deur',
    distanceBand: DISTANCE_LABELS.region,
    duration: '3-5 uur',
    group: '4-10',
    cost: '€€€',
    stimulus: 'Hoog',
    bus: 'Ja/soms',
    materials: 'Reservering, veiligheidsinformatie, kledinglijst, water en persoonlijke stopkaart.',
    fit: 'Voor paintball, klimpark of andere stevige actie. Een stopkaart en alternatief programma maken deelname minder alles-of-niets.',
    source: 'Eigen aanbod',
    url: '',
  },
];

const sourceLinks = [
  ['Planet Awesome Nijmegen', 'https://planet-awesome.com/', 'Actie & amusement', 'Karten, bowlen, lasergamen, glowgolf, karaoke, arcade en meer op een locatie.'],
  ['Olround Nijmegen', 'https://www.olroundnijmegen.nl/', 'Actie & amusement', 'Bowlen en Prison Island in Nijmegen.'],
  ['Pop Culture Arcade', 'http://www.popculturearcade.nl/', 'Actie & amusement', 'Arcadehal in het centrum van Nijmegen.'],
  ['Pathe Nijmegen', 'https://www.pathe.nl/nl/bioscopen/pathe-nijmegen', 'Film & amusement', 'Filmagenda, Pathe Games en X-Cube in Nijmegen-Lent.'],
  ['Vue Nijmegen', 'https://www.vuecinemas.nl/cinema/nijmegen/nu-in-de-bioscoop', 'Film & amusement', 'Actuele filmagenda van Vue Nijmegen Plein.'],
  ['EnjoyVR Nijmegen', 'https://enjoyvr.nl/groepsuitje-nijmegen/', 'Actie & amusement', 'Virtual-realityervaringen voor kleine groepen.'],
  ['GRIP Boulderhal Nijmegen', 'https://gripnijmegen.nl/boulderhal/', 'Actie & amusement', 'Grote boulderhal met routes op verschillende niveaus.'],
  ['Fundustry Nijmegen/Ewijk', 'https://www.fundustry.nl/locaties/nijmegen/', 'Outdoor & amusement', 'Paintball, airsoft, klimpark en andere groepsactiviteiten bij de Groene Heuvels.'],
  ['Skicentrum De Wijchense Berg', 'https://www.dewijchenseberg.nl/', 'Actie & amusement', 'Skiën, snowboarden, tuben en andere outdooractiviteiten in Wijchen.'],
  ['Pretpark Tivoli', 'https://www.parktivoli.nl/', 'Actie & amusement', 'Compact attractiepark in Berg en Dal, vooral passend bij een jongere ontwikkelingsleeftijd.'],
  ['Gamestate Arnhem', 'https://www.gamestate.com/nl/arnhem', 'Actie & amusement', 'Arcadehal met meer dan vijftig games in Arnhem.'],
  ['VR SO Real Arnhem', 'http://www.vrsoreal.nl/', 'Actie & amusement', 'Virtual reality in Arnhem-Kronenburg.'],
  ['You Jump Nijmegen', 'https://www.trampolinepark.nl/nl/locaties/nijmegen', 'Actie & amusement', 'Trampolinepark met verschillende jumpactiviteiten in Nijmegen.'],
  ['Escape Boot Nijmegen', 'https://escapebootnijmegen.nl/', 'Actie & amusement', 'Escaperooms en Escape Arena in Nijmegen.'],
  ['ROX Escape Nijmegen', 'https://roxescape.nl/', 'Actie & amusement', 'Escaperooms op het NYMA-terrein in Nijmegen.'],
  ['Nijmegen Outdoor', 'https://nijmegenoutdoor.nl/', 'Actie & amusement', 'Stadsspellen en actieve groepsuitjes in Nijmegen.'],
  ['SUP & SURF Nijmegen', 'https://supensurf-nijmegen.nl/', 'Actie & amusement', 'Suppen en andere watersportactiviteiten in Nijmegen.'],
  ['Ouwehands Dierenpark', 'https://www.ouwehand.nl/', 'Bijzondere daguitstap', 'Dierenpark in Rhenen, bedoeld als bewuste daguitstap.'],
  ['BillyBird Hemelrijk', 'https://www.billybird.nl/hemelrijk/', 'Bijzondere daguitstap', 'Strand, attracties en binnen- en buitenactiviteiten in Volkel.'],
  ['ZooParc Overloon', 'https://www.zooparc.nl/', 'Bijzondere daguitstap', 'Dierenpark met expeditieroute in Overloon.'],
].map(([name, url, category, note]) => ({ name, url, category, note }));

async function main() {
  const data = JSON.parse(await fs.readFile(dataPath, 'utf8'));

  const renamedTitles = new Map([
    ['Skicentrum De Wijchense Berg - ski of snowboard', 'De Wijchense Berg - skiën, snowboarden, tuben en outdoor'],
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
  upsertUnique(data.inspiration, amusementIdeas);
  upsertUnique(data.links, sourceLinks, 'name');
  data.generated = '15 juni 2026';

  await fs.writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  const beheerData = {
    generated: data.generated,
    inspiration: data.inspiration,
    teamIdeas: data.teamIdeas || [],
    links: data.links,
  };
  await fs.writeFile(beheerDataPath, `window.BCJN_BEHEER_BASE = ${JSON.stringify(beheerData, null, 2)};\n`, 'utf8');
  console.log(`Database bijgewerkt: ${data.external.length} uitjes, ${data.inspiration.length} inspiratie-items, ${data.links.length} links.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
