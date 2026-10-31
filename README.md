# Digital Dark Spot

**AI-assisted information gap detection.** Built for the Shinchan Online Hackathon 2026 (problem statement: *Digital Dark Spot*).

People make decisions about scholarships, jobs and public services using information scattered across many pages. Some pages are outdated, some disagree, and important questions often go unanswered. Search finds pages and summaries condense them, but neither tells you **what is missing**.

Digital Dark Spot takes a research question and the sources you collected, and reports:

- **Potential information gaps**: topics your type of research needs that are *not found in the sources reviewed*, with the exact search scope.
- **Possible contradictions**: different deadlines, amounts, age or income limits, marks or document lists across sources, shown side by side with both quotes. Likely explanations such as a different application cycle, unit or category are labelled.
- **Freshness warnings**: old publication dates, deadlines that have passed, and undated pages.
- **A prioritised verification checklist**: generated from the findings, with completion state saved per session.
- **Evidence for everything**: every finding links to the sentence it is based on, highlighted in the full retrieved text.

## How the analysis works

1. **Retrieval** (`backend/src/services/fetcher.service.js`). Public pages are fetched server-side with SSRF protection. Private, loopback, link-local and cloud-metadata addresses are blocked at DNS-resolution time, every redirect is re-validated, and size, time and content-type limits are enforced. Pages that fail are shown with the reason and are never counted as reviewed. Text can also be pasted (for PDFs or pages that block bots).
2. **Extraction** (`analysis/claims.js`). Sentences are split and tagged with facets (eligibility, deadline, amount, documents, renewal…). Dates, money (including lakh/crore), ages and percentages are parsed. Sentences are stored verbatim.
3. **Gaps** (`analysis/gaps.js`). Each research type (scholarship, job, public service, research, general) defines the facets it needs, with importance and a verification step. Gaps record which sources were searched and which wording was looked for. Evidence strength reflects how much text was actually reviewed.
4. **Contradictions** (`analysis/contradictions.js`). Values are compared only when each sentence states a single explicit value. Differences explained by year/cycle, unit (monthly vs yearly) or category are classified separately from possible contradictions. Document lists are compared by document type.
5. **Freshness** (`analysis/freshness.js`). Uses only dates the page declares (meta tags, JSON-LD, `<time>`). Undated pages are reported as "Date unavailable", not as outdated.
6. **Optional AI review** (`services/ai.service.js`, Groq). Produces a summary, extra gap suggestions and a second opinion on contradictions. Source text is wrapped as untrusted data, and every AI key point must carry a quote that is checked word for word against the source; unverifiable statements are discarded. AI output is labelled in the UI. Without a key, the rule-based analysis runs on its own.

## Project structure

```text
frontend/   React 19 + Vite + React Router, plain CSS with design tokens
backend/    Node.js + Express 5 REST API, JSON-file persistence
```

## Requirements

- Node.js **22.9 or newer** (the backend uses `--env-file-if-exists`)
- npm

## Running locally

Backend (port 4000):

```bash
cd backend
npm install
cp .env.example .env      # optional; defaults work for local development
npm run dev
```

Frontend (port 5173):

```bash
cd frontend
npm install
cp .env.example .env      # optional; defaults to http://localhost:4000
npm run dev
```

Open http://localhost:5173. Use **Open the sample session** for a demonstration with clearly labelled simulated sources, or **Start Research** to analyse real pages.

### Production

```bash
cd backend && npm start                 # serves the API
cd frontend && npm run build            # static files in frontend/dist
```

Host `frontend/dist` on any static host with an SPA fallback to `index.html`. Serve both over HTTPS (configure this at your hosting platform or reverse proxy, not in the app).

## Environment variables

**backend/.env**

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Comma-separated origins allowed by CORS |
| `NODE_ENV` | `development` | Set `production` to enable HSTS |
| `TRUST_PROXY` | `0` | Number of proxies in front of the API (for correct rate-limit IPs) |
| `SESSION_RETENTION_DAYS` | `30` | Sessions untouched for this long are deleted |
| `GROQ_API_KEY` | empty | Enables the optional AI review layer |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Groq chat model that supports JSON mode |

**frontend/.env** (public values only; everything here ends up in the browser)

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Backend URL, default `http://localhost:4000` |
| `VITE_SITE_URL` | Deployed frontend URL. Enables canonical/OG URLs and `sitemap.xml` generation. Leave empty until known. |

## REST API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Status, engine version, whether AI is configured |
| POST | `/api/research` | Create a session `{ question, profile }` |
| POST | `/api/research/demo` | Create a sample session with simulated sources |
| GET / PATCH / DELETE | `/api/research/:id` | Read, edit question/type, or delete a session |
| POST | `/api/research/:id/sources` | Add `{ type: "url", url }` or `{ type: "text", title, text, originUrl? }` |
| GET / DELETE | `/api/research/:id/sources/:sourceId` | Full source text / remove |
| POST | `/api/research/:id/sources/:sourceId/retry` | Retry a failed retrieval |
| POST | `/api/research/:id/analyze` | Run the analysis |
| GET | `/api/research/:id/findings` | Latest analysis |
| GET / POST | `/api/research/:id/checklist` | Read checklist / add your own item |
| PATCH / DELETE | `/api/research/:id/checklist/:itemId` | Mark done `{ done }` / delete your own item |

Errors use `{ "error": { "code", "message", "fields?" } }` with appropriate status codes.

## Security and privacy notes

- No secrets in the frontend. The AI key exists only in `backend/.env`.
- SSRF protection: scheme, port (80/443), credentials and hostname checks, DNS-pinned connections that reject non-public IPs (IPv4 and IPv6, including mapped addresses), redirects re-validated.
- Helmet security headers, CORS allow-list, JSON body limit (200 KB), per-route rate limits, honeypot field on session creation.
- Untrusted page text is rendered as text (never as HTML) and passed to the AI only as delimited data.
- Sessions are protected only by their unguessable 128-bit link. There are no accounts.
- No cookies and no analytics. The browser keeps a local list of your sessions (`localStorage`).
- The privacy policy and terms pages are marked **DRAFT: REVIEW REQUIRED** for operator details and legal review.

## Tests

```bash
cd backend && npm test
```

The tests cover SSRF address and URL checks, date/money/age parsing, HTML extraction, and the full analysis on the sample session (renewal gap, deadline and amount conflicts, document-list difference, cycle-explained difference, stale and past-deadline warnings, checklist persistence across re-analysis, no fabricated findings on irrelevant text).

## Known limitations

- No web search integration. Users add sources themselves (no search API credentials were available).
- PDF files are not parsed; paste their text instead.
- Gap detection is keyword-based: information worded differently may be missed, which the UI states on every gap.
- JSON-file storage suits a single server instance. Use a database for multi-instance deployments.
- JavaScript-rendered pages may yield little text and are reported as not retrieved.

## Future scope

Permitted search API integration, PDF parsing, multilingual extraction (Hindi and regional languages), official-domain detection to rank authoritative sources, and accounts for private session history.
