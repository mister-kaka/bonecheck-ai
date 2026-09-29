"""Долгоживущий HTTP-инференс для BoneCheck.

Модели загружаются один раз в main(), до приёма запросов.
Каждый запрос принимает DICOM как multipart, вызывает site_prediction
и затем save_heatmap_png во временном каталоге процесса.
Пакетный process_directory и visualize_dicom здесь не используются.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import shutil
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

logger = logging.getLogger("bonecheck.ml")

# 50 МиБ - потолок DICOM в API. 64 КиБ остаются на boundary и заголовки multipart.
MAX_BODY_BYTES = 50 * 1024 * 1024 + 64 * 1024
RESULT_KEYS = ("quality_class", "violation_type", "anatomical_region")
SUBMISSION_TEXT_KEYS = ("study_uid", "image_uid", "processing_status")
_BOUNDARY_RE = re.compile(
    r"""boundary\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s]+))""",
    re.IGNORECASE,
)


def _public_result(result: dict) -> dict:
    body = {
        "quality_class": int(result["quality_class"]),
        "violation_type": str(result["violation_type"]),
        "anatomical_region": str(result["anatomical_region"]),
    }
    for key in SUBMISSION_TEXT_KEYS:
        if key in result and result[key] is not None:
            body[key] = str(result[key])
    elapsed = result.get("time_of_processing")
    if isinstance(elapsed, (int, float)) and not isinstance(elapsed, bool):
        body["time_of_processing"] = float(elapsed)
    return body


def _content_length(raw_length: str, max_bytes: int = MAX_BODY_BYTES) -> int:
    try:
        length = int(raw_length)
    except ValueError as exc:
        raise ValueError("invalid Content-Length") from exc
    if length <= 0 or length > max_bytes:
        raise ValueError("invalid body")
    return length


def _boundary(content_type: str) -> str:
    media = content_type.split(";", 1)[0].strip().lower()
    if media != "multipart/form-data":
        raise ValueError("multipart file is required")
    match = _BOUNDARY_RE.search(content_type)
    if not match:
        raise ValueError("invalid multipart body")
    boundary = next(group for group in match.groups() if group)
    if not boundary or "\r" in boundary or "\n" in boundary:
        raise ValueError("invalid multipart body")
    try:
        boundary.encode("ascii")
    except UnicodeEncodeError as exc:
        raise ValueError("invalid multipart body") from exc
    return boundary


def _disposition_name(header_blob: str) -> str | None:
    for line in header_blob.split("\r\n"):
        name, separator, value = line.partition(":")
        if not separator or name.strip().lower() != "content-disposition":
            continue
        for piece in value.split(";"):
            key, eq, field = piece.strip().partition("=")
            if not eq or key.lower() != "name":
                continue
            field = field.strip()
            if len(field) >= 2 and field[0] == field[-1] and field[0] in "\"'":
                field = field[1:-1]
            return field
    return None


def _extract_file(body: bytes, boundary: str) -> bytes:
    marker = b"--" + boundary.encode("ascii")
    for chunk in body.split(marker)[1:]:
        if chunk.startswith(b"--"):
            continue
        if chunk.startswith(b"\r\n"):
            chunk = chunk[2:]
        header_end = chunk.find(b"\r\n\r\n")
        if header_end < 0:
            continue
        header_blob = chunk[:header_end].decode("iso-8859-1", errors="replace")
        if _disposition_name(header_blob) != "file":
            continue
        content = chunk[header_end + 4 :]
        if content.endswith(b"\r\n"):
            content = content[:-2]
        if not content:
            raise ValueError("file is required")
        return content
    raise ValueError("file is required")


def make_handler(predict, save_heatmap, lock: threading.Lock):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, fmt: str, *args) -> None:
            logger.info("%s - %s", self.address_string(), fmt % args)

        def do_GET(self) -> None:
            if self.path.split("?", 1)[0] != "/health":
                self._send(404, {"error": "not found"})
                return
            self._send(200, {"status": "ok"})

        def do_POST(self) -> None:
            if self.path.split("?", 1)[0] != "/analyze":
                self._send(404, {"error": "not found"})
                return

            try:
                dicom = self._read_dicom()
            except ValueError as exc:
                self._send(400, {"error": str(exc)})
                return

            directory = tempfile.mkdtemp(prefix="bonecheck-ml-")
            dicom_path = str(Path(directory) / "study.dcm")
            heatmap_path = str(Path(directory) / "heatmap.png")
            try:
                Path(dicom_path).write_bytes(dicom)
                with lock:
                    result = predict(dicom_path)
                    heatmap = self._heatmap_bytes(
                        dicom_path, heatmap_path, save_heatmap
                    )
                body = _public_result(result)
                if heatmap:
                    body["heatmap_png"] = base64.b64encode(heatmap).decode("ascii")
            except Exception as exc:
                logger.exception("inference failed")
                body = None
                error = exc
            else:
                error = None
            finally:
                shutil.rmtree(directory, ignore_errors=True)

            if error is not None:
                self._send(500, {"error": f"{type(error).__name__}: {error}"})
                return
            self._send(200, body)

        def _heatmap_bytes(self, dicom_path: str, heatmap_path: str, save_heatmap):
            try:
                save_heatmap(dicom_path, heatmap_path)
                data = Path(heatmap_path).read_bytes()
            except Exception:
                logger.exception("heatmap was not saved")
                return None
            if not data:
                logger.error("heatmap was empty")
                return None
            return data

        def _read_dicom(self) -> bytes:
            length = _content_length(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError("invalid body")
            boundary = _boundary(self.headers.get("Content-Type", ""))
            return _extract_file(raw, boundary)

        def _send(self, status: int, payload: dict) -> None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    return Handler


def build_server(host: str, port: int, predict, save_heatmap) -> ThreadingHTTPServer:
    handler = make_handler(predict, save_heatmap, threading.Lock())
    return ThreadingHTTPServer((host, port), handler)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    from inference.pipeline import load_models, save_heatmap_png, site_prediction

    model_dir = os.environ.get("MODEL_DIR") or None
    load_models(model_dir)
    host = os.environ.get("ML_HOST", "0.0.0.0")
    port = int(os.environ.get("ML_PORT", "8000"))
    server = build_server(host, port, site_prediction, save_heatmap_png)
    logger.info("ML inference listening on %s:%s", host, port)
    server.serve_forever()


if __name__ == "__main__":
    main()
