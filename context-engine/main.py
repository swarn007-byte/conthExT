# phase 1 -- module importing
import os
from fastapi import FastAPI, BackgroundTasks, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from conthext.pipeline import ingest_event_to_vault  
# it is the background processor from pipeline.py

# phase 2 -- cors configuration, server initialisation
app = FastAPI(
    title="perceptron Engine",
    description="She is GodEye",
    version="1"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_headers=["*"],          # FIXED: Changed from allow_header to allow_headers
    allow_methods=["*"],
    allow_credentials=True
)

# phase 3 -- pydantic data models
class ContextPayload(BaseModel):  # Standard Python styling capitalization
    session_id: str = Field(..., description="unique identifier")
    speaker: str = Field(..., description="user or agent")
    content: str = Field(..., description="the raw markdown")
    timestamp: Optional[str] = Field(None, description="Optional ISO timestamp string")
  
# phase 4 -- api endpoints and router setup
@app.get("/")
async def health(): # checks perception is alive 
    return {
        "status": "active",
        "engine": "conthExT Perceptron",
        "mode": "asynchronous_ingestion"
    }

@app.post("/api/v1/context/capture")
async def capture_context(payload: ContextPayload, background_tasks: BackgroundTasks):
    try:
        # FIXED: Used instance variable, switched to singular .add_task, and added session_id
        background_tasks.add_task(
            ingest_event_to_vault,
            session_id=payload.session_id,
            source=payload.speaker,
            content=payload.content,
            timestamp_str=payload.timestamp
        )
        return {
            "status": "queued",
            "session_id": payload.session_id,
            "message": "payload sent to obsidian"
        }
    except Exception as e:        # FIXED: Capitalized Exception
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue context payload: {str(e)}"
        )