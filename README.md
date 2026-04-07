# conthExT

**The context layer for AI agents.**

Memory shouldn't live inside one tool — it should live outside, so every AI you use can read what you're working on. conthExT captures activity across LLM sessions, structures it into a knowledge graph of **events → entities → threads**, and serves citation-backed subgraphs that any agent can retrieve.

---

## What it does

conthExT watches conversation turns from tools like Claude, ChatGPT, YouTube, and Notion. Each turn is ingested, tokenized into entities, clustered into temporal threads, and written as connected Obsidian-compatible markdown notes in a local vault.

```
activity → event → entity → thread → subgraph → agent
```

| Concept | Description |
|---|---|
| **Event** | One atomic interaction turn (a question, a note, a query). Immutable once written. |
| **Entity** | A meaningful concept extracted from events (`jwt`, `react`, `pitch`). Accumulates context over time. |
| **Thread** | A cluster of related events — the primary retrieval unit. |
| **Subgraph** | A thread plus its events and entities. What an agent receives instead of raw history. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      website/  (Frontend)                   │
│  Landing page · Sandbox · Force-directed graph · Telemetry  │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP (CORS)
┌──────────────────────────▼──────────────────────────────────┐
│                   conthext/mcp_server.py                    │
│         FastAPI — 7 vault tools + /api/graph + UI           │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    conthext/pipeline.py                     │
│     Entity extraction · Jaccard clustering · vault writes   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      vault/  (Local data)                   │
│              entities/ · threads/ · daily/                  │
│         Obsidian markdown + YAML frontmatter + wikilinks    │
└─────────────────────────────────────────────────────────────┘
```

### Ingestion pipeline

1. **Extract entities** — tokenize text, filter stopwords, keep tokens ≥ 3 characters.
2. **Cluster into threads** — match against existing threads using Jaccard entity overlap (> 50%) or a 30-minute time window.
3. **Write thread notes** — append events, update entity wikilinks, bump frontmatter counters.
4. **Write entity notes** — link back to threads, store context snippets, connect co-occurring entities.

The vault is plain markdown. Open it in Obsidian, edit it by hand, or let the pipeline update it automatically.

---

## Project structure

```
conthExT/
├── conthext/                  # Python backend
│   ├── config.py              # Vault paths and entity stopwords
│   ├── vault_io.py            # Markdown + YAML frontmatter I/O, wikilink parsing
│   ├── pipeline.py            # Entity extraction and temporal thread clustering
│   ├── mcp_server.py          # FastAPI server — API tools + graph endpoint + UI
│   ├── seed.py                # Populates vault with 12 demo interaction events
│   └── requirements.txt       # fastapi, uvicorn, pyyaml
│
├── website/                   # Frontend dashboard
│   ├── index.html             # Landing page and interactive sandbox
│   ├── styles/main.css        # Dark-themed SaaS UI
│   ├── scripts/
│   │   ├── graph.js           # Force-directed knowledge graph (live API data)
│   │   ├── telemetry.js       # Sandbox terminal with vault search + thread fetch
│   │   ├── pipeline.js        # Animated pipeline diagram
│   │   └── main.js            # Navigation, scroll effects, UI polish
│   └── assets/logo.svg
│
└── vault/                     # Generated at runtime (gitignored)
    ├── entities/              # One note per concept
    ├── threads/               # Clustered conversation sessions
    └── daily/                 # Daily note slot
```

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/swarn007-byte/conthExT.git
cd conthExT

python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r conthext/requirements.txt
```

### 2. Seed the vault

Populates the local vault with 12 realistic events across 4 threads and ~57 entities:

```bash
python3 conthext/seed.py
```

### 3. Run the server

One command starts the API and serves the frontend:

```bash
uvicorn conthext.mcp_server:app --host 127.0.0.1 --port 8000 --reload
```

| URL | What it is |
|---|---|
| [http://127.0.0.1:8000](http://127.0.0.1:8000) | Interactive dashboard and sandbox |
| [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) | Swagger API documentation |
| [http://127.0.0.1:8000/api/graph](http://127.0.0.1:8000/api/graph) | Full vault graph as JSON |

---

## API reference

All vault traversal tools are `POST` endpoints with JSON bodies.

| Endpoint | Description | Example body |
|---|---|---|
| `POST /search_vault` | Keyword search across note titles and contents | `{"query": "JWT"}` |
| `POST /get_node` | Full note metadata and content by title | `{"note_title": "jwt"}` |
| `POST /get_connected_nodes` | All nodes linked via `[[wikilinks]]` | `{"note_title": "jwt"}` |
| `POST /get_thread` | Thread metadata and event log | `{"thread_title": "Jwt_Thread_2026-06-23_0900"}` |
| `POST /get_backlinks` | Notes that link to a given title | `{"note_title": "jwt"}` |
| `POST /list_threads` | All threads, sorted by last updated | `{"query": null}` |
| `POST /ingest_event` | Ingest a new turn through the pipeline | `{"source": "claude", "content": "How does JWT refresh work?"}` |
| `GET /api/graph` | Complete node/link graph for the frontend canvas | — |

### Ingest example

```bash
curl -X POST http://127.0.0.1:8000/ingest_event \
  -H "Content-Type: application/json" \
  -d '{"source": "claude", "content": "How does JWT refresh token work in a backend service"}'
```

Response:

```json
{
  "status": "success",
  "message": "Event successfully ingested",
  "report": {
    "event_ingested": "How does JWT refresh token work in a backend service",
    "source": "claude",
    "thread_id": "Jwt_Thread_2026-06-23_0900",
    "is_new_thread": false,
    "entities_extracted": ["jwt", "refresh", "token", "work", "backend", "service"]
  }
}
```

---

## Vault note format

### Thread note (`vault/threads/`)

```markdown
---
type: thread
tags: [claude]
created: 2026-06-23T09:00:00+00:00
updated: 2026-06-23T09:18:00+00:00
event_count: 3
source_llm: claude
---

# Jwt Thread 2026-06-23 0900

## Summary
Context thread created during claude interaction.

## Events
- [youtube · 2026-06-23T09:00:00] JWT authentication overview: access token and refresh mechanism
- [claude · 2026-06-23T09:08:00] How does JWT refresh token work in a backend service

## Entities
[[jwt]] [[refresh]] [[token]] [[backend]]
```

### Entity note (`vault/entities/`)

```markdown
---
type: entity
tags: [claude]
created: 2026-06-23
last_seen: 2026-06-23
mention_count: 3
---

# Jwt

## Threads
- [[Jwt Thread 2026-06-23 0900]]

## Context Snippets
- "JWT authentication overview: access token and refresh mechanism" — from youtube session 2026-06-23

## Connected Entities
[[refresh]] [[token]] [[backend]]
```

---

## Frontend

The dashboard includes:

- **Sandbox** — preset queries with a live telemetry terminal; vault search and thread retrieval hit the real API.
- **Knowledge graph** — force-directed canvas loaded from `GET /api/graph`; click nodes for detail overlays.
- **Pipeline diagram** — animated SVG showing the ingestion flow.
- **Feature sections** — comparison table, FAQ, and product overview.

CORS is enabled on the backend so the browser can call the API directly during local development.

---

## Configuration

Vault location defaults to `./vault/` at the repo root. Override with an environment variable:

```bash
export CONTHEXT_VAULT_PATH=/path/to/your/vault
```

Entity stopwords and path constants live in `conthext/config.py`.

---

## Tech stack

| Layer | Stack |
|---|---|
| Backend | Python 3.11+, FastAPI, Uvicorn, PyYAML |
| Frontend | Vanilla HTML/CSS/JS, Canvas force simulation |
| Storage | Local Obsidian-compatible markdown vault |
| API | REST (MCP-compatible tool surface) |

---

## License

MIT
