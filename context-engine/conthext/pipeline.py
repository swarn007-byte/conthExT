#suppose pipeline is the processing factory -- it process raw data and format it as per schema and add it to conveyor belt that goes to vault_io

from conthext.vault_io import append_to_thread_file , write_concept_file

def processing(data: str ,speaker:str,session_id:str,concept_name: str = None):
    cleaned_data=payload.strip()

    if(concept_name):
        structured_concept = (
            f"# Concept: {concept_name}\n"
            f"**Captured During Session:** {session_id}\n\n"
            f"## Core Explanation & Code\n"
            f"{cleaned_content}\n"
        )
        return write_concept_file(concept_name, structured_concept)
    else:
        # Send it straight to the thread logger
        return append_to_thread_file(session_id, speaker, cleaned_content)