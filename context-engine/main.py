# phase 1-- module importing

import os
from fastapi import FastAPI, BackgroundTasks, status, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from conthext.pipeline import ingest_event_to_vault  
# it is background processor from pipeline.py

# phase 2 cors configuration, server initialisation

app=FastAPI(
    title="perceptron Engine",
    description="She is GodEye",
    version="1"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_header=["*"],
    allow_methods=["*"],
    allow_credentials=True
)

#phase 3 pydantic data models --tells about how incoming data structure should be

class contextpayload(BaseModel):
    session_id: str = Field(..., description="unique indentifier")
    speaker: str = Field(..., description="user or agent")
    content: str = Field(..., description="the raw markdown")
    timestamp: Optional[str] = Field(None, description="Optional ISO timestamp string")
  
#phase 4 - api endpoints and router setup
@app.get("/")
async def health(): # checks perception is alive 
      return {
        "status": "active",
        "engine": "conthExT Perceptron",
        "mode": "asynchronous_ingestion"
    }

@app.post("/api/v1/context/capture")
async def capture_context(payload:contextpayload ,background_tasks:BackgroundTasks):
    try:
        BackgroundTasks.add_tasks(
            ingest_event_to_vault,
            source=payload.speaker,
            content=payload.content,
            timestamp_str=payload.timestamp
        )
        return {
            "status":"queued",
            "session_id":payload.session_id,
            "message":"payload send to obsidion"
        }
    except exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue context payload: {str(e)}"
        )
    








