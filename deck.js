export function parseCSV(text) {
  const rows = [];
  let i = 0;
  const cells = [];
  let cell = '';
  let inQuotes = false;

  const pushCell = () => { cells.push(cell); cell = ''; };
  const pushRow = () => {
    if (cells.length === 1 && cells[0] === '') { cells.length = 0; return; }
    rows.push(cells.slice());
    cells.length = 0;
  };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i += 2; continue; }
      if (c === '"') { inQuotes = false; i++; continue; }
      cell += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { pushCell(); i++; continue; }
    if (c === '\n') { pushCell(); pushRow(); i++; continue; }
    if (c === '\r') { i++; continue; }
    cell += c; i++;
  }
  if (cell.length || cells.length) { pushCell(); pushRow(); }

  if (!rows.length) return [];
  const header = rows.shift();
  return rows.map(r => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ''])));
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHTML(s) {
  return s.replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

export function renderProminent(text) {
  // Match _phrase_ where underscores sit at word boundaries:
  // start-of-string OR non-word char before the opening _;
  // non-word char or end-of-string after the closing _.
  // Phrase content cannot start or end with whitespace.
  const re = /(^|[^A-Za-z0-9_])_([^_\s][^_]*?[^_\s]|[^_\s])_(?=$|[^A-Za-z0-9_])/g;
  let out = '';
  let last = 0;
  for (const m of text.matchAll(re)) {
    out += escapeHTML(text.slice(last, m.index));
    out += escapeHTML(m[1]); // boundary char before the _
    out += '<em>' + escapeHTML(m[2]) + '</em>';
    last = m.index + m[0].length;
  }
  out += escapeHTML(text.slice(last));
  return out;
}
