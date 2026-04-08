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

class dataModels(BaseModel):
    session_id: str = Field(..., description="unique indentifier")
    speaker: str = Field(..., description="user or agent")
    content: str = Field(..., description="the raw markdown")
    timestamp: Optional[str] = Field(None, description="Optional ISO timestamp string")
  




