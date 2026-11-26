// Läser planen från Google Sheets (fliken "Plan"). Enda datakällan: om bladet inte går att läsa visas ett felmeddelande.
// Kolumnerna matchas på rubrikraden i bladet, så kolumner kan flyttas eller läggas till utan att koden ändras.
(() => {
  const { id: SHEET_ID, name: SHEET_NAME } = window.CONFIG.sheet;   // från config.js
  const TIMEOUT_MS = 30000;
  const CALLBACK = '__onPlanData';

  const pad = n => String(n).padStart(2, '0');
  // Tal kan komma som text med decimalkomma (svensk locale), t.ex. "55,612013"
  const num = s => {
    if (s === '') return undefined;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  };

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

  // Rubrikerna kommer antingen som kolumnetiketter eller som en rad som börjar med "id"
  function headerOf(table) {
    const labels = table.cols.map(c => String(c.label ?? '').trim());
    if (labels.includes('id')) return labels;
    const row = table.rows.find(r => r.c?.[0]?.v === 'id');
    if (!row) throw new Error('rubrikraden saknas');
    return row.c.map(cell => String(cell?.v ?? '').trim());
  }

  // Gör om en rad till det format som index.js använder
  function toItem(row, header) {
    const f = Object.fromEntries(header.map((name, i) => [name, cellText(row.c[i])]));
    const lat = num(f.latitude), lng = num(f.longitude);
    const item = {
      id: f.id, typ: f.type, namn: f.name, status: f.status, dag: f.date,
      starttid: f.time, sluttid: f.end_time,
      utc: num(f.utc_offset) ?? 0, slututc: num(f.end_utc_offset) ?? 0,
      stad: f.city, summary: f.summary, adress: f.address,
      rating: num(f.rating), ratingCount: num(f.rating_count), pris: f.price,
      oppettider: f.opening_hours, description: f.description, review: f.review, anteckn: f.notes, url: f.url, tabelogUrl: f.tabelog_url, bookingUrl: f.booking_url
    };
    if (f.end_date) item.slutdag = f.end_date;
    // Transport: latitude/longitude är avreseplatsen, to_latitude/to_longitude ankomstplatsen.
    // Övriga objekt har en enda plats.
    if (f.from_code) item.fran = { kod: f.from_code, lat, lng };
    else if (lat != null && lng != null) item.plats = { lat, lng };
    if (f.to_code) item.till = { kod: f.to_code, lat: num(f.to_latitude), lng: num(f.to_longitude) };
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
    clearTimeout(timer);
    try {
      const header = headerOf(response.table);
      const rows = response.table.rows.filter(r => r.c?.[0]?.v && r.c[0].v !== 'id');
      window.PLAN_ITEMS = rows.map(r => toItem(r, header));
    } catch (e) {
      fail(`kunde inte tolka svaret: ${e.message}`);
      return;
    }
    loaded = true;
    loader.remove();
    errorEl?.remove();
    loadScript('index.js');
  };

  loadScript(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=responseHandler:${CALLBACK}&sheet=${encodeURIComponent(SHEET_NAME)}`,
    () => { clearTimeout(timer); fail('skriptet kunde inte laddas'); });
})();
