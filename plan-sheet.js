// Läser planen från Google Sheets (fliken "Plan"). Enda datakällan: om bladet inte går att läsa visas ett felmeddelande.
(() => {
  const SHEET_ID = '1GuYIA1zDnEMxz6cnNgzt8dHVtd0-GzT48RjtsS8q46o';
  const SHEET_NAME = 'Plan';
  const TIMEOUT_MS = 30000;
  const CALLBACK = '__onPlanData';
  // Kolumnerna i bladet, i samma ordning som i kalkylbladet
  const COLUMNS = ['id', 'type', 'name', 'status', 'date', 'end_date', 'start_time', 'end_time', 'utc_offset', 'end_utc_offset',
    'from_code', 'from_lat', 'from_lng', 'to_code', 'to_lat', 'to_lng', 'lat', 'lng', 'city', 'address', 'price',
    'rating', 'rating_count', 'url', 'opening_hours', 'summary', 'notes'];

  const pad = n => String(n).padStart(2, '0');
  const num = s => (s === '' ? undefined : Number(s));

  // Google returnerar datum och klockslag som "Date(...)". Här görs de om till text.
  function cellText(cell) {
    const v = cell?.v;
    if (v == null) return '';
    if (typeof v === 'string' && v.startsWith('Date(')) {
      const n = v.match(/-?\d+/g).map(Number);
      return n[0] === 1899 ? `${pad(n[3])}:${pad(n[4])}` : `${n[0]}-${pad(n[1] + 1)}-${pad(n[2])}`;   // klockslag eller datum
    }
    return String(v);
  }

  // Gör om en rad till det format som index.js använder
  function toItem(row) {
    const f = Object.fromEntries(COLUMNS.map((c, i) => [c, cellText(row.c[i])]));
    const item = {
      id: f.id, typ: f.type, namn: f.name, status: f.status, dag: f.date,
      starttid: f.start_time, sluttid: f.end_time,
      utc: num(f.utc_offset) ?? 0, slututc: num(f.end_utc_offset) ?? 0,
      adress: f.address, pris: f.price, anteckn: f.notes, stad: f.city,
      url: f.url, oppettider: f.opening_hours, summary: f.summary,
      rating: num(f.rating), ratingCount: num(f.rating_count)
    };
    if (f.end_date) item.slutdag = f.end_date;
    if (f.from_code) item.fran = { kod: f.from_code, lat: num(f.from_lat), lng: num(f.from_lng) };
    if (f.to_code) item.till = { kod: f.to_code, lat: num(f.to_lat), lng: num(f.to_lng) };
    if (f.lat) item.plats = { lat: num(f.lat), lng: num(f.lng) };
    return item;
  }

  function loadScript(src, onError) {
    const s = document.createElement('script');
    s.src = src;
    if (onError) s.onerror = onError;
    document.head.appendChild(s);
  }

  // Tre animerade prickar under rubriken medan planen laddas (stilen finns i index.html)
  const loader = document.createElement('div');
  loader.className = 'plan-loader';
  loader.setAttribute('role', 'status');
  loader.setAttribute('aria-label', 'Laddar planen');
  loader.innerHTML = '<span></span><span></span><span></span>';
  document.querySelector('.header').after(loader);

  let loaded = false;
  let errorEl = null;

  // Felmeddelande vid timeout eller fel. Om planen ändå kommer senare tas meddelandet bort.
  function fail(reason) {
    if (loaded || errorEl) return;
    loader.remove();
    errorEl = document.createElement('p');
    errorEl.className = 'plan-error';
    errorEl.textContent = `Planen kunde inte laddas från Google Sheets (${reason}).`;
    document.body.prepend(errorEl);
  }

  const timer = setTimeout(() => fail(`timeout efter ${TIMEOUT_MS / 1000} s`), TIMEOUT_MS);

  window[CALLBACK] = response => {
    if (loaded) return;
    try {
      const rows = response.table.rows.filter(r => r.c?.[0]?.v && r.c[0].v !== 'id');
      window.PLAN_MODULES = [{ type: 'sheet', items: rows.map(toItem) }];
    } catch (e) {
      clearTimeout(timer);
      fail(`kunde inte tolka svaret: ${e.message}`);
      return;
    }
    loaded = true;
    clearTimeout(timer);
    loader.remove();
    errorEl?.remove();
    loadScript('index.js');
  };

  loadScript(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler:${CALLBACK}&sheet=${SHEET_NAME}`,
    () => { clearTimeout(timer); fail('skriptet kunde inte laddas'); });
})();
