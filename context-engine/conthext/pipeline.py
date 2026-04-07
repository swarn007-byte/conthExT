import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from conthext.config import STOPWORDS
from conthext.vault_io import (
    parse_note, write_note, title_to_path, format_wikilink,
    extract_wikilinks, read_all_note_paths, clean_title
)


def extract_entities(text: str) -> List[str]:
    """Tokenizes text, filters out stopwords, and extracts unique entities (length >= 3)."""
    tokens = re.findall(r"[a-zA-Z0-9]+", text.lower())
    entities = []
    for token in tokens:
        if len(token) < 3:
            continue
        if token in STOPWORDS:
            continue
        entities.append(token)
    return list(dict.fromkeys(entities))


def parse_iso_datetime(dt_str: str) -> datetime:
    """Safely parses ISO timestamp strings to datetime objects."""
    try:
        cleaned = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(cleaned)
    except Exception:
        return datetime.utcnow()


def load_existing_threads() -> List[Dict[str, Any]]:
    """Scans all thread markdown notes in the vault and builds a list of metadata for clustering."""
    thread_paths = read_all_note_paths("thread")
    threads = []

    for path in thread_paths:
        metadata, content = parse_note(path)
        if metadata.get("type") != "thread":
            continue

        title = path.stem
        entities = extract_wikilinks(content)
        updated_str = metadata.get("updated", "")
        updated_at = parse_iso_datetime(updated_str)

        threads.append({
            "id": title,
            "title": title.replace("_", " "),
            "entities": entities,
            "updated_at": updated_at,
            "path": path,
            "metadata": metadata,
        })

    return threads


def choose_thread(
    entities: List[str],
    timestamp: datetime,
    existing_threads: List[Dict[str, Any]],
) -> Optional[str]:
    """Determines if a list of entities belongs in an existing thread or requires a new one."""
    entity_set = set(clean_title(e).lower() for e in entities)
    if not entity_set:
        return None

    for thread in existing_threads:
        thread_entities = set(clean_title(e).lower() for e in thread["entities"])
        overlap = len(entity_set & thread_entities)
        total = len(entity_set | thread_entities)
        jaccard = overlap / total if total > 0 else 0
        time_diff_minutes = abs((timestamp - thread["updated_at"]).total_seconds()) / 60.0

        if jaccard > 0.5 or time_diff_minutes <= 30.0:
            return thread["id"]

    return None


def ingest_event_to_vault(
    source: str,
    content: str,
    timestamp_str: Optional[str] = None,
) -> Dict[str, Any]:
    """Ingestion pipeline step. Processes event, clusters it, and writes notes to the Obsidian vault."""
    if not timestamp_str:
        timestamp_str = datetime.utcnow().isoformat() + "+00:00"

    timestamp = parse_iso_datetime(timestamp_str)
    entities = extract_entities(content)
    existing_threads = load_existing_threads()
    thread_id = choose_thread(entities, timestamp, existing_threads)
    is_new_thread = False

    if thread_id:
        thread_path = title_to_path(thread_id, "thread")
        metadata, md_content = parse_note(thread_path)
        metadata["updated"] = timestamp_str
        metadata["event_count"] = metadata.get("event_count", 0) + 1

        event_line = f"- [{source} · {timestamp_str.split('+')[0]}] {content}\n"
        lines = md_content.split("\n")
        events_start = -1
        entities_start = -1

        for idx, line in enumerate(lines):
            if "## Events" in line:
                events_start = idx
            elif "## Entities" in line or "## Concepts" in line:
                entities_start = idx

        if events_start != -1:
            insert_idx = entities_start if entities_start != -1 else len(lines)
            while insert_idx > events_start and not lines[insert_idx - 1].strip().startswith("- ["):
                insert_idx -= 1
            if insert_idx <= events_start:
                insert_idx = events_start + 1
            lines.insert(insert_idx, event_line.strip())
        else:
            lines.append("\n## Events")
            lines.append(event_line.strip())

        entities_start = -1
        for idx, line in enumerate(lines):
            if "## Entities" in line or "## Concepts" in line:
                entities_start = idx
                break

        if entities_start != -1:
            entity_line_idx = entities_start + 1
            while entity_line_idx < len(lines) and lines[entity_line_idx].strip() == "":
                entity_line_idx += 1

            existing_wikilinks = extract_wikilinks("\n".join(lines[entities_start:]))
            new_links = []
            for ent in entities:
                ent_clean = clean_title(ent)
                if ent_clean.lower() not in [clean_title(w).lower() for w in existing_wikilinks]:
                    new_links.append(format_wikilink(ent))

            if new_links:
                if entity_line_idx < len(lines) and lines[entity_line_idx].startswith("[["):
                    lines[entity_line_idx] = lines[entity_line_idx].strip() + " " + " ".join(new_links)
                else:
                    lines.insert(entities_start + 1, " ".join(new_links))
        else:
            lines.append("\n## Concepts")
            lines.append(" ".join(format_wikilink(ent) for ent in entities))

        md_content = "\n".join(lines)
        write_note(thread_path, metadata, md_content)

    else:
        is_new_thread = True
        primary_entity = clean_title(entities[0].title()) if entities else "General"
        time_suffix = timestamp.strftime("%Y-%m-%d_%H%M")
        thread_id = f"{primary_entity}_Thread_{time_suffix}"
        thread_path = title_to_path(thread_id, "thread")

        metadata = {
            "type": "thread",
            "tags": [source.lower()],
            "created": timestamp_str,
            "updated": timestamp_str,
            "event_count": 1,
            "source_llm": source.lower(),
        }

        event_line = f"- [{source} · {timestamp_str.split('+')[0]}] {content}"
        wikilinks_line = " ".join(format_wikilink(ent) for ent in entities)

        md_content = f"""# {thread_id.replace('_', ' ')}

## Summary
Context thread created during {source} interaction.

## Events
{event_line}

## Concepts
{wikilinks_line}
"""
        write_note(thread_path, metadata, md_content)

    for ent in entities:
        ent_clean = clean_title(ent)
        entity_path = title_to_path(ent_clean, "concept")
        display_title = ent.title() if len(ent) > 3 else ent.upper()

        if entity_path.exists():
            ent_metadata, ent_md = parse_note(entity_path)
            ent_metadata["last_seen"] = timestamp_str.split("T")[0]
            ent_metadata["mention_count"] = ent_metadata.get("mention_count", 0) + 1

            lines = ent_md.split("\n")
            threads_start = -1
            context_start = -1

            for idx, line in enumerate(lines):
                if "## Threads" in line:
                    threads_start = idx
                elif "## Context Snippets" in line:
                    context_start = idx

            if threads_start != -1:
                end_idx = context_start if context_start != -1 else len(lines)
                threads_sec = "\n".join(lines[threads_start:end_idx])
                existing_thread_wikis = extract_wikilinks(threads_sec)

                if clean_title(thread_id).lower() not in [clean_title(t).lower() for t in existing_thread_wikis]:
                    insert_idx = threads_start + 1
                    while insert_idx < len(lines) and lines[insert_idx].strip() == "":
                        insert_idx += 1
                    lines.insert(insert_idx, f"- {format_wikilink(thread_id)}")
            else:
                lines.insert(0, f"## Threads\n- {format_wikilink(thread_id)}\n")

            snippet_line = f'- "{content}" — from {source} session {timestamp_str.split("T")[0]}'
            context_start = -1
            for idx, line in enumerate(lines):
                if "## Context Snippets" in line:
                    context_start = idx
                    break

            if context_start != -1:
                insert_idx = context_start + 1
                while insert_idx < len(lines) and lines[insert_idx].strip() == "":
                    insert_idx += 1
                lines.insert(insert_idx, snippet_line)
            else:
                lines.append(f"\n## Context Snippets\n{snippet_line}")

            connected_start = -1
            for idx, line in enumerate(lines):
                if "## Connected Entities" in line or "## Connected Concepts" in line:
                    connected_start = idx
                    break

            other_entities = [e for e in entities if clean_title(e).lower() != ent_clean.lower()]
            if other_entities:
                if connected_start != -1:
                    conn_sec = "\n".join(lines[connected_start:])
                    existing_conn_wikis = extract_wikilinks(conn_sec)
                    new_conn = []
                    for oe in other_entities:
                        if clean_title(oe).lower() not in [clean_title(c).lower() for c in existing_conn_wikis]:
                            new_conn.append(format_wikilink(oe))

                    if new_conn:
                        conn_line_idx = connected_start + 1
                        if conn_line_idx < len(lines) and lines[conn_line_idx].startswith("[["):
                            lines[conn_line_idx] = lines[conn_line_idx].strip() + " " + " ".join(new_conn)
                        else:
                            lines.insert(connected_start + 1, " ".join(new_conn))
                else:
                    lines.append("\n## Connected Concepts")
                    lines.append(" ".join(format_wikilink(oe) for oe in other_entities))

            ent_md = "\n".join(lines)
            write_note(entity_path, ent_metadata, ent_md)

        else:
            ent_metadata = {
                "type": "concept",
                "tags": [source.lower()],
                "created": timestamp_str.split("T")[0],
                "last_seen": timestamp_str.split("T")[0],
                "mention_count": 1,
            }

            other_entities = [e for e in entities if clean_title(e).lower() != ent_clean.lower()]
            conn_line = " ".join(format_wikilink(oe) for oe in other_entities)

            ent_md = f"""# {display_title}

## Threads
- {format_wikilink(thread_id)}

## Context Snippets
- "{content}" — from {source} session {timestamp_str.split('T')[0]}

## Connected Concepts
{conn_line}
"""
            write_note(entity_path, ent_metadata, ent_md)

    return {
        "event_ingested": content,
        "source": source,
        "timestamp": timestamp_str,
        "thread_id": thread_id,
        "is_new_thread": is_new_thread,
        "entities_extracted": entities,
    }
