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
