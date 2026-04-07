import re
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from conthext.vault_io import (
    parse_note, title_to_path, extract_wikilinks, read_all_note_paths, clean_title
)
from conthext.pipeline import ingest_event_to_vault, extract_entities

app = FastAPI(
    title="conthExT — Perceptron Context Engine",
    description="Tool-agnostic knowledge graph pipeline and vault retrieval API.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    query: str


class NodeRequest(BaseModel):
    note_title: str


class ConnectedRequest(BaseModel):
    note_title: str


class ThreadRequest(BaseModel):
    thread_title: str


class BacklinkRequest(BaseModel):
    note_title: str


class ListThreadsRequest(BaseModel):
    query: Optional[str] = None


class IngestRequest(BaseModel):
    source: str
    content: str
    timestamp: Optional[str] = None


@app.post("/search_vault")
def search_vault(req: SearchRequest):
    """Searches note titles and file contents for query overlaps."""
    query_tokens = extract_entities(req.query)
    if not query_tokens:
        query_tokens = [t.lower() for t in re.findall(r"\w+", req.query) if len(t) > 2]

    all_paths = read_all_note_paths()
    matches = []

    for path in all_paths:
        title = path.stem
        metadata, content = parse_note(path)
        score = 0
        content_lower = content.lower()
        title_lower = title.lower().replace("_", " ")

        for token in query_tokens:
            if token in title_lower:
                score += 3
            score += content_lower.count(token)

        if score > 0:
            snippet = content.strip().replace("\n", " ")
            snippet = snippet[:120] + "..." if len(snippet) > 120 else snippet
            matches.append({
                "title": title.replace("_", " "),
                "path": str(path.relative_to(path.parents[1])),
                "relevance_score": score,
                "snippet": snippet,
            })

    matches.sort(key=lambda m: m["relevance_score"], reverse=True)
    return matches[:5]


@app.post("/get_node")
def get_node(req: NodeRequest):
    """Reads and returns the raw contents of a concept or thread note."""
    cleaned = clean_title(req.note_title)
    path = title_to_path(cleaned, "concept")

    if not path.exists():
        path = title_to_path(cleaned, "thread")

    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Note '{req.note_title}' not found in vault.")

    metadata, content = parse_note(path)
    raw_markdown = path.read_text(encoding="utf-8")

    return {
        "title": cleaned.replace("_", " "),
        "metadata": metadata,
        "content": content.strip(),
        "raw_markdown": raw_markdown,
    }


@app.post("/get_connected_nodes")
def get_connected_nodes(req: ConnectedRequest):
    """Parses a note and extracts all target titles linked via [[wikilinks]]."""
    cleaned = clean_title(req.note_title)
    path = title_to_path(cleaned, "concept")

    if not path.exists():
        path = title_to_path(cleaned, "thread")

    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Note '{req.note_title}' not found in vault.")

    metadata, content = parse_note(path)
    links = extract_wikilinks(content)

    return {
        "note_title": req.note_title,
        "links": [link.replace("_", " ") for link in links],
    }


@app.post("/get_thread")
def get_thread(req: ThreadRequest):
    """Reads and returns the raw contents of a thread note."""
    cleaned = clean_title(req.thread_title)
    path = title_to_path(cleaned, "thread")

    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Thread note '{req.thread_title}' not found in vault.")

    metadata, content = parse_note(path)
    raw_markdown = path.read_text(encoding="utf-8")

    return {
        "title": cleaned.replace("_", " "),
        "metadata": metadata,
        "content": content.strip(),
        "raw_markdown": raw_markdown,
    }


@app.post("/get_backlinks")
def get_backlinks(req: BacklinkRequest):
    """Scans all vault notes to find files that link to this note."""
    cleaned_target = clean_title(req.note_title).lower()
    all_paths = read_all_note_paths()
    backlinks = []

    for path in all_paths:
        title = path.stem
        if title.lower() == cleaned_target:
            continue

        metadata, content = parse_note(path)
        linked_titles = extract_wikilinks(content)

        for link in linked_titles:
            if clean_title(link).lower() == cleaned_target:
                backlinks.append(title.replace("_", " "))
                break

    return {
        "note_title": req.note_title,
        "backlinks": backlinks,
    }


@app.post("/list_threads")
def list_threads(req: Optional[ListThreadsRequest] = None):
    """Lists all threads with metadata, sorted by updated desc."""
    query = req.query if req else None
    thread_paths = read_all_note_paths("thread")
    threads = []

    for path in thread_paths:
        title = path.stem
        metadata, content = parse_note(path)

        if metadata.get("type") != "thread":
            continue

        if query:
            q_lower = query.lower()
            if q_lower not in title.lower().replace("_", " ") and q_lower not in content.lower():
                continue

        threads.append({
            "title": title.replace("_", " "),
            "event_count": metadata.get("event_count", 0),
            "created": metadata.get("created", ""),
            "updated": metadata.get("updated", ""),
            "source_llm": metadata.get("source_llm", ""),
        })

    threads.sort(key=lambda t: t["updated"], reverse=True)
    return threads


@app.post("/ingest_event")
def ingest_event(req: IngestRequest):
    """Ingests a new conversation turn through the Perceptron pipeline."""
    try:
        report = ingest_event_to_vault(
            source=req.source,
            content=req.content,
            timestamp_str=req.timestamp,
        )
        return {
            "status": "success",
            "message": "Event successfully ingested",
            "report": report,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@app.get("/api/graph")
def get_graph():
    """Returns the complete network graph representing threads, events, and concepts."""
    nodes: List[Dict[str, Any]] = []
    links: List[Dict[str, Any]] = []

    concept_paths = read_all_note_paths("concept")
    concept_ids = set()

    for path in concept_paths:
        concept_id = path.stem
        concept_ids.add(concept_id.lower())
        metadata, content = parse_note(path)

        snippets = []
        for line in content.split("\n"):
            if line.strip().startswith("-"):
                snippets.append(line.strip().replace("-", "").strip(' "'))
        desc = snippets[0] if snippets else f"Concept matching keyword {concept_id}"

        nodes.append({
            "id": concept_id,
            "label": concept_id.replace("_", " "),
            "kind": "entity",
            "desc": desc,
            "size": 13,
        })

    thread_paths = read_all_note_paths("thread")
    for path in thread_paths:
        thread_id = path.stem
        metadata, content = parse_note(path)

        nodes.append({
            "id": thread_id,
            "label": thread_id.replace("_", " "),
            "kind": "thread",
            "desc": f"Context thread with {metadata.get('event_count', 0)} events.",
            "source": metadata.get("source_llm", "claude"),
            "size": 22,
        })

        events_section = []
        in_events = False
        for line in content.split("\n"):
            if "## Events" in line:
                in_events = True
                continue
            if "## Entities" in line or "## Concepts" in line or line.startswith("#"):
                in_events = False

            if in_events and line.strip().startswith("- ["):
                events_section.append(line.strip())

        for idx, event_line in enumerate(events_section):
            match = re.match(r"^-\s*\[(.*?)\s*·\s*(.*?)\]\s*(.*)$", event_line)
            if match:
                source, timestamp, event_content = match.groups()
                source = source.strip().lower()
                timestamp = timestamp.strip()
                event_content = event_content.strip()
            else:
                source = "unknown"
                timestamp = ""
                event_content = event_line.replace("-", "").strip()

            event_node_id = f"ev_{thread_id}_{idx}"
            label = event_content[:27] + "..." if len(event_content) > 30 else event_content

            nodes.append({
                "id": event_node_id,
                "label": label,
                "kind": "event",
                "source": source,
                "time": timestamp,
                "desc": event_content,
                "size": 9,
            })

            links.append({
                "source": thread_id,
                "target": event_node_id,
                "kind": "thread_event",
            })

            event_entities = extract_entities(event_content)
            for ent in event_entities:
                ent_clean = clean_title(ent).lower()
                if ent_clean in concept_ids:
                    target_ent_id = next((n["id"] for n in nodes if n["id"].lower() == ent_clean), None)
                    if target_ent_id:
                        links.append({
                            "source": event_node_id,
                            "target": target_ent_id,
                            "kind": "event_entity",
                        })

    return {"nodes": nodes, "links": links}


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
