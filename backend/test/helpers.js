import { buildTextSource } from '../src/services/source.service.js';

/** Builds a minimal, valid PDF with one text page per entry (Helvetica, no compression). */
export function makePdf(pages, { title = 'Test document' } = {}) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const catalog = add(null);
  const pagesObj = add(null);
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const kids = [];
  for (const text of pages) {
    const lines = text.split('\n').map((line) => line.replace(/([\\()])/g, '\\$1'));
    const ops = ['BT', '/F1 11 Tf', '14 TL', '50 780 Td', ...lines.map((l) => `(${l}) '`), 'ET'].join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(ops)} >>\nstream\n${ops}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const info = add(`<< /Title (${title}) /CreationDate (D:20260105090000Z) >>`);

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

/** A retrieved text source with optional domain and declared dates, for analysis fixtures. */
export function fixtureSource(id, { title = id, text, domain = null, published = null, modified = null, status = 'retrieved' }) {
  const source = { id, kind: 'text' };
  buildTextSource(source, { title, text });
  source.domain = domain;
  if (published) source.published = { value: published, origin: 'Fixture metadata', raw: published };
  if (modified) source.modified = { value: modified, origin: 'Fixture metadata', raw: modified };
  if (status !== 'retrieved') {
    source.status = status;
    source.text = '';
    source.error = { code: 'not_found', message: 'Fixture: page not found (HTTP 404).' };
  }
  return source;
}
