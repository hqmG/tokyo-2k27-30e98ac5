(() => {
  'use strict';

  // ---------- Konstanter ----------
  const TYPES = window.CONFIG.types;   // typer, färger och etiketter från config.js
  const HOUR_MS = 3600000, DAY_MS = 86400000;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const STATUS_LABELS = { proposal: 'Proposal', booked: 'Booked', approved: 'Approved' };
  const DECIDED = ['booked', 'approved'];   // Beslutade händelser visas på kartan och tidslinjen, övriga under Proposals
  const DAY_UTC_OFFSET = 9;                 // Japan (JST). Byt till 2 för svensk sommartid.
  const MIN_GAP = 84, LEVEL_H = 34, BASE = 42, EDGE = 70;   // tidslinjens avstånd (px)
  const CITY_CENTERS = { Tokyo: [35.6812, 139.7671], Osaka: [34.6937, 135.5023], Kyoto: [35.0116, 135.7681], Saigon: [10.7769, 106.7009] };
  const CITIES = Object.keys(CITY_CENTERS);
  const CITY_AIRPORTS = { Tokyo: ['NRT', 'HND'], Osaka: ['KIX', 'ITM'], Saigon: ['SGN'] };   // Flyg hör till en stad om någon av flygplatserna ligger där
  const FIREWORK_COLORS = ['#f43f5e', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#fb923c', '#f0abfc'];

  // ---------- Hjälpfunktioner ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const capitalize = s => String(s).charAt(0).toUpperCase() + String(s).slice(1);
  const dayLabel = dag => { const [, m, d] = dag.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };
  const hasCoords = p => p?.lat != null && p?.lng != null;
  const touches = (it, kod) => it.fran?.kod === kod || it.till?.kod === kod;
  const isFlight = it => Boolean(it.fran && it.till);
  const groupOf = it => TYPES[it.typ] ? it.typ : 'other';   // okända typer visas som Other
  const colorOf = it => TYPES[groupOf(it)].color;
  // Länkar från bladet visas bara om de är giltiga https-adresser (skydd mot javascript:-länkar och trasiga adresser)
  const isSafeUrl = u => {
    try { return new URL(u).protocol === 'https:'; } catch { return false; }
  };
  // En händelse hör till en stad via sitt stadsfält, ett flyg via någon av sina flygplatser
  const inCity = (it, city) => it.stad === city || (isFlight(it) && (CITY_AIRPORTS[city] || []).some(k => touches(it, k)));

  // Tid i UTC-millisekunder, så att avstånden på tidslinjen blir proportionerliga
  const absMs = it => Date.parse(`${it.dag}T${it.starttid || '00:00'}:00Z`) - (Number(it.utc) || 0) * HOUR_MS;
  const timeOf = s => ((s || '').match(/\d{2}:\d{2}/) || [''])[0];
  const arrivalMs = it => Date.parse(`${it.slutdag || it.dag}T${timeOf(it.sluttid)}:00Z`) - (Number(it.slututc) || 0) * HOUR_MS;
  const shortName = it => (it.namn || '').split(' ')[0];
  // Restid för flyg, t.ex. "1h 25m". Tiderna är lokala, så tidszonsskillnaden räknas in.
  const duration = it => {
    const min = Math.round((arrivalMs(it) - absMs(it)) / 60000);
    return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
  };
  // Ankomstdagen visas när den skiljer sig från avgångsdagen, t.ex. "14:00 → 10:25 (9 June)"
  const arrivalDay = it => it.slutdag && it.slutdag !== it.dag ? ` (${dayLabel(it.slutdag)})` : '';
  const rangeOf = it => (it.starttid || '') + (it.sluttid ? ` → ${it.sluttid}${arrivalDay(it)}` : '');
  // Länkens etikett följer webbplatsen, t.ex. "Google Maps", "Tabelog" eller "booking.com"
  const sourceLabel = url => {
    const host = new URL(url).hostname;
    if (/(^|\.)google\.[a-z.]+$/.test(host)) return 'Google Maps';
    if (/(^|\.)tabelog\.com$/.test(host)) return 'Tabelog';
    return host.split('.').slice(-2).join('.');
  };
  const linkHtml = u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(sourceLabel(u))} ↗</a>`;
  // Säkra länkar som en rad, avgränsade med ·
  const linksHtml = urls => [...new Set(urls)].filter(isSafeUrl).map(linkHtml).join(' · ');
  // Google Maps, Tabelog och bokningssidan (url, tabelog_url, booking_url) visas som länkar på samma rad
  const sourceRow = it => {
    const links = linksHtml([it.url, it.tabelogUrl, it.bookingUrl]);
    return links ? `<dt>Source</dt><dd>${links}</dd>` : '';
  };
  const rowsOf = pairs => pairs.filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(capitalize(v))}</dd>`).join('');

  // ---------- Data ----------
  const allItems = window.PLAN_ITEMS || [];
  const items = allItems.filter(it => DECIDED.includes(it.status));
  const proposals = allItems.filter(it => !DECIDED.includes(it.status));
  const sortedItems = [...items].sort((a, b) => absMs(a) - absMs(b));
  const flights = sortedItems.filter(isFlight);
  const airports = {};
  items.forEach(it => {
    if (it.fran) airports[it.fran.kod] = it.fran;
    if (it.till) airports[it.till.kod] = it.till;
  });
  const itemById = Object.fromEntries(items.map(it => [it.id, it]));
  const proposalById = Object.fromEntries(proposals.map(it => [it.id, it]));

  // ---------- Tillstånd och element ----------
  const detail = document.getElementById('detail');
  const canvas = document.getElementById('canvas');
  const panel = document.getElementById('panel');
  let selectedId = null;
  let selectedProposalId = null;
  // På smala skärmar startar tidslinjen inzoomad så att noderna inte trängs ihop
  const narrow = window.matchMedia('(max-width: 700px)');
  const defaultZoom = () => narrow.matches ? 1.5 : 1;
  let zoom = defaultZoom();
  let mapCity = null;   // staden som valts med knappen under kartan

  // ---------- Karta ----------
  const map = L.map('map', { zoomControl: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // ---------- Stadsdelar ----------
  // Områdena i config.js byggs av stadsdelsgränser (wards.js) och ritas först, så att de ligger under linjer och markörer.
  // Panelen under kartan visar stadsdelens rad i bladets flik Areas. Påverkar inte förslagen eller filtren.
  const WARDS = window.TOKYO_WARDS || {};
  const WARD_FILL = 0.12, WARD_FILL_ACTIVE = 0.4;   // fyllnadens opacitet i vila och vid hovring eller val
  const areaInfo = document.getElementById('area-info');
  let selectedWard = null;   // { layer, region, name, areas } för stadsdelen som valts med klick
  const setFill = (layer, active) => layer.setStyle({ fillOpacity: active ? WARD_FILL_ACTIVE : WARD_FILL });

  function renderArea() {
    if (!selectedWard) { areaInfo.hidden = true; return; }
    const { region, name, areas } = selectedWard;
    const info = window.AREA_INFO?.[name.toLowerCase()];   // id i fliken Areas = stadsdelens namn med små bokstäver
    let body;
    if (!window.AREA_INFO) body = '<p class="empty">Loading area info…</p>';
    else if (!info) body = '<p class="empty">No area info in the sheet.</p>';
    else {
      const rows = Object.entries(TYPES).filter(([key]) => info[key])
        .map(([key, t]) => `<dt><span class="swatch" style="background:${t.color}"></span>${esc(t.label)}</dt><dd>${esc(info[key])}</dd>`).join('');
      const links = linksHtml(String(info.sources || '').split(/\s+/));
      body = links
        ? `<p class="anote">General info compiled from the sources below, not verified.</p><dl>${rows}</dl><p class="asrc">Sources: ${links}</p>`
        : `<dl>${rows}</dl>`;
    }
    areaInfo.innerHTML = `<div class="ahead"><div>
        <h3><span class="swatch" style="background:${region.color}"></span>${esc(name)} · ${esc(region.name)}</h3>
        <div class="asub">${esc(areas)}</div></div>
        <button type="button" class="aclose" aria-label="Close area info">×</button></div>${body}`;
    areaInfo.style.borderColor = region.color;   // kortets kant i områdets färg
    areaInfo.hidden = false;
  }

  // Klick väljer stadsdelen, zoomar in och öppnar panelen. Klick på den valda stadsdelen väljer bort den.
  function toggleWard(entry) {
    const deselect = selectedWard?.layer === entry.layer;
    if (selectedWard) setFill(selectedWard.layer, false);
    selectedWard = deselect ? null : entry;
    setFill(entry.layer, true);   // pekaren är kvar över ytan
    renderArea();
    if (deselect) return;
    if (entry.region.city) { mapCity = entry.region.city; updateVisibility(); }
    map.fitBounds(entry.layer.getBounds(), { padding: [20, 20], animate: false });
  }

  function clearWard() {
    if (!selectedWard) return;
    setFill(selectedWard.layer, false);
    selectedWard = null;
    renderArea();
  }

  if (Object.keys(WARDS).length) map.attributionControl.addAttribution('Ward boundaries: <a href="https://www.gsi.go.jp/kankyochiri/gm_jpn.html">Global Map Japan (GSI)</a>');
  (window.CONFIG.regions || []).forEach(region => Object.entries(region.wards || {}).forEach(([code, areas]) => {
    const w = WARDS[code];
    if (!w) return;
    const layer = L.polygon(w.rings, { color: region.color, weight: 1.5, opacity: 0.8, fillColor: region.color, fillOpacity: WARD_FILL })
      .bindTooltip(`<b>${esc(w.name)}</b> · ${esc(region.name)}<br>${esc(areas)}`, { sticky: true })
      .addTo(map);
    const entry = { layer, region, name: w.name, areas };
    // Hovring gör ytan mindre transparent. En vald stadsdel behåller markeringen tills den väljs bort.
    layer.on('mouseover', () => setFill(layer, true));
    layer.on('mouseout', () => { if (selectedWard?.layer !== layer) setFill(layer, false); });
    layer.on('click', () => toggleWard(entry));
  }));
  areaInfo.addEventListener('click', e => { if (e.target.closest('.aclose')) clearWard(); });
  document.addEventListener('areas-loaded', renderArea);   // fliken Areas laddas separat och kan komma efter ett klick

  // Flyglinjer: osynliga tills de väljs. Den breda träffytan ligger ovanpå så att linjen är lätt att klicka på.
  const flightLines = {};
  flights.forEach(it => {
    const path = [[it.fran.lat, it.fran.lng], [it.till.lat, it.till.lng]];
    flightLines[it.id] = L.polyline(path, { color: colorOf(it), weight: 3, opacity: 0, interactive: false }).addTo(map);
    L.polyline(path, { weight: 16, opacity: 0 }).addTo(map).on('click', () => selectItem(it));
  });

  // Flygplatsmarkörer ligger ovanpå linjerna, så att klick på flygplatsen träffar den
  const airportMarkers = {};
  Object.values(airports).forEach(a => {
    const c = colorOf(items.find(it => touches(it, a.kod)));
    airportMarkers[a.kod] = L.circleMarker([a.lat, a.lng], { radius: 8, color: c, fillColor: c, fillOpacity: 0.01, weight: 3 })
      .bindTooltip(esc(a.kod), { permanent: true, direction: 'right', offset: [8, 0] })
      .addTo(map)
      .on('click', () => {
        // Väljer resan som startar på flygplatsen, annars den som ligger närmast i tid från nu
        const now = Date.now();
        const from = items.filter(it => it.fran?.kod === a.kod);
        const pick = from.length ? from : items.filter(it => touches(it, a.kod));
        const next = pick.reduce((best, it) => !best || Math.abs(absMs(it) - now) < Math.abs(absMs(best) - now) ? it : best, null);
        if (next) selectItem(next);
      });
  });

  // Händelser utan flyg (t.ex. food) är en markör på sin plats
  const pinMarkers = {};
  items.filter(it => !isFlight(it) && hasCoords(it.plats)).forEach(it => {
    const c = colorOf(it);
    pinMarkers[it.id] = L.circleMarker([it.plats.lat, it.plats.lng], { radius: 8, color: c, fillColor: c, fillOpacity: 0.01, weight: 2 })
      .bindTooltip(esc(it.namn), { direction: 'top' })
      .addTo(map)
      .on('click', () => selectItem(it));
  });

  // Förslag visas på kartan när de passar filtret: transparenta i kategorins färg, fyllda när de är valda
  const proposalMarkers = {};
  const mappedProposals = proposals.filter(it => hasCoords(it.plats));
  mappedProposals.forEach(it => {
    const c = colorOf(it);
    proposalMarkers[it.id] = L.circleMarker([it.plats.lat, it.plats.lng], {
      radius: 8, color: c, weight: 2, opacity: 0.75, fillColor: c, fillOpacity: 0
    }).bindTooltip(esc(it.namn), { direction: 'top' })
      .addTo(map)
      .on('click', () => toggleProposal(it));
  });

  // Standardvyn visar alla flygplatser, annars alla platser i planen
  function homeView() {
    const pts = Object.values(airports).filter(hasCoords).map(a => [a.lat, a.lng]);
    const all = pts.length ? pts : pointsOf(() => true);
    if (all.length) map.fitBounds(all, { padding: [40, 40] });
    else map.setView([20, 120], 3);
  }
  homeView();
  document.getElementById('mapZoomIn').addEventListener('click', () => map.zoomIn());
  document.getElementById('mapZoomOut').addEventListener('click', () => map.zoomOut());
  document.getElementById('mapZoomFit').addEventListener('click', homeView);
  // Min position: blinkande röd prick som följer positionen. Startas och stängs med knappen.
  // Positionen visas bara i webbläsaren och sparas eller skickas ingenstans.
  const locateBtn = document.getElementById('mapLocate');
  const meIcon = L.divIcon({ className: '', html: '<span class="me-dot"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
  let watchId = null, meMarker = null;
  function stopLocate(message = 'Show my position') {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    meMarker?.remove();
    meMarker = null;
    locateBtn.setAttribute('aria-pressed', 'false');
    locateBtn.title = message;
  }
  locateBtn.addEventListener('click', () => {
    if (watchId !== null) { stopLocate(); return; }
    if (!('geolocation' in navigator)) { locateBtn.title = 'Position is not available in this browser'; return; }
    locateBtn.setAttribute('aria-pressed', 'true');
    locateBtn.title = 'Hide my position';
    let centered = false;   // kartan centreras på första positionen, sedan flyttas bara pricken
    watchId = navigator.geolocation.watchPosition(pos => {
      const ll = [pos.coords.latitude, pos.coords.longitude];
      if (meMarker) meMarker.setLatLng(ll);
      else meMarker = L.marker(ll, { icon: meIcon, interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(map);
      if (!centered) { map.setView(ll, Math.max(map.getZoom(), 15), { animate: false }); centered = true; }
    }, err => {
      console.warn('Position kunde inte hämtas:', err.message);
      stopLocate(`Position unavailable (${err.message})`);
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
  });

  // Zoomar in på stadens centrum (mitt i kartan) och visar alla noder som hör till staden
  function zoomToCity(city) {
    const [cLat, cLng] = CITY_CENTERS[city];
    mapCity = city;
    updateVisibility();
    const pts = pointsOf(it => inCity(it, city), p => (CITY_AIRPORTS[city] || []).includes(p.kod));
    // Lika långt åt alla håll från centrum, så att staden hamnar i mitten
    const half = pts.reduce((m, [la, ln]) => Math.max(m, Math.abs(la - cLat), Math.abs(ln - cLng)), 0.02);
    map.fitBounds([[cLat - half, cLng - half], [cLat + half, cLng + half]], { padding: [20, 20], maxZoom: 15, animate: false });
  }
  // Knapparna byggs från CITY_CENTERS, så en ny stad läggs bara till där
  const cityZoom = document.getElementById('city-zoom');
  cityZoom.innerHTML = CITIES.map(c => `<button type="button" data-city-zoom="${esc(c)}">${esc(c)}</button>`).join('');
  cityZoom.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn) zoomToCity(btn.dataset.cityZoom);
  });

  // Flyglinjer: bara den valda flygningen visas, även när ett förslag är valt
  function styleFlightLines() {
    flights.forEach(f => {
      const sel = f.id === selectedId;
      flightLines[f.id].setStyle({ opacity: sel ? 1 : 0, weight: sel ? 4 : 3 });
    });
  }

  // Flygplatsernas etiketter visas bara för den valda resan (ifyllnad och linjer sköts av updateVisibility)
  function showAirportLabels(it) {
    Object.entries(airportMarkers).forEach(([kod, m]) => {
      if (touches(it, kod)) m.openTooltip(); else m.closeTooltip();
    });
  }

  // Ruttbilden byggs av flygningarna i planen. Flygplanet står vid senast landade flygplats eller mitt i aktuell flygning.
  function updateRoute() {
    const svg = document.getElementById('route');
    if (!flights.length) { svg.innerHTML = ''; return; }
    // Ritas i sin verkliga pixelbredd så att text och symboler får samma storlek som övrig text
    const W = svg.clientWidth || 600;
    const H = 84, M = 40;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const codes = [flights[0].fran.kod, ...flights.map(f => f.till.kod)];
    const step = (W - 2 * M) / (codes.length - 1);
    const x = i => M + i * step;
    const now = Date.now();
    let plane = x(0);
    flights.forEach((f, i) => {
      const dep = absMs(f), arr = arrivalMs(f);
      if (now >= arr) plane = x(i + 1);
      else if (now >= dep) plane = x(i) + (x(i + 1) - x(i)) * (now - dep) / ((arr - dep) || 1);
    });
    svg.innerHTML = `<path class="route-line" d="M${M} 34 L${W - M} 34" fill="none" />
      <path class="route-flown" d="M${M} 34 L${plane} 34" fill="none" />
      <g class="stops">${codes.map((c, i) => `<circle cx="${x(i)}" cy="34" r="6"/><text x="${x(i)}" y="62">${esc(c)}</text>`).join('')}</g>
      <text class="plane" x="${plane}" y="22">✈</text>`;
  }

  // Zoomar kartan till en plats (förslag och händelser utan flyg)
  const focusPlace = p => { if (hasCoords(p)) map.setView([p.lat, p.lng], 14, { animate: false }); };

  // Zoomar kartan till en händelse: flyg visas som rutt, övriga som en plats
  function focusOn(it) {
    showAirportLabels(it);
    if (isFlight(it)) {
      map.fitBounds([[it.fran.lat, it.fran.lng], [it.till.lat, it.till.lng]], { padding: [60, 60], maxZoom: 6, animate: false });
    } else {
      focusPlace(it.plats);
    }
  }

  // ---------- Detaljruta ----------
  // Flyget som i tidslinjen: avgång, linje med flightnummer och ankomst
  const legOf = it => `<div class="dleg">
      <div><b>${esc(it.fran.kod)}</b><span>${esc(it.starttid || '')}</span></div>
      <div class="dleg-line" style="border-top-color:${colorOf(it)}"><span>${esc(shortName(it))}</span></div>
      <div><b>${esc(it.till.kod)}</b><span>${esc(timeOf(it.sluttid))}</span></div>
    </div>`;

  // Visar en bokad händelse i detaljrutan och markerar den i tidslinjen och på kartan
  function showDetail(it) {
    selectedId = it.id;
    // Flygnumret visas redan i flyglinjen, så titeln blir bara rutten
    const title = isFlight(it) ? it.namn.replace(/^\S+\s+/, '') : it.namn;
    // Transport visar terminalerna (summary), övriga händelser adressen
    const transport = it.typ === 'transport';
    const rows = rowsOf([
      ['Status', STATUS_LABELS[it.status] || it.status], ['Date', it.dag],
      ['Time', rangeOf(it)],
      ['Duration', transport && it.sluttid ? duration(it) : ''],
      transport ? ['Terminal', it.summary] : ['Place', it.adress], ['Price', it.pris], ['Notes', it.anteckn]
    ]) + sourceRow(it);
    detail.innerHTML = `<h3><span class="swatch" style="background:${colorOf(it)}"></span>${esc(title)}</h3>` +
      `${isFlight(it) ? legOf(it) : ''}<dl>${rows}</dl>`;
    renderTimeline();
    updateVisibility();
  }

  // Väljer en händelse (från tidslinjen, kartan eller detaljrutan) och zoomar kartan till den
  function selectItem(it) {
    showDetail(it);
    focusOn(it);
  }

  // Klick i detaljrutan zoomar kartan tillbaka till den valda händelsen (länkar fungerar som vanligt)
  detail.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const it = itemById[selectedId];
    if (it) selectItem(it);
  });

  // ---------- Tidslinje ----------
  function renderTimeline() {
    if (!sortedItems.length) { canvas.innerHTML = ''; return; }

    // Noder: vanliga händelser har en nod, transport har två (avgång och ankomst)
    const nodes = sortedItems.flatMap(it => isFlight(it)
      ? [{ it, ms: absMs(it), code: it.fran.kod, time: it.starttid || '' },
         { it, ms: arrivalMs(it), code: it.till.kod, time: timeOf(it.sluttid) }]
      : [{ it, ms: absMs(it), code: shortName(it), time: it.starttid || '' }]
    ).sort((a, b) => a.ms - b.ms);

    const t0 = nodes[0].ms;
    const hours = (nodes[nodes.length - 1].ms - t0) / HOUR_MS;
    // Grundbredden är webbappens bredd (ca 1040 px), så på desktop får den plats utan scroll och på mobil scrollas den
    const width = Math.max(panel.clientWidth - 2, 1040) * zoom;
    canvas.style.width = width + 'px';
    const scale = hours > 0 ? (width - 2 * EDGE) / hours : 0;
    const xOf = ms => hours > 0 ? EDGE + ((ms - t0) / HOUR_MS) * scale : width / 2;

    // Dagband: en kolumn per dag i resan, även dagar utan händelser
    let bands = '';
    const dayItems = sortedItems.filter(it => it.dag);
    if (dayItems.length) {
      const first = dayItems[0].dag;
      // Sista dagen är den dag då sista objektet slutar (t.ex. ett flyg som landar dagen efter)
      const last = dayItems.reduce((max, it) => (it.slutdag || it.dag) > max ? (it.slutdag || it.dag) : max, first);
      const lastMs = Date.parse(`${last}T00:00:00Z`);
      let index = 0;
      for (let ms = Date.parse(`${first}T00:00:00Z`); ms <= lastMs; ms += DAY_MS, index++) {
        const date = new Date(ms).toISOString().slice(0, 10);
        const start = Math.max(xOf(ms - DAY_UTC_OFFSET * HOUR_MS), 0);
        const end = Math.min(xOf(ms + DAY_MS - DAY_UTC_OFFSET * HOUR_MS), width);
        if (end <= start) continue;
        bands += `<div class="band ${index % 2 ? 'alt' : ''}" style="left:${start}px; width:${end - start}px">` +
                 `<span class="bandlabel">${esc(dayLabel(date))}</span></div>`;
      }
    }

    // Kopplingar mellan avgång och ankomst, i flygets färg
    const links = flights.map(it => {
      const x1 = xOf(absMs(it)), x2 = xOf(arrivalMs(it));
      return `<div class="leg-bar" style="left:${Math.min(x1, x2)}px; width:${Math.abs(x2 - x1)}px; border-top-color:${colorOf(it)}"></div>` +
             `<span class="leg-label" style="left:${(x1 + x2) / 2}px">${esc(shortName(it))}</span>`;
    }).join('');

    // Staplade nivåer: en nod som ligger för nära en tidigare på samma sida placeras en nivå längre ut
    const levelsX = { up: [], down: [] };
    const nodeHtml = nodes.map((n, i) => {
      const x = xOf(n.ms);
      const side = i % 2 === 0 ? 'up' : 'down';
      const levels = levelsX[side];
      let lvl = levels.findIndex(lx => Math.abs(x - lx) >= MIN_GAP);
      if (lvl === -1) { lvl = levels.length; levels.push(x); } else { levels[lvl] = x; }
      const c = colorOf(n.it);
      const active = n.it.id === selectedId;
      const offset = BASE + lvl * LEVEL_H;
      const labelPos = side === 'up' ? `bottom:${offset}px` : `top:${offset}px`;
      return `<div class="node ${side} ${active ? 'active' : ''}" data-id="${esc(n.it.id)}" style="left:${x}px">
          <div class="stem" style="height:${offset - 12}px"></div>
          <span class="dot" style="border-color:${c};${active ? ` background:${c};` : ''}"></span>
          <div class="label" style="${labelPos}"><b>${esc(n.code)}</b><span>${esc(n.time)}</span></div></div>`;
    }).join('');

    canvas.innerHTML = `<div class="axis" style="left:${EDGE}px; right:${EDGE}px"></div>` + bands + links + nodeHtml;
  }

  canvas.addEventListener('click', e => {
    const node = e.target.closest('.node');
    const it = node && itemById[node.dataset.id];
    if (it) selectItem(it);
  });

  // ---------- Zoom ----------
  function setZoom(next, anchorRatio) {
    zoom = Math.min(Math.max(next, 1), 8);
    const ratio = anchorRatio ?? ((panel.scrollLeft + panel.clientWidth / 2) / Math.max(panel.scrollWidth, 1));
    renderTimeline();
    panel.scrollLeft = ratio * panel.scrollWidth - panel.clientWidth / 2;
  }
  document.getElementById('zoomIn').addEventListener('click', () => setZoom(zoom * 1.5));
  document.getElementById('zoomOut').addEventListener('click', () => setZoom(zoom / 1.5));
  // Startläget: rätt zoom för skärmen och tidslinjen scrollad till nästa händelse
  const nextItem = () => sortedItems.find(it => absMs(it) >= Date.now()) || sortedItems[sortedItems.length - 1];
  function focusNext() {
    const next = nextItem();
    const node = next && canvas.querySelector(`.node[data-id="${CSS.escape(next.id)}"]`);
    if (node) panel.scrollLeft = node.offsetLeft - panel.clientWidth / 2;
  }
  document.getElementById('zoomFit').addEventListener('click', () => {
    zoom = defaultZoom();
    renderTimeline();
    focusNext();
  });
  panel.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const rect = panel.getBoundingClientRect();
    const ratio = (panel.scrollLeft + (e.clientX - rect.left)) / Math.max(panel.scrollWidth, 1);
    setZoom(zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2), ratio);
  }, { passive: false });

  // ---------- Förslag ----------
  // Betyg med stjärnor, delvis ifyllda (t.ex. 4.3 = 4 fulla och en till 30 %)
  function ratingHtml(it) {
    if (it.rating == null) return '';
    const stars = '★★★★★';
    const count = it.ratingCount != null ? ` (${Number(it.ratingCount).toLocaleString('en-US')})` : '';
    return `<span class="rating"><span class="stars">${stars}<span class="fill" style="width:${(it.rating / 5) * 100}%">${stars}</span></span>${it.rating.toFixed(1)}${count}</span>`;
  }

  // Filter: kategorier och städer, flera kan väljas. Tom mängd = All. Gäller listan och kartan.
  const proposalFilter = new Set();
  const cityFilter = new Set();
  let bookedShown = false;   // bokade noder visas från och med första filterklicket, även för All
  const matchesFilter = it =>
    (proposalFilter.size === 0 || proposalFilter.has(groupOf(it))) &&
    (cityFilter.size === 0 || [...cityFilter].some(c => inCity(it, c)));

  const tabsHtml = (attr, set, keys, label) => ['all', ...keys].map(k => {
    const active = k === 'all' ? set.size === 0 : set.has(k);
    return `<button type="button" data-${attr}="${esc(k)}" class="${active ? 'active' : ''}">${esc(label(k))}</button>`;
  }).join('');
  function renderTabs() {
    document.getElementById('tabs').innerHTML = tabsHtml('type', proposalFilter, Object.keys(TYPES),
      k => k === 'all' ? 'All categories' : TYPES[k].label);
    document.getElementById('city-tabs').innerHTML = tabsHtml('city', cityFilter, CITIES,
      c => c === 'all' ? 'All cities' : c);
  }

  // Kartan styrs av två håll: filtren visar förslag (och bokade noder efter första filterklicket),
  // och den valda händelsen visas alltid ifylld, även när ett förslag är valt.
  // Staden som valts med knappen under kartan visar alla dess noder, oberoende av proposals-filtret
  const inMapCity = it => Boolean(mapCity) && inCity(it, mapCity);
  const toggleOnMap = (m, on) => { if (on) m.addTo(map); else m.remove(); };
  function updateVisibility() {
    mappedProposals.forEach(it => toggleOnMap(proposalMarkers[it.id], matchesFilter(it) || inMapCity(it)));
    Object.entries(pinMarkers).forEach(([id, m]) => {
      const sel = id === selectedId;
      toggleOnMap(m, bookedShown || sel || inMapCity(itemById[id]));
      m.setStyle({ fillOpacity: sel ? 1 : 0.01 });
    });
    Object.entries(airportMarkers).forEach(([kod, m]) => {
      const sel = flights.some(f => touches(f, kod) && f.id === selectedId);
      toggleOnMap(m, sel || flights.some(f => touches(f, kod) && (bookedShown || inMapCity(f))));
      m.setStyle({ fillOpacity: sel ? 1 : 0.01 });
    });
    styleFlightLines();
  }

  // Koordinater för kartobjekt som uppfyller villkoret. Flyg bidrar med de ändpunkter som godkänns av endpointOk.
  function pointsOf(pred, endpointOk = () => true) {
    const pts = [];
    mappedProposals.filter(pred).forEach(it => pts.push([it.plats.lat, it.plats.lng]));
    items.filter(pred).forEach(it => {
      if (isFlight(it)) [it.fran, it.till].filter(endpointOk).forEach(p => pts.push([p.lat, p.lng]));
      else if (hasCoords(it.plats)) pts.push([it.plats.lat, it.plats.lng]);
    });
    return pts;
  }

  // Filtret zoomar kartan till de förslag som passar det (med All och All: alla förslag)
  function applyMarkerFilter() {
    updateVisibility();
    const points = mappedProposals.filter(matchesFilter).map(it => [it.plats.lat, it.plats.lng]);
    if (points.length) map.fitBounds(points, { padding: [40, 40], maxZoom: 14, animate: false });
  }

  // Detaljerna i ett expanderat förslagskort
  const proposalRows = it => rowsOf([
    ['Status', STATUS_LABELS[it.status] || it.status], ['Price', it.pris], ['Opening hours', it.oppettider],
    ['Description', it.description], ['Review', it.review], ['Notes', it.anteckn]
  ]) + sourceRow(it);

  function renderProposals() {
    const el = document.getElementById('proposals');
    // Sorteras efter betyg, högst först. Förslag utan betyg hamnar sist.
    const shown = proposals.filter(matchesFilter).sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    if (!shown.length) { el.innerHTML = '<div class="empty">No proposals match the filter.</div>'; return; }
    el.innerHTML = Object.keys(TYPES).map(key => {
      const list = shown.filter(it => groupOf(it) === key);
      if (!list.length) return '';
      // Korten är minimerade; rubriken är en knapp som visar detaljerna (klassen active på kortet)
      const cards = list.map(it => {
        const open = it.id === selectedProposalId;
        return `<div class="pcard${open ? ' active' : ''}" data-pid="${esc(it.id)}">
          <button type="button" class="phead" aria-expanded="${open}">
            <span class="pname"><span class="swatch" style="background:${colorOf(it)}"></span>${esc(it.namn)}${ratingHtml(it)}</span>
            ${it.summary ? `<span class="psummary">${esc(it.summary)}</span>` : ''}
          </button>
          <dl class="pdetail">${proposalRows(it)}</dl>
        </div>`;
      }).join('');
      return `<div class="pgroup">${cards}</div>`;
    }).join('');
  }

  // Klick väljer eller avväljer ett värde. All rensar hela urvalet
  const toggleIn = (set, key) => {
    if (key === 'all') set.clear();
    else if (set.has(key)) set.delete(key);
    else set.add(key);
  };
  function setFilter(set, key) {
    toggleIn(set, key);
    bookedShown = true;
    renderTabs();
    renderProposals();
    applyMarkerFilter();
  }

  // Det valda förslaget är expanderat i listan och ifyllt på kartan, övriga är minimerade
  function markProposal() {
    document.querySelectorAll('.pcard').forEach(c => {
      const open = c.dataset.pid === selectedProposalId;
      c.classList.toggle('active', open);
      c.querySelector('.phead').setAttribute('aria-expanded', String(open));
    });
    Object.entries(proposalMarkers).forEach(([pid, m]) => m.setStyle({ fillOpacity: pid === selectedProposalId ? 0.75 : 0 }));
  }

  // Väljer ett förslag, eller minimerar det om det redan är valt
  function toggleProposal(it) {
    selectedProposalId = selectedProposalId === it.id ? null : it.id;
    markProposal();
    if (!selectedProposalId) return;
    focusPlace(it.plats);
    document.querySelector(`.pcard[data-pid="${CSS.escape(it.id)}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  document.getElementById('tabs').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn) setFilter(proposalFilter, btn.dataset.type);
  });
  document.getElementById('city-tabs').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn) setFilter(cityFilter, btn.dataset.city);
  });
  // Kortets rubrik växlar kortet (knappen hanterar även Enter och mellanslag)
  document.getElementById('proposals').addEventListener('click', e => {
    const card = e.target.closest('.phead')?.closest('.pcard');
    const it = card && proposalById[card.dataset.pid];
    if (it) toggleProposal(it);
  });

  // ---------- Nedräkning till första flyget ----------
  const countdownEl = document.getElementById('countdown');
  const firstFlight = flights[0];
  let fxShown = false;
  let departedSeen = null;

  // Fyrverkerier: sex skurar med gnistor som tas bort efter en stund
  function fireworks() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const layer = document.createElement('div');
    layer.className = 'fx';
    for (let b = 0; b < 6; b++) {
      const cx = 15 + Math.random() * 70, cy = 15 + Math.random() * 40;
      const color = FIREWORK_COLORS[b % FIREWORK_COLORS.length];
      const burstDelay = b * 450 + Math.random() * 150;
      for (let i = 0; i < 40; i++) {
        const s = document.createElement('i');
        const ang = (i / 40) * Math.PI * 2 + Math.random() * 0.2;
        const dist = 70 + Math.random() * 110;
        const size = 3 + Math.random() * 4;
        s.style.left = cx + '%';
        s.style.top = cy + '%';
        s.style.width = s.style.height = size + 'px';
        s.style.setProperty('--dx', (Math.cos(ang) * dist) + 'px');
        s.style.setProperty('--dy', (Math.sin(ang) * dist + 30) + 'px');
        s.style.background = Math.random() < 0.15 ? '#ffffff' : color;
        s.style.boxShadow = '0 0 8px ' + color;
        s.style.animationDelay = (burstDelay + Math.random() * 80) + 'ms';
        layer.appendChild(s);
      }
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 4500);
  }

  const tilesHtml = units => units.map(([label, value]) =>
    `<div class="cd-unit"><span class="cd-num">${String(value).padStart(2, '0')}</span><span class="cd-lbl">${label}</span></div>`
  ).join('');

  const hms = ms => [
    ['hours', Math.floor((ms % DAY_MS) / HOUR_MS)],
    ['minutes', Math.floor((ms % HOUR_MS) / 60000)],
    ['seconds', Math.floor((ms % 60000) / 1000)]
  ];

  // Räknar ner hela månader i kalendern, resten som dagar, timmar, minuter och sekunder
  function untilUnits(now, target) {
    let cursor = new Date(now);
    let months = 0;
    for (;;) {
      const next = new Date(cursor);
      next.setUTCMonth(next.getUTCMonth() + 1);
      if (next.getTime() > target) break;
      cursor = next;
      months++;
    }
    const diff = target - cursor.getTime();
    return [['months', months], ['days', Math.floor(diff / DAY_MS)], ...hms(diff)];
  }

  // Efter avgång räknas tiden upp sedan avgången
  const sinceUnits = elapsed => [['days', Math.floor(elapsed / DAY_MS)], ...hms(elapsed)];

  function renderCountdown() {
    const target = absMs(firstFlight);
    const now = Date.now();
    const departed = target - now <= 0;

    // Fyrverkerier när nedräkningen passerar noll medan sidan är öppen, och en gång per sidöppning under första dygnet
    const justDeparted = departed && departedSeen === false;
    const inWindow = departed && now - target < DAY_MS;
    departedSeen = departed;
    if (justDeparted || (inWindow && !fxShown)) { fireworks(); fxShown = true; }

    countdownEl.innerHTML = tilesHtml(departed ? sinceUnits(now - target) : untilUnits(now, target));
  }

  // ---------- Start ----------
  document.getElementById('legend').innerHTML = Object.values(TYPES)
    .map(t => `<span><i style="background:${t.color}"></i>${esc(t.label)}</span>`).join('');
  renderTabs();
  renderProposals();
  // Vid start väljs nästa händelse (eller den sista, om alla har passerat)
  const upcoming = nextItem();
  if (upcoming) { showDetail(upcoming); showAirportLabels(upcoming); } else renderTimeline();
  focusNext();
  if (firstFlight) {
    renderCountdown();
    setInterval(renderCountdown, 1000);
  }
  updateRoute();
  setInterval(updateRoute, 60000);
  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { renderTimeline(); updateRoute(); });
  });
})();
