import re
import yaml
from pathlib import Path
from typing import Dict, List, Tuple, Any
from conthext.config import VAULT_PATH, CONCEPTS_PATH, THREADS_PATH

CONCEPTS_PATH.mkdir(parents=True, exist_ok=True)
THREADS_PATH.mkdir(parents=True, exist_ok=True)


def clean_title(title: str) -> str:
    """Standardizes titles to be used as note keys (e.g. replace spaces with underscores)."""
    return title.strip().replace(" ", "_")


def title_to_path(title: str, kind: str) -> Path:
    """Gets absolute Path for a note based on kind (entity/concept or thread)."""
    cleaned = clean_title(title)
    if kind in ("entity", "concept"):
        return CONCEPTS_PATH / f"{cleaned}.md"
    if kind == "thread":
        return THREADS_PATH / f"{cleaned}.md"
    return VAULT_PATH / f"{cleaned}.md"


def parse_note(path: Path) -> Tuple[Dict[str, Any], str]:
    """Reads a markdown note and splits it into frontmatter metadata and markdown content."""
    if not path.exists():
        return {}, ""

    content = path.read_text(encoding="utf-8")
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", content, re.DOTALL)
    if match:
        yaml_text, markdown_content = match.groups()
        try:
            metadata = yaml.safe_load(yaml_text) or {}
        except Exception:
            metadata = {}
        return metadata, markdown_content

    return {}, content


def write_note(path: Path, metadata: Dict[str, Any], markdown_content: str) -> None:
    """Serializes metadata to YAML frontmatter and writes it with content to the file."""
    yaml_text = yaml.safe_dump(metadata, sort_keys=False, default_flow_style=False)
    content = f"---\n{yaml_text.strip()}\n---\n\n{markdown_content.strip()}\n"
    path.write_text(content, encoding="utf-8")


def extract_wikilinks(text: str) -> List[str]:
    """Extracts all target names enclosed in Obsidian [[wikilinks]] from text."""
    links = re.findall(r"\[\[(.*?)\]\]", text)
    return list(dict.fromkeys([link.strip() for link in links]))


def format_wikilink(title: str) -> str:
    """Formats a title as an Obsidian wikilink."""
    return f"[[{title.replace('_', ' ')}]]"


def read_all_note_paths(kind: str = None) -> List[Path]:
    """Returns paths to all markdown notes in the vault or sub-folders."""
    if kind in ("entity", "concept"):
        return list(CONCEPTS_PATH.glob("*.md"))
    if kind == "thread":
        return list(THREADS_PATH.glob("*.md"))
    return list(VAULT_PATH.rglob("*.md"))
