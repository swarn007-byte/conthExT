import os
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = ENGINE_DIR.parent

VAULT_PATH = Path(os.getenv("CONTHEXT_VAULT_PATH", WORKSPACE_DIR / "my-knowledge-vault"))
CONCEPTS_PATH = VAULT_PATH / "Concepts"
THREADS_PATH = VAULT_PATH / "Threads"

# Backward-compatible alias used by pipeline helpers
ENTITIES_PATH = CONCEPTS_PATH

STOPWORDS = {
    "the", "and", "for", "from", "with", "into", "this", "that",
    "is", "are", "was", "were", "have", "has", "what", "how",
    "why", "when", "where", "who", "not", "but", "can", "will",
    "watched", "asked", "queried", "video", "query", "claude",
    "gemini", "codex", "chatgpt", "youtube", "github", "notion",
    "our", "you", "your", "its", "their", "about", "did", "does",
    "done", "doing", "been", "being", "should", "would", "could",
}
