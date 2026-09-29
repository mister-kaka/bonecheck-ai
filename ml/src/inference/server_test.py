"""Контракт HTTP-обёртки без загрузки весов и без вызова pipeline."""

from __future__ import annotations

import base64
import json
import os
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

import http.client

from inference.server import MAX_BODY_BYTES, build_server

PNG = b"\x89PNG\r\n\x1a\nfake"


class InferenceServerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.calls = []
        self.temp_dirs: list[str] = []

        def predict(dicom_path: str) -> dict:
            self.temp_dirs.append(os.path.dirname(dicom_path))
            payload = Path(dicom_path).read_bytes()
            self.calls.append(("predict", payload))
            if payload == b"broken":
                raise RuntimeError("bad dicom")
            if payload == b"hip":
                return {
                    "quality_class": 1,
                    "violation_type": "Некорректная укладка;Некорректная область интереса",
                    "anatomical_region": "Проксимальный отдел бедра",
                    "femur_side": "L",
                    "quality_prob": 0.8,
                }
            if payload == b"meta":
                return {
                    "quality_class": 0,
                    "violation_type": "",
                    "anatomical_region": "Поясничный отдел позвоночника",
                    "study_uid": "1.2.3",
                    "image_uid": "1.2.3.4",
                    "time_of_processing": 1.25,
                    "processing_status": "Success",
                    "quality_prob": 0.2,
                }
            return {
                "quality_class": 0,
                "violation_type": "",
                "anatomical_region": "Поясничный отдел позвоночника",
            }

        def save_heatmap(dicom_path: str, heatmap_path: str) -> str:
            payload = Path(dicom_path).read_bytes()
            self.calls.append(("heatmap", payload, heatmap_path))
            if payload == b"no-heatmap":
                raise OSError("disk full")
            Path(heatmap_path).write_bytes(PNG)
            return heatmap_path

        self.server = build_server("127.0.0.1", 0, predict, save_heatmap)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.thread.join(timeout=3)
        self.server.server_close()

    def multipart(
        self,
        content: bytes,
        field: str = "file",
        filename: str = "study.dcm",
        boundary: str = "----bonecheck",
    ) -> tuple[bytes, str]:
        head = (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'
            f"Content-Type: application/dicom\r\n"
            f"\r\n"
        ).encode("utf-8")
        tail = f"\r\n--{boundary}--\r\n".encode("utf-8")
        return head + content + tail, f"multipart/form-data; boundary={boundary}"

    def request(
        self,
        method: str,
        path: str,
        payload: bytes | None = None,
        content_type: str | None = None,
    ):
        req = urllib.request.Request(self.base + path, data=payload, method=method)
        if content_type is not None:
            req.add_header("Content-Type", content_type)
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                raw = response.read().decode("utf-8")
                return response.status, json.loads(raw)
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8")
            return exc.code, json.loads(raw)

    def post_file(self, content: bytes, **kwargs):
        body, content_type = self.multipart(content, **kwargs)
        return self.request("POST", "/analyze", body, content_type)

    def assert_temps_removed(self) -> None:
        self.assertTrue(self.temp_dirs)
        for directory in self.temp_dirs:
            self.assertFalse(os.path.exists(directory), directory)

    def test_body_limit_covers_50_mib_dicom(self) -> None:
        self.assertEqual(MAX_BODY_BYTES, 50 * 1024 * 1024 + 64 * 1024)

    def test_health(self) -> None:
        status, body = self.request("GET", "/health")
        self.assertEqual(status, 200)
        self.assertEqual(body, {"status": "ok"})

    def test_analyze_returns_site_fields_and_heatmap(self) -> None:
        status, body = self.post_file(b"hip")
        self.assertEqual(status, 200)
        self.assertEqual(body["quality_class"], 1)
        self.assertEqual(
            body["violation_type"],
            "Некорректная укладка;Некорректная область интереса",
        )
        self.assertEqual(body["anatomical_region"], "Проксимальный отдел бедра")
        self.assertEqual(base64.b64decode(body["heatmap_png"]), PNG)
        self.assertNotIn("quality_prob", body)
        self.assertNotIn("femur_side", body)
        self.assertEqual(self.calls[0], ("predict", b"hip"))
        kind, payload, heatmap_path = self.calls[1]
        self.assertEqual(kind, "heatmap")
        self.assertEqual(payload, b"hip")
        self.assertTrue(str(heatmap_path).endswith("heatmap.png"))
        self.assert_temps_removed()

    def test_binary_dicom_roundtrip(self) -> None:
        blob = b"\x00\xffDICM\r\n\r\n--not-the-boundary\r\n"
        status, body = self.post_file(blob)
        self.assertEqual(status, 200)
        self.assertEqual(self.calls[0], ("predict", blob))
        self.assertEqual(base64.b64decode(body["heatmap_png"]), PNG)
        self.assert_temps_removed()

    def test_analyze_keeps_submission_fields(self) -> None:
        status, body = self.post_file(b"meta")
        self.assertEqual(status, 200)
        self.assertEqual(body["study_uid"], "1.2.3")
        self.assertEqual(body["image_uid"], "1.2.3.4")
        self.assertEqual(body["time_of_processing"], 1.25)
        self.assertEqual(body["processing_status"], "Success")
        self.assertNotIn("quality_prob", body)
        self.assert_temps_removed()

    def test_heatmap_failure_keeps_prediction(self) -> None:
        status, body = self.post_file(b"no-heatmap")
        self.assertEqual(status, 200)
        self.assertEqual(body["quality_class"], 0)
        self.assertEqual(body["violation_type"], "")
        self.assertNotIn("heatmap_png", body)
        self.assert_temps_removed()

    def test_predict_failure_is_http_500_and_removes_temp_files(self) -> None:
        status, body = self.post_file(b"broken")
        self.assertEqual(status, 500)
        self.assertIn("bad dicom", body["error"])
        self.assertEqual(self.calls, [("predict", b"broken")])
        self.assert_temps_removed()
        health, health_body = self.request("GET", "/health")
        self.assertEqual(health, 200)
        self.assertEqual(health_body, {"status": "ok"})

    def test_json_body_is_rejected(self) -> None:
        status, body = self.request(
            "POST",
            "/analyze",
            b'{"dicom_path":"/tmp/a.dcm"}',
            "application/json",
        )
        self.assertEqual(status, 400)
        self.assertIn("multipart", body["error"])
        self.assertEqual(self.calls, [])
        self.assertEqual(self.temp_dirs, [])

    def test_missing_file_field_is_rejected(self) -> None:
        status, body = self.post_file(b"hip", field="dicom")
        self.assertEqual(status, 400)
        self.assertIn("file", body["error"])
        self.assertEqual(self.calls, [])

    def test_empty_file_is_rejected(self) -> None:
        status, body = self.post_file(b"")
        self.assertEqual(status, 400)
        self.assertIn("file", body["error"])
        self.assertEqual(self.calls, [])

    def test_body_over_50_mib_is_rejected(self) -> None:
        host, port = self.server.server_address
        connection = http.client.HTTPConnection(host, port, timeout=5)
        try:
            connection.request(
                "POST",
                "/analyze",
                body=b"x",
                headers={
                    "Content-Type": "multipart/form-data; boundary=abc",
                    "Content-Length": str(MAX_BODY_BYTES + 1),
                },
            )
            response = connection.getresponse()
            raw = response.read()
        finally:
            connection.close()
        self.assertEqual(response.status, 400)
        self.assertIn("invalid body", json.loads(raw)["error"])
        self.assertEqual(self.calls, [])


if __name__ == "__main__":
    unittest.main()
