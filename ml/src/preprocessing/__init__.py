"""Шаги до сети: регион, сторона, канонический вид, угол оси, высота кадра.

Сами формулы живут в utils.dxa_utils и здесь только собраны для вызова.
"""

from utils.dxa_utils import (
    FEMUR_REGION,
    SPINE_REGION,
    canonicalize_femur,
    classify_region,
    detect_femur_side,
    frame_height_mm,
    spine_axis_angle,
)

__all__ = [
    "FEMUR_REGION",
    "SPINE_REGION",
    "canonicalize_femur",
    "classify_region",
    "detect_femur_side",
    "frame_height_mm",
    "spine_axis_angle",
]
