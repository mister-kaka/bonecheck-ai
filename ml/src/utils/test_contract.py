"""Контракт региона, нарушений и порога высоты кадра бедра."""

from __future__ import annotations

import unittest

import numpy as np

from utils import dxa_utils as U


class RegionContractTest(unittest.TestCase):
    def test_width_selects_region(self) -> None:
        spine, spine_ok = U.classify_region(300)
        femur, femur_ok = U.classify_region(280)
        self.assertEqual(spine, "Поясничный отдел позвоночника")
        self.assertEqual(femur, "Проксимальный отдел бедра")
        self.assertTrue(spine_ok)
        self.assertTrue(femur_ok)

    def test_violation_names(self) -> None:
        self.assertEqual(
            U.VIOLATION_NAMES,
            {
                "spine_lay": "Некорректная укладка",
                "spine_axis": "Не выравнена ось позвоночника",
                "spine_obj": "Присутствуют посторонние предметы",
                "femur_lay": "Некорректная укладка",
                "femur_roi": "Некорректная область интереса",
            },
        )


class FemurRoiHeightTest(unittest.TestCase):
    def test_pixel_size_and_boundary(self) -> None:
        self.assertEqual(U.PX_X_MM, 0.6)
        self.assertEqual(U.PX_Y_MM, 1.05)
        self.assertEqual(U.FEMUR_ROI_MAX_HEIGHT_MM, 210 * U.PX_Y_MM)

        short = np.zeros((210, 280), dtype=np.uint8)
        tall = np.zeros((211, 280), dtype=np.uint8)
        self.assertTrue(U.roi_violation(U.frame_height_mm(short)))
        self.assertFalse(U.roi_violation(U.frame_height_mm(tall)))


if __name__ == "__main__":
    unittest.main()
