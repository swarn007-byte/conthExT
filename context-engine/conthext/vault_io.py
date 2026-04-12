import os
from pathlib import Path
from datetime import datetime
from conthext.config import THREADS_DIR, CONCEPTS_DIR


def append_to_thread_file(session_id: str, speaker: str, content: str) -> Path:
    file_path = THREADS_DIR / f"{session_id}.md"
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    formatted_entry = (
        f"\n### ─── {speaker.upper()} · {timestamp} ───\n"
        f"{content.strip()}\n"
        f"────────────────────────────────────────\n"
    )
    
    file_exists = file_path.exists()
    
    with open(file_path, mode="a", encoding="utf-8") as f:
        if not file_exists:
            f.write(f"---\ntype: stream_log\nsession_id: {session_id}\n---\n")
            f.write(f"# Project Thread: {session_id}\n\n")
        f.write(formatted_entry)
        
    return file_path

def write_concept_file(concept_name: str, content: str) -> Path:
    safe_filename = concept_name.strip().replace(" ", "_").lower()
    file_path = CONCEPTS_DIR / f"{safe_filename}.md"
    
    with open(file_path, mode="w", encoding="utf-8") as f:
        f.write(content)
        
    return file_path


