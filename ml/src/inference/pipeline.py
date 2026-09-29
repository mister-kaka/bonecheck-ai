"""Финальный инференс DXA.

Бедро: ансамбль V5 из femur_lay_sideaware_v5_final
    score = 0.7 * image_only + 0.3 * hybrid, порог 0.193505.
    Старые femur_lay_cnn_fold*.pt сюда не подходят и явно отвергаются.
Позвоночник: spine_cnn_fold*.pt + spine_axis_model.joblib.
    Пороги читаются из thresholds.json и не должны быть старыми
    (0.843 / 0.480 / 0.673). femur_lay в json игнорируется.

Веса и thresholds.json лежат в папке models рядом с src, не внутри пакетов.
Запуск из корня проекта:

    python src/app.py --input "C:\\path\\to\\dicom" --output submission.csv
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

_SRC = Path(__file__).resolve().parents[1]
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

import joblib
import numpy as np
import pandas as pd
import pydicom
import torch
import torch.nn as nn
import torchvision.transforms as T
from torchvision.models import resnet18

from utils import dxa_utils as U


DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
IMG_SIZE = 320
N_FOLDS = 5

FEMUR_V5_DIR = Path("femur_lay_sideaware_v5_final")
FEMUR_IMAGE_WEIGHT = 0.7
FEMUR_HYBRID_WEIGHT = 0.3
# Порог кандидата V5 (blend 70/30). Не брать thresholds.json["femur_lay"]:
# там остался старый порог femur_lay_cnn, 0.1525.
FEMUR_LAY_THRESHOLD = 0.193505
# Та же операционная точка, что в ROI-ноутбуке: высота кадра <= 210 * 1.05 мм.
# Это не поля 3 см и 2 см вокруг большого вертела: его координаты не размечены.

# Пороги позвоночника до дедупа по исследованию. Если json всё ещё такой,
# новые чекпоинты с ним запускать нельзя.
STALE_SPINE_THRESHOLDS = {
    "spine_lay": 0.8431509137153625,
    "spine_obj": 0.47970011830329895,
    "spine_axis": 0.6726597450834984,
}

IMAGENET_NORMALIZE = T.Normalize(
    [0.485, 0.456, 0.406],
    [0.229, 0.224, 0.225],
)
GEOM_NAMES = [
    "height_mm",
    "com_x",
    "com_y",
    "upper_com_x",
    "lower_com_x",
    "upper_lower_dx",
    "shaft_offset_b",
    "bright_mass_ratio",
    "bright_bbox_x0",
    "bright_bbox_x1",
    "bright_bbox_y0",
    "bright_bbox_y1",
]

SUBMISSION_COLUMNS = [
    "path_to_study",
    "study_uid",
    "image_uid",
    "anatomical_region",
    "quality_class",
    "violation_type",
    "processing_status",
    "time_of_processing",
]

OUTPUT_COLUMNS = [
    "path_to_study",
    "study_uid",
    "image_uid",
    "anatomical_region",
    "region_confident",
    "spine_axis_angle",
    "spine_axis_score",
    "spine_lay_score",
    "spine_obj_score",
    "femur_side",
    "femur_side_confident",
    "femur_image_score",
    "femur_hybrid_score",
    "femur_lay_score",
    "femur_roi_rows_px",
    "femur_roi_height_mm",
    "quality_class",
    "violation_type",
    "processing_status",
    "time_of_processing",
    "error",
]

spine_models: list[nn.Module] = []
femur_image_models: list[nn.Module] = []
femur_hybrid_models: list[nn.Module] = []
axis_model = None
thresholds: dict = {}


def violation_name(key: str) -> str:
    names = getattr(U, "VIOLATION_NAMES", {})
    if key not in names:
        raise KeyError(f"В dxa_utils.VIOLATION_NAMES нет ключа {key!r}. Есть: {sorted(names)}")
    return names[key]


def normalize_uint8(arr: np.ndarray) -> np.ndarray:
    """Тот же min-max, что в кэше обучения V5. Без +1e-6."""
    a = np.asarray(arr, dtype=np.float32)
    lo = float(a.min())
    hi = float(a.max())
    if hi <= lo:
        return np.zeros(a.shape, dtype=np.uint8)
    a = (a - lo) / (hi - lo)
    return np.clip(a * 255.0, 0, 255).astype(np.uint8)


def _tensor_from_uint8(arr_u8: np.ndarray) -> torch.Tensor:
    x = T.Compose(
        [
            T.ToPILImage(),
            T.Resize((IMG_SIZE, IMG_SIZE)),
            T.ToTensor(),
        ]
    )(arr_u8)
    x = x.repeat(3, 1, 1)
    return IMAGENET_NORMALIZE(x).unsqueeze(0).to(DEVICE)


def preprocess_femur(arr_u8: np.ndarray) -> torch.Tensor:
    # Обучение кормит в сеть уже uint8 после normalize_uint8, второй min-max не делает.
    return _tensor_from_uint8(arr_u8)


def preprocess_spine(arr: np.ndarray) -> torch.Tensor:
    # Как SpineDataset при train=False: min-max с 1e-6, затем uint8.
    a = np.asarray(arr, dtype=np.float32)
    a = (a - a.min()) / (a.max() - a.min() + 1e-6)
    a = np.clip(a * 255.0, 0, 255).astype(np.uint8)
    return _tensor_from_uint8(a)


def _shifted(arr, pct: float = 20) -> np.ndarray:
    a = np.asarray(arr, dtype=np.float64)
    a = a - np.percentile(a, pct)
    a[a < 0] = 0
    return a


def _weighted_com(block) -> tuple[float, float]:
    a = np.asarray(block, dtype=np.float64)
    h, w = a.shape
    yy, xx = np.indices((h, w), dtype=np.float64)
    mass = a.sum()
    if mass <= 1e-9:
        return 0.5, 0.5
    cx = float((a * xx).sum() / mass / max(w - 1, 1))
    cy = float((a * yy).sum() / mass / max(h - 1, 1))
    return cx, cy


def femur_geometry_features(arr_u8: np.ndarray) -> np.ndarray:
    """Геометрия как в обучении V5: вход уже uint8 и уже приведён к стороне,
    внутри ещё раз canonicalize_femur(..., "R").
    """
    canonical = U.canonicalize_femur(arr_u8, "R")
    a = _shifted(canonical)
    h, w = a.shape
    com_x, com_y = _weighted_com(a)
    upper = a[: h // 3]
    lower = a[2 * h // 3 :]
    upper_com_x, _ = _weighted_com(upper)
    lower_com_x, _ = _weighted_com(lower)
    shaft_b = U.shaft_offset_b(canonical)
    bright = a >= np.percentile(a, 85)
    ys, xs = np.where(bright)
    if len(xs):
        bx0 = float(xs.min() / max(w - 1, 1))
        bx1 = float(xs.max() / max(w - 1, 1))
        by0 = float(ys.min() / max(h - 1, 1))
        by1 = float(ys.max() / max(h - 1, 1))
    else:
        bx0 = bx1 = by0 = by1 = 0.5
    bright_mass_ratio = float(a[bright].sum() / (a.sum() + 1e-9))
    return np.array(
        [
            h * U.PX_Y_MM,
            com_x,
            com_y,
            upper_com_x,
            lower_com_x,
            upper_com_x - lower_com_x,
            shaft_b,
            bright_mass_ratio,
            bx0,
            bx1,
            by0,
            by1,
        ],
        dtype=np.float32,
    )


def femur_roi_bad(arr: np.ndarray) -> bool:
    """Короткий кадр по высоте в миллиметрах фиксированного пикселя."""
    return U.roi_violation(U.frame_height_mm(arr))


class FemurHybridModel(nn.Module):
    def __init__(self, n_geom: int):
        super().__init__()
        # Чекпоинт hybrid - полный state_dict. ImageNet здесь только скачивал бы лишний файл.
        backbone = resnet18(weights=None)
        backbone.fc = nn.Identity()
        self.backbone = backbone
        self.geom_head = nn.Sequential(
            nn.Linear(n_geom, 32),
            nn.ReLU(),
            nn.Dropout(0.20),
        )
        self.classifier = nn.Sequential(
            nn.Linear(512 + 32, 64),
            nn.ReLU(),
            nn.Dropout(0.30),
            nn.Linear(64, 1),
        )

    def forward(self, x_img, x_geom):
        z_img = self.backbone(x_img)
        z_geom = self.geom_head(x_geom)
        return self.classifier(torch.cat([z_img, z_geom], dim=1))


def build_spine_model() -> nn.Module:
    model = resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, 2)
    return model


def build_femur_image_model() -> nn.Module:
    model = resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, 1)
    return model


def _torch_load(path: Path) -> dict:
    try:
        state = torch.load(path, map_location=DEVICE, weights_only=True)
    except TypeError:
        state = torch.load(path, map_location=DEVICE)
    if not isinstance(state, dict):
        raise TypeError(f"{path} это не state_dict")
    return state


def load_state(model: nn.Module, path: Path, kind: str) -> nn.Module:
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(f"Нет чекпоинта: {path}")
    state = _torch_load(path)
    keys = list(state)

    if kind == "image":
        if not any(k.startswith("net.") for k in keys):
            raise RuntimeError(
                f"{path} не V5 image_only: нет префикса net. "
                "Похоже на старый femur_lay_cnn_fold."
            )
        state = {
            (k[len("net.") :] if k.startswith("net.") else k): v
            for k, v in state.items()
        }
    elif kind == "hybrid":
        if not any(k.startswith("backbone.") for k in keys):
            raise RuntimeError(f"{path} не V5 hybrid: нет ключей backbone.*")
    elif kind == "spine":
        if any(k.startswith("net.") or k.startswith("backbone.") for k in keys):
            raise RuntimeError(f"{path} похож на чекпоинт бедра, а ожидался spine_cnn")
    else:
        raise ValueError(kind)

    model.load_state_dict(state)
    model.to(DEVICE)
    model.eval()
    return model


def _check_spine_thresholds(loaded: dict) -> dict:
    missing = [k for k in ("spine_lay", "spine_obj", "spine_axis") if k not in loaded]
    if missing:
        raise KeyError(f"В thresholds.json нет {missing}")
    stale = [
        k
        for k, old in STALE_SPINE_THRESHOLDS.items()
        if abs(float(loaded[k]) - old) < 1e-9
    ]
    if stale:
        raise RuntimeError(
            "thresholds.json всё ещё содержит старые пороги позвоночника "
            f"{stale}. Нужны значения после дедупа: "
            "spine_lay≈0.759, spine_obj≈0.445, spine_axis≈0.593."
        )
    femur_in_json = loaded.get("femur_lay")
    print(
        "Spine thresholds:",
        {k: float(loaded[k]) for k in ("spine_lay", "spine_obj", "spine_axis")},
    )
    print(
        f"femur_lay в json ({femur_in_json}) игнорируется. "
        f"Порог бедра V5 = {FEMUR_LAY_THRESHOLD}"
    )
    return loaded


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def default_model_dir() -> Path:
    models = repo_root() / "models"
    if (models / "thresholds.json").is_file() or (models / "spine_axis_model.joblib").is_file():
        return models
    return repo_root()


def load_models(base_dir: Path | str | None = None) -> None:
    global spine_models, femur_image_models, femur_hybrid_models, axis_model, thresholds
    base = Path(base_dir).resolve() if base_dir is not None else default_model_dir()

    thresholds = _check_spine_thresholds(U.load_thresholds(base / "thresholds.json", must_exist=True))

    axis_path = base / "spine_axis_model.joblib"
    if not axis_path.is_file():
        raise FileNotFoundError(f"Нет {axis_path}")
    axis_model = joblib.load(axis_path)

    femur_dir = base / FEMUR_V5_DIR
    spine_models = [
        load_state(build_spine_model(), base / f"spine_cnn_fold{i}.pt", "spine")
        for i in range(N_FOLDS)
    ]
    femur_image_models = [
        load_state(
            build_femur_image_model(),
            femur_dir / f"image_only_fold{i}.pt",
            "image",
        )
        for i in range(N_FOLDS)
    ]
    femur_hybrid_models = [
        load_state(
            FemurHybridModel(len(GEOM_NAMES)),
            femur_dir / f"hybrid_fold{i}.pt",
            "hybrid",
        )
        for i in range(N_FOLDS)
    ]
    print(
        f"Loaded {len(spine_models)}/5 spine + "
        f"{len(femur_image_models)}/5 image-only + "
        f"{len(femur_hybrid_models)}/5 hybrid"
    )
    print(
        f"Femur blend: {FEMUR_IMAGE_WEIGHT} image + {FEMUR_HYBRID_WEIGHT} hybrid; "
        f"threshold={FEMUR_LAY_THRESHOLD}; ROI height <= {U.FEMUR_ROI_MAX_HEIGHT_MM} mm"
    )
    print("DEVICE:", DEVICE)


def _ensemble_sigmoid(models, forward) -> np.ndarray:
    scores = [forward(model) for model in models]
    return np.mean(np.stack(scores, axis=0), axis=0)


@torch.no_grad()
def predict_spine_ensemble(arr: np.ndarray) -> np.ndarray:
    x = preprocess_spine(arr)

    def _one(model):
        return torch.sigmoid(model(x)).cpu().numpy()[0]

    return _ensemble_sigmoid(spine_models, _one)


def spine_axis_probability(angle: float) -> float:
    if axis_model is None:
        raise RuntimeError("axis_model не загружен. Вызови load_models().")
    frame = pd.DataFrame({"axis_angle": [float(angle)]})
    proba = axis_model.predict_proba(frame)[0]
    classes = list(getattr(axis_model, "classes_", [0, 1]))
    if 1 in classes:
        return float(proba[classes.index(1)])
    return float(proba[-1])


def femur_variants(arr: np.ndarray, info: dict) -> list[np.ndarray]:
    if info["confident"]:
        return [U.canonicalize_femur(arr, info["side"])]
    # Сторона неизвестна: усредняются исходник и горизонтальный флип.
    flipped = np.ascontiguousarray(np.fliplr(arr))
    return [arr, flipped]


@torch.no_grad()
def predict_femur_scores(arr: np.ndarray):
    info = U.detect_femur_side(arr)
    image_scores = []
    hybrid_scores = []
    for raw in femur_variants(arr, info):
        v = normalize_uint8(raw)
        x = preprocess_femur(v)
        geom = femur_geometry_features(v)
        x_geom = torch.tensor(geom, dtype=torch.float32).unsqueeze(0).to(DEVICE)

        def _image(model, x=x):
            return float(torch.sigmoid(model(x)).cpu().numpy().reshape(-1)[0])

        def _hybrid(model, x=x, x_geom=x_geom):
            return float(torch.sigmoid(model(x, x_geom)).cpu().numpy().reshape(-1)[0])

        image_scores.append(float(np.mean([_image(m) for m in femur_image_models])))
        hybrid_scores.append(float(np.mean([_hybrid(m) for m in femur_hybrid_models])))

    image_score = float(np.mean(image_scores))
    hybrid_score = float(np.mean(hybrid_scores))
    blend = FEMUR_IMAGE_WEIGHT * image_score + FEMUR_HYBRID_WEIGHT * hybrid_score
    return info, image_score, hybrid_score, blend


def _blank_row(path: str) -> dict:
    row = {col: "" for col in OUTPUT_COLUMNS}
    row["path_to_study"] = path
    row["quality_class"] = ""
    return row


def predict_single_dicom(file_path: str) -> dict:
    if not spine_models or axis_model is None:
        raise RuntimeError("Модели не загружены. Вызови load_models().")
    t0 = time.time()
    dcm = pydicom.dcmread(file_path)
    arr = dcm.pixel_array
    columns = int(getattr(dcm, "Columns", -1))
    region, region_conf = U.classify_region(columns)

    out = _blank_row(file_path)
    out.update(
        {
            "study_uid": str(getattr(dcm, "StudyInstanceUID", "") or ""),
            "image_uid": str(getattr(dcm, "SOPInstanceUID", "") or ""),
            "anatomical_region": region,
            "region_confident": bool(region_conf),
        }
    )
    violations: list[str] = []

    if region == U.SPINE_REGION:
        angle = float(U.spine_axis_angle(arr))
        axis_p = spine_axis_probability(angle)
        p = predict_spine_ensemble(arr)
        out.update(
            {
                "spine_axis_angle": angle,
                "spine_axis_score": axis_p,
                "spine_lay_score": float(p[0]),
                "spine_obj_score": float(p[1]),
            }
        )
        if np.isfinite(axis_p) and axis_p >= float(thresholds["spine_axis"]):
            violations.append(violation_name("spine_axis"))
        if float(p[0]) >= float(thresholds["spine_lay"]):
            violations.append(violation_name("spine_lay"))
        if float(p[1]) >= float(thresholds["spine_obj"]):
            violations.append(violation_name("spine_obj"))
    elif region == U.FEMUR_REGION:
        info, image_score, hybrid_score, blend = predict_femur_scores(arr)
        rows = int(arr.shape[0])
        height_mm = float(U.frame_height_mm(arr))
        roi_bad = femur_roi_bad(arr)
        out.update(
            {
                "femur_side": info["side"],
                "femur_side_confident": bool(info["confident"]),
                "femur_image_score": image_score,
                "femur_hybrid_score": hybrid_score,
                "femur_lay_score": blend,
                "femur_roi_rows_px": rows,
                "femur_roi_height_mm": height_mm,
            }
        )
        if blend >= FEMUR_LAY_THRESHOLD:
            violations.append(violation_name("femur_lay"))
        if roi_bad:
            violations.append(violation_name("femur_roi"))
    else:
        raise ValueError(f"Unsupported anatomical region: {region}")

    out.update(
        {
            "quality_class": int(bool(violations)),
            "violation_type": ";".join(violations),
            "processing_status": "Success",
            "time_of_processing": round(time.time() - t0, 3),
            "error": "",
        }
    )
    return out


def process_directory(input_dir: str, output_path: str = "submission.csv") -> pd.DataFrame:
    rows = []
    for root, _, files in os.walk(input_dir):
        for fn in sorted(files):
            if not fn.lower().endswith(".dcm"):
                continue
            path = os.path.join(root, fn)
            started = time.time()
            try:
                rows.append(predict_single_dicom(path))
            except Exception as exc:
                failed = _blank_row(path)
                failed["processing_status"] = "Failure"
                failed["time_of_processing"] = round(time.time() - started, 3)
                failed["error"] = f"{type(exc).__name__}: {exc}"
                rows.append(failed)
                print("FAIL", path, failed["error"])
    table = pd.DataFrame(rows)
    if len(table) == 0:
        table = pd.DataFrame(columns=SUBMISSION_COLUMNS)
    else:
        table = table.reindex(columns=SUBMISSION_COLUMNS)
    if str(output_path).lower().endswith(".xlsx"):
        table.to_excel(output_path, index=False)
    else:
        table.to_csv(output_path, index=False)
    out = table
    failures = int((out["processing_status"] != "Success").sum()) if len(out) else 0
    print(f"Processed {len(out)} files; failures={failures}")
    return out


def site_prediction(file_path: str) -> dict:
    """Ответ для BoneCheck.

    Клинические поля — quality_class, violation_type, anatomical_region.
    Рядом с ними идентификаторы DICOM и время обработки для файла сдачи.
    quality_prob и внутренние scores сюда не входят.
    """
    row = predict_single_dicom(file_path)
    if row.get("processing_status") != "Success":
        raise RuntimeError(row.get("error") or "Не удалось проверить качество укладки.")
    return {
        "quality_class": int(row["quality_class"]),
        "violation_type": str(row["violation_type"]),
        "anatomical_region": str(row["anatomical_region"]),
        "study_uid": str(row.get("study_uid") or ""),
        "image_uid": str(row.get("image_uid") or ""),
        "time_of_processing": float(row["time_of_processing"]),
        "processing_status": "Success",
    }


def _view_for_cam(arr: np.ndarray) -> tuple[np.ndarray, np.ndarray, bool]:
    if not spine_models or axis_model is None or not femur_image_models or not femur_hybrid_models:
        raise RuntimeError("Модели не загружены. Вызови load_models().")
    region, _ = U.classify_region(int(arr.shape[1]))
    if region == U.SPINE_REGION:
        shown = normalize_uint8(arr)
        cam = _gradcam_ensemble(
            spine_models,
            preprocess_spine(arr),
            layer_of=lambda m: m.layer4[-1],
        )
        return shown, cam, False
    if region == U.FEMUR_REGION:
        info = U.detect_femur_side(arr)
        raw = femur_variants(arr, info)[0]
        shown = normalize_uint8(raw)
        x = preprocess_femur(shown)
        geom = femur_geometry_features(shown)
        x_geom = torch.tensor(geom, dtype=torch.float32).unsqueeze(0).to(DEVICE)
        cam_image = _gradcam_ensemble(
            femur_image_models,
            x,
            layer_of=lambda m: m.layer4[-1],
        )
        cam_hybrid = _gradcam_ensemble(
            femur_hybrid_models,
            x,
            layer_of=lambda m: m.backbone.layer4[-1],
            x_geom=x_geom,
        )
        cam = FEMUR_IMAGE_WEIGHT * cam_image + FEMUR_HYBRID_WEIGHT * cam_hybrid
        flip_back = bool(info["confident"] and info["side"] == "L")
        return shown, cam, flip_back
    raise ValueError(f"Unsupported anatomical region: {region}")


def heatmap_rgb(arr: np.ndarray) -> np.ndarray:
    """Снимок с картой укладки. Размер и лево-право как у исходного DICOM."""
    import cv2

    shown, cam, flip_back = _view_for_cam(arr)
    height, width = int(arr.shape[0]), int(arr.shape[1])
    shown_img = cv2.resize(shown, (width, height), interpolation=cv2.INTER_LINEAR)
    cam_img = cv2.resize(
        np.clip(cam, 0, 1).astype(np.float32),
        (width, height),
        interpolation=cv2.INTER_LINEAR,
    )
    heat = cv2.applyColorMap(np.uint8(255 * cam_img), cv2.COLORMAP_JET)
    heat = cv2.cvtColor(heat, cv2.COLOR_BGR2RGB)
    base = np.stack([shown_img] * 3, axis=-1)
    overlay = cv2.addWeighted(base, 0.6, heat, 0.4, 0)
    if flip_back:
        overlay = np.ascontiguousarray(overlay[:, ::-1])
    return overlay


def save_heatmap_png(file_path: str, output_path: str) -> str:
    import cv2

    rgb = heatmap_rgb(pydicom.dcmread(file_path).pixel_array)
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    ok, encoded = cv2.imencode(".png", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    if not ok:
        raise OSError(f"Не удалось закодировать PNG для {path}")
    path.write_bytes(encoded.tobytes())
    return str(path.resolve())


def visualize_dicom(file_path: str) -> None:
    """Окно matplotlib: вход модели и карта. Для сайта нужен save_heatmap_png."""
    import cv2
    import matplotlib.pyplot as plt

    shown, cam, _flip_back = _view_for_cam(pydicom.dcmread(file_path).pixel_array)
    shown_img = np.array(T.Resize((IMG_SIZE, IMG_SIZE))(T.ToPILImage()(shown)))
    heat = cv2.applyColorMap(np.uint8(255 * np.clip(cam, 0, 1)), cv2.COLORMAP_JET)
    heat = cv2.cvtColor(heat, cv2.COLOR_BGR2RGB)
    overlay = cv2.addWeighted(np.stack([shown_img] * 3, axis=-1), 0.6, heat, 0.4, 0)
    plt.figure(figsize=(10, 5))
    plt.subplot(1, 2, 1)
    plt.title("Вход модели")
    plt.imshow(shown_img, cmap="gray")
    plt.axis("off")
    plt.subplot(1, 2, 2)
    plt.title("Grad-CAM укладки")
    plt.imshow(overlay)
    plt.axis("off")
    plt.show()


def _gradcam_ensemble(models, x_img, layer_of, x_geom=None) -> np.ndarray:
    cams = [_gradcam_one(m, x_img, layer_of(m), x_geom=x_geom) for m in models]
    return np.mean(cams, axis=0)


def _gradcam_one(model, x_img, target_layer, x_geom=None) -> np.ndarray:
    import cv2

    activations, gradients = [], []

    def forward_hook(module, inputs, output):
        activations.append(output)

    def backward_hook(module, grad_in, grad_out):
        gradients.append(grad_out[0])

    h_fwd = target_layer.register_forward_hook(forward_hook)
    h_bwd = target_layer.register_full_backward_hook(backward_hook)
    try:
        with torch.enable_grad():
            x_req = x_img.detach().requires_grad_(True)
            output = model(x_req, x_geom) if x_geom is not None else model(x_req)
            score = output[0, 0]
            model.zero_grad(set_to_none=True)
            score.backward()
        grads = gradients[0].detach().cpu().numpy()[0]
        acts = activations[0].detach().cpu().numpy()[0]
        weights = grads.mean(axis=(1, 2))
        cam = np.zeros(acts.shape[1:], dtype=np.float32)
        for i, w in enumerate(weights):
            cam += w * acts[i]
        cam = np.maximum(cam, 0)
        if cam.max() > 0:
            cam = cam / cam.max()
        return cv2.resize(cam, (IMG_SIZE, IMG_SIZE))
    finally:
        h_fwd.remove()
        h_bwd.remove()


def main() -> None:
    parser = argparse.ArgumentParser(description="DXA inference, femur V5 + spine deduped")
    parser.add_argument("--input", required=True, help="Папка с DICOM")
    parser.add_argument("--output", default="submission.csv")
    parser.add_argument(
        "--base",
        default=None,
        help="Папка с thresholds.json, spine_*.pt и femur_lay_sideaware_v5_final/. "
        "По умолчанию models/ в корне проекта, если веса уже лежат там.",
    )
    args = parser.parse_args()
    input_dir = str(Path(args.input).resolve())
    output_path = str(Path(args.output).resolve())
    load_models(args.base)
    process_directory(input_dir, output_path)


if __name__ == "__main__":
    main()
