import os
from pathlib import Path

# 1. Locate the Root of the Backend Repository
# This finds the absolute path to the directory containing this config file
CURRENT_FILE_DIR = Path(__file__).resolve().parent

# 2. Define the Target Obsidian Vault Directory
# We default to the 'my-knowledge-vault' folder sitting in your project root
DEFAULT_VAULT_NAME = "my-knowledge-vault"
PROJECT_ROOT = CURRENT_FILE_DIR.parent.parent

# Resolve the absolute path to your active Obsidian space
WORKSPACE_DIR = os.getenv(
    "CONTHEXT_VAULT_PATH", 
    str(PROJECT_ROOT / DEFAULT_VAULT_NAME)
)

# 3. Explicitly Define Subfolder Locations for the Pipeline
THREADS_DIR = Path(WORKSPACE_DIR) / "Threads"
CONCEPTS_DIR = Path(WORKSPACE_DIR) / "Concepts"

# 4. Safety Validation Check
# This ensures the pipeline doesn't crash silently if folders are missing
def initialize_vault_directories():
    """Creates the core database folders inside the vault if they don't exist."""
    THREADS_DIR.mkdir(parents=True, exist_ok=True)
    CONCEPTS_DIR.mkdir(parents=True, exist_ok=True)