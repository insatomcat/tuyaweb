import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field
from starlette.requests import Request

from app.tuya_cloud import TuyaCloudClient, TuyaCloudError


load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
app = FastAPI(title="Tuya Web Control")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
logger = logging.getLogger("uvicorn.error")


class CommandItem(BaseModel):
    code: str = Field(..., min_length=1)
    value: Any


class CommandRequest(BaseModel):
    commands: List[CommandItem]


def get_client() -> TuyaCloudClient:
    try:
        return TuyaCloudClient()
    except TuyaCloudError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def log_api_request(
    request: Request, *, endpoint: str, path_params: Dict[str, Any] | None = None, body: Any = None
) -> None:
    logger.info(
        "API request endpoint=%s method=%s path=%s query=%s path_params=%s body=%s",
        endpoint,
        request.method,
        request.url.path,
        dict(request.query_params),
        path_params or {},
        body,
    )


@app.get("/", response_class=HTMLResponse)
def index(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(request=request, name="index.html")


@app.get("/api/devices")
def list_devices(request: Request) -> Dict[str, Any]:
    log_api_request(request, endpoint="list_devices")
    client = get_client()
    try:
        return {"devices": client.list_devices()}
    except TuyaCloudError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/devices/{device_id}/capabilities")
def device_capabilities(device_id: str, request: Request) -> Dict[str, Any]:
    log_api_request(
        request,
        endpoint="device_capabilities",
        path_params={"device_id": device_id},
    )
    client = get_client()
    try:
        return client.get_device_capabilities(device_id)
    except TuyaCloudError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/devices/{device_id}/commands")
def send_device_commands(
    device_id: str, request_data: CommandRequest, request: Request
) -> Dict[str, Any]:
    client = get_client()
    try:
        payload = [item.model_dump() for item in request_data.commands]
        log_api_request(
            request,
            endpoint="send_device_commands",
            path_params={"device_id": device_id},
            body={"commands": payload},
        )
        return client.send_commands(device_id, payload)
    except TuyaCloudError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"JSON invalide: {exc}") from exc


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("APP_HOST", "127.0.0.1")
    port = int(os.getenv("APP_PORT", "8000"))
    uvicorn.run("app.main:app", host=host, port=port, reload=True)
