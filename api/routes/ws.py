"""
WebSocket endpoints for real-time streaming.
"""

import asyncio
import subprocess
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from core.context import context
from core.collectors.pods import collect_pods
from core.collectors.events import collect_events

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/logs/{pod}")
async def ws_logs(websocket: WebSocket, pod: str):
    """Stream live logs from a pod."""
    await websocket.accept()

    cmd = (
        f"kubectl --context {context.current_context} "
        f"logs {pod} -n {context.namespace} --follow --tail=20"
    )

    process = subprocess.Popen(
        cmd, shell=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )

    try:
        loop = asyncio.get_event_loop()
        while True:
            line = await loop.run_in_executor(None, process.stdout.readline)
            if not line:
                break
            await websocket.send_text(line.rstrip())
    except WebSocketDisconnect:
        pass
    finally:
        process.kill()


@router.websocket("/ws/pods")
async def ws_pods(websocket: WebSocket):
    """Stream pod status updates every 3 seconds."""
    await websocket.accept()

    try:
        while True:
            pods = await asyncio.get_event_loop().run_in_executor(None, collect_pods)
            await websocket.send_text(json.dumps(pods))
            await asyncio.sleep(3)
    except WebSocketDisconnect:
        pass


@router.websocket("/ws/events")
async def ws_events(websocket: WebSocket):
    """Stream events updates every 5 seconds."""
    await websocket.accept()

    try:
        while True:
            events = await asyncio.get_event_loop().run_in_executor(None, collect_events)
            await websocket.send_text(json.dumps(events))
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        pass


@router.websocket("/ws/shell/{pod}")
async def ws_shell(websocket: WebSocket, pod: str):
    """Interactive shell into a pod via WebSocket."""
    await websocket.accept()

    cmd = (
        f"kubectl --context {context.current_context} "
        f"exec -i {pod} -n {context.namespace} -- "
        f"/bin/sh -c 'command -v bash >/dev/null && exec bash || exec sh'"
    )

    process = subprocess.Popen(
        cmd, shell=True,
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True,
    )

    loop = asyncio.get_event_loop()

    async def read_output():
        try:
            while True:
                line = await loop.run_in_executor(None, process.stdout.readline)
                if not line:
                    break
                await websocket.send_text(line)
        except (WebSocketDisconnect, Exception):
            pass

    output_task = asyncio.create_task(read_output())

    try:
        while True:
            data = await websocket.receive_text()
            process.stdin.write(data + "\n")
            process.stdin.flush()
    except WebSocketDisconnect:
        pass
    finally:
        output_task.cancel()
        process.kill()
