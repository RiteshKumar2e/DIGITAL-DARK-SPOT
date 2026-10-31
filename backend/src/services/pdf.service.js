import { extractText, getDocumentProxy } from 'unpdf';
import { config } from '../config/index.js';
import { cleanText } from '../utils/text.js';
import { normalizeMetaDate } from '../utils/dates.js';

export class PdfError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export const isPdfBuffer = (buffer) => buffer.length > 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new PdfError('timeout', 'The PDF took too long to process.')), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// PDF info dates look like "D:20250114093000+05'30'".
function pdfInfoDate(value) {
  if (typeof value !== 'string') return null;
  const m = /D:(\d{4})(\d{2})(\d{2})/.exec(value);
  return m ? normalizeMetaDate(`${m[1]}-${m[2]}-${m[3]}`) : null;
}

/**
 * Extracts text from a PDF with page boundaries. Returns
 * { title, text, pages: [{ page, start }], pageCount, published, modified }.
 * No OCR is performed: scanned PDFs yield little or no text and are reported as such.
 */
export async function extractPdf(buffer) {
  const { maxPdfPages, pdfTimeoutMs } = config.limits;
  if (!isPdfBuffer(buffer)) throw new PdfError('not_pdf', 'This file is not a valid PDF document.');

  let pdf;
  try {
    pdf = await withTimeout(getDocumentProxy(new Uint8Array(buffer)), pdfTimeoutMs);
  } catch (error) {
    if (error instanceof PdfError) throw error;
    const encrypted = /password/i.test(error?.message || '');
    throw new PdfError(
      encrypted ? 'encrypted' : 'malformed',
      encrypted ? 'This PDF is password-protected and cannot be read.' : 'The PDF could not be opened. It may be damaged.',
    );
  }

  try {
    if (pdf.numPages > maxPdfPages) {
      throw new PdfError('too_many_pages', `The PDF has ${pdf.numPages} pages; the limit is ${maxPdfPages}.`);
    }
    const { text: pageTexts } = await withTimeout(extractText(pdf, { mergePages: false }), pdfTimeoutMs);

    let info = {};
    try {
      info = (await pdf.getMetadata())?.info || {};
    } catch {
      info = {};
    }

    const pages = [];
    let text = '';
    pageTexts.forEach((raw, index) => {
      const pageText = joinWrappedLines(cleanText(raw));
      if (!pageText) return;
      if (text) text += '\n\n';
      pages.push({ page: index + 1, start: text.length });
      text += pageText;
    });

    const created = pdfInfoDate(info.CreationDate);
    const modified = pdfInfoDate(info.ModDate);
    return {
      title: cleanText(typeof info.Title === 'string' ? info.Title : '').slice(0, 300),
      text,
      pages,
      pageCount: pdf.numPages,
      published: created ? { value: created, origin: 'PDF file creation date (may differ from the publication date)', raw: created } : null,
      modified:
        modified && modified !== created
          ? { value: modified, origin: 'PDF file modification date (may differ from a content update)', raw: modified }
          : null,
    };
  } finally {
    pdf.destroy?.();
  }
}

/**
 * PDFs break sentences at the end of every printed line. Rejoin those lines so
 * sentences stay whole: a line ending without terminal punctuation continues on
 * the next line; "re-" + "sults" across a break becomes "results". Lines that end
 * a sentence, and blank lines, are kept as breaks.
 */
export function joinWrappedLines(text) {
  return text
    .replace(/([a-z])-\n(?=[a-z]+-)/g, '$1-') // "English-\nto-German": a real compound, keep the hyphen
    .replace(/([a-z])-\n([a-z])/g, '$1$2')
    .replace(/([^\n.!?:;])\n(?=[^\n])/g, '$1 ');
}

/** Page number containing a character offset, for PDF citations. */
export function pageForOffset(pages, offset) {
  if (!pages?.length || offset < 0) return null;
  let page = pages[0].page;
  for (const entry of pages) {
    if (entry.start <= offset) page = entry.page;
    else break;
  }
  return page;
}
