from fastapi import FastAPI, Request
from fastapi.responses import PlainTextResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
import mimetypes
import os

# Ensure correct MIME types for 3D/webp assets
mimetypes.add_type("model/gltf-binary", ".glb")
mimetypes.add_type("model/gltf+json", ".gltf")
mimetypes.add_type("model/vnd.usdz+zip", ".usdz")
mimetypes.add_type("image/webp", ".webp")

app = FastAPI()

# Serve / -> ./public (index.html, assets)
app.mount("/", StaticFiles(directory="public", html=True), name="static")

# Health
@app.get("/healthz", response_class=PlainTextResponse)
def health():
    return "ok"

# Cache + range headers for large binaries
class StaticHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        resp = await call_next(request)
        path = request.url.path.lower()

        # Basic caching policy
        if path.endswith((".glb", ".usdz", ".webp")):
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            resp.headers["Accept-Ranges"] = "bytes"
        elif path.endswith(".html") or path == "/":
            resp.headers["Cache-Control"] = "no-cache"
        return resp

app.add_middleware(StaticHeadersMiddleware)
