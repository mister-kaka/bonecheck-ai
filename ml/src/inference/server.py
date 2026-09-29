"""Долгоживущий HTTP-инференс для BoneCheck.

Модели загружаются один раз в main(), до приёма запросов.
Каждый запрос вызывает site_prediction и затем save_heatmap_png.
Пакетный process_directory и visualize_dicom здесь не используются.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

logger = logging.getLogger("bonecheck.ml")

MAX_BODY_BYTES = 64 * 1024
RESULT_KEYS = ("quality_class", "violation_type", "anatomical_region")


def _public_result(result: dict) -> dict:
    return {
        "quality_class": int(result["quality_class"]),
        "violation_type": str(result["violation_type"]),
        "anatomical_region": str(result["anatomical_region"]),
    }


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
                payload = self._read_json()
            except ValueError as exc:
                self._send(400, {"error": str(exc)})
                return

            dicom_path = payload.get("dicom_path")
            heatmap_path = payload.get("heatmap_path")
            if not isinstance(dicom_path, str) or not dicom_path.strip():
                self._send(400, {"error": "dicom_path is required"})
                return

            try:
                with lock:
                    result = predict(dicom_path)
                    self._save_heatmap(dicom_path, heatmap_path, save_heatmap)
                body = _public_result(result)
            except Exception as exc:
                logger.exception("inference failed for %s", dicom_path)
                self._send(500, {"error": f"{type(exc).__name__}: {exc}"})
                return

            self._send(200, body)

        def _save_heatmap(self, dicom_path: str, heatmap_path, save_heatmap) -> None:
            if not isinstance(heatmap_path, str) or not heatmap_path.strip():
                logger.error("heatmap path is missing for %s", dicom_path)
                return
            try:
                save_heatmap(dicom_path, heatmap_path)
            except Exception:
                logger.exception("heatmap was not saved for %s", dicom_path)

        def _read_json(self) -> dict:
            raw_length = self.headers.get("Content-Length", "0")
            try:
                length = int(raw_length)
            except ValueError as exc:
                raise ValueError("invalid Content-Length") from exc
            if length <= 0 or length > MAX_BODY_BYTES:
                raise ValueError("invalid body")
            raw = self.rfile.read(length)
            try:
                payload = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise ValueError("invalid json") from exc
            if not isinstance(payload, dict):
                raise ValueError("json object required")
            return payload

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
