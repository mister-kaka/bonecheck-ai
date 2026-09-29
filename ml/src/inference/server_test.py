"""Контракт HTTP-обёртки без загрузки весов и без вызова pipeline."""

from __future__ import annotations

import json
import threading
import unittest
import urllib.error
import urllib.request

from inference.server import build_server


class InferenceServerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.calls = []

        def predict(dicom_path: str) -> dict:
            self.calls.append(("predict", dicom_path))
            if dicom_path.endswith("broken.dcm"):
                raise RuntimeError("bad dicom")
            if dicom_path.endswith("hip.dcm"):
                return {
                    "quality_class": 1,
                    "violation_type": "Некорректная укладка;Некорректная область интереса",
                    "anatomical_region": "Проксимальный отдел бедра",
                    "femur_side": "L",
                    "quality_prob": 0.8,
                }
            return {
                "quality_class": 0,
                "violation_type": "",
                "anatomical_region": "Поясничный отдел позвоночника",
            }

        def save_heatmap(dicom_path: str, heatmap_path: str) -> str:
            self.calls.append(("heatmap", dicom_path, heatmap_path))
            if dicom_path.endswith("no-heatmap.dcm"):
                raise OSError("disk full")
            return heatmap_path

        self.server = build_server("127.0.0.1", 0, predict, save_heatmap)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.thread.join(timeout=3)
        self.server.server_close()

    def request(self, method: str, path: str, payload: dict | None = None):
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(self.base + path, data=data, method=method)
        if data is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                raw = response.read().decode("utf-8")
                return response.status, json.loads(raw)
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8")
            return exc.code, json.loads(raw)

    def test_health(self) -> None:
        status, body = self.request("GET", "/health")
        self.assertEqual(status, 200)
        self.assertEqual(body, {"status": "ok"})

    def test_analyze_returns_only_site_fields(self) -> None:
        status, body = self.request(
            "POST",
            "/analyze",
            {"dicom_path": "C:/uploads/hip.dcm", "heatmap_path": "C:/uploads/heatmap.png"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(
            body,
            {
                "quality_class": 1,
                "violation_type": "Некорректная укладка;Некорректная область интереса",
                "anatomical_region": "Проксимальный отдел бедра",
            },
        )
        self.assertNotIn("quality_prob", body)
        self.assertNotIn("femur_side", body)
        self.assertEqual(
            self.calls,
            [
                ("predict", "C:/uploads/hip.dcm"),
                ("heatmap", "C:/uploads/hip.dcm", "C:/uploads/heatmap.png"),
            ],
        )

    def test_heatmap_failure_keeps_prediction(self) -> None:
        status, body = self.request(
            "POST",
            "/analyze",
            {
                "dicom_path": "C:/uploads/no-heatmap.dcm",
                "heatmap_path": "C:/uploads/heatmap.png",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(body["quality_class"], 0)
        self.assertEqual(body["violation_type"], "")

    def test_predict_failure_is_http_500(self) -> None:
        status, body = self.request(
            "POST",
            "/analyze",
            {"dicom_path": "C:/uploads/broken.dcm", "heatmap_path": "C:/uploads/heatmap.png"},
        )
        self.assertEqual(status, 500)
        self.assertIn("bad dicom", body["error"])
        self.assertEqual(self.calls, [("predict", "C:/uploads/broken.dcm")])

    def test_invalid_json(self) -> None:
        req = urllib.request.Request(
            self.base + "/analyze",
            data=b"{",
            method="POST",
        )
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(req, timeout=5)
        self.assertEqual(caught.exception.code, 400)


if __name__ == "__main__":
    unittest.main()
