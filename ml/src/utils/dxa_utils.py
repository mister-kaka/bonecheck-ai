"""Общие функции DXA: регион, сторона бедра, угол оси, метрики и пороги.

Torch здесь не используется. Знаки ориентации и правило порога оставлены как в обучении.
"""

import hashlib
import json
import os

import numpy as np

PX_X_MM = 0.6
PX_Y_MM = 1.05

SPINE_WIDTH = 300
FEMUR_WIDTH = 280
SPINE_REGION = "Поясничный отдел позвоночника"
FEMUR_REGION = "Проксимальный отдел бедра"

VIOLATION_NAMES = {
    "spine_lay": "Некорректная укладка",
    "spine_axis": "Не выравнена ось позвоночника",
    "spine_obj": "Присутствуют посторонние предметы",
    "femur_lay": "Некорректная укладка",
    "femur_roi": "Некорректная область интереса",
}

ROI_SCORE_RANGE_MM = (150.0, 400.0)
FEMUR_ROI_MAX_ROWS = 210
FEMUR_ROI_MAX_HEIGHT_MM = FEMUR_ROI_MAX_ROWS * PX_Y_MM
THRESHOLDS_PATH = "thresholds.json"


def classify_region(columns):
    """300 — позвоночник, 280 — бедро. Иная ширина — ближайший регион, confident=False."""
    columns = int(columns)
    if columns == SPINE_WIDTH:
        return SPINE_REGION, True
    if columns == FEMUR_WIDTH:
        return FEMUR_REGION, True
    nearest = (
        SPINE_REGION
        if abs(columns - SPINE_WIDTH) < abs(columns - FEMUR_WIDTH)
        else FEMUR_REGION
    )
    return nearest, False


def pixel_hash(arr):
    values = np.ascontiguousarray(arr)
    digest = hashlib.md5()
    digest.update(str(values.shape).encode())
    digest.update(values.tobytes())
    return digest.hexdigest()


def _shifted(arr, pct=20):
    values = np.asarray(arr, dtype=np.float64)
    values = values - np.percentile(values, pct)
    values[values < 0] = 0
    return values


def orientation_score_a(arr):
    """Знак укладки бедра: плюс — правое, минус — левое."""
    values = _shifted(arr)
    height, width = values.shape
    xs = np.arange(width, dtype=np.float64)

    def com(block):
        profile = block.sum(axis=0)
        return float((profile * xs).sum() / (profile.sum() + 1e-9))

    upper = com(values[: height // 3])
    lower = com(values[2 * height // 3 :])
    return float((upper - lower) / width)


def shaft_offset_b(arr):
    """Смещение диафиза: минус — правое, плюс — левое."""
    values = _shifted(arr)
    height, width = values.shape
    profile = values[int(0.80 * height) :].sum(axis=0)
    xs = np.arange(width, dtype=np.float64)
    center = float((profile * xs).sum() / (profile.sum() + 1e-9))
    return float((center - width / 2) / width)


def detect_femur_side(arr, min_abs_a=0.10):
    score_a = orientation_score_a(arr)
    score_b = shaft_offset_b(arr)
    side_a = "R" if score_a > 0 else "L"
    side_b = "R" if score_b < 0 else "L"
    confident = (side_a == side_b) and (abs(score_a) >= min_abs_a)
    return {
        "side": side_a if confident else "unknown",
        "confident": bool(confident),
        "score_a": float(score_a),
        "score_b": float(score_b),
    }


def resolve_femur_sides(
    df_unique,
    study_col="study_id",
    a_col="score_a",
    b_col="score_b",
    min_abs_a=0.10,
    b_margin=0.08,
):
    """Сторона уникальных кадров.

    В исследовании из двух снимков порядок берётся по знаку A, если знаки разные
    и B этому порядку не противоречит. В остальных исследованиях нужны согласие A и B
    и |A| не меньше min_abs_a.
    """
    import pandas as pd

    side = pd.Series("unknown", index=df_unique.index, dtype=object)
    source = pd.Series("none", index=df_unique.index, dtype=object)

    for _, sub in df_unique.groupby(study_col):
        if len(sub) == 2:
            i1, i2 = sub.index
            a1, a2 = float(sub.loc[i1, a_col]), float(sub.loc[i2, a_col])
            b1, b2 = float(sub.loc[i1, b_col]), float(sub.loc[i2, b_col])
            if np.sign(a1) == 0 or np.sign(a2) == 0 or np.sign(a1) == np.sign(a2):
                continue
            b_contradicts = (np.sign(a1 - a2) == np.sign(b1 - b2)) and abs(b1 - b2) > b_margin
            if not b_contradicts:
                side[i1] = "R" if a1 > 0 else "L"
                side[i2] = "R" if a2 > 0 else "L"
                source[i1] = source[i2] = "pair"
            continue

        for index in sub.index:
            score_a = float(sub.loc[index, a_col])
            score_b = float(sub.loc[index, b_col])
            side_a = "R" if score_a > 0 else "L"
            side_b = "R" if score_b < 0 else "L"
            if side_a == side_b and abs(score_a) >= min_abs_a:
                side[index] = side_a
                source[index] = "single_AB"

    return side, source


def canonicalize_femur(arr, side):
    """Канонический вид — геометрия правого бедра. Левое зеркалится по горизонтали."""
    if side == "L":
        return np.ascontiguousarray(np.asarray(arr)[:, ::-1])
    return np.ascontiguousarray(arr)


def frame_height_mm(arr):
    return float(np.asarray(arr).shape[0] * PX_Y_MM)


def spine_axis_angle(arr, x_band_frac=0.6, y_trim=(0.08, 0.97), iters=2):
    """Модуль угла оси от вертикали изображения, в градусах."""
    height, width = arr.shape
    y0, y1 = int(height * y_trim[0]), int(height * y_trim[1])
    x_lo = int(width * (0.5 - x_band_frac / 2))
    x_hi = int(width * (0.5 + x_band_frac / 2))
    band = arr[y0:y1, :].astype(np.float64)
    mask = band > np.percentile(band, 78)

    xs, ys = [], []
    for y in range(mask.shape[0]):
        cols = np.where(mask[y])[0]
        cols = cols[(cols >= x_lo) & (cols <= x_hi)]
        if len(cols) < 2:
            continue
        xs.append(np.median(cols))
        ys.append(y)
    if len(xs) < 15:
        return float("nan")
    xs = np.asarray(xs, dtype=np.float64)
    ys = np.asarray(ys, dtype=np.float64)

    for _ in range(iters):
        xs_mm, ys_mm = xs * PX_X_MM, ys * PX_Y_MM
        slope, intercept = np.polyfit(ys_mm, xs_mm, 1)
        residual = np.abs(xs_mm - (slope * ys_mm + intercept))
        keep = residual < (np.median(residual) * 3 + 1e-6)
        if keep.sum() < 10:
            break
        xs, ys = xs[keep], ys[keep]

    xs_mm, ys_mm = xs * PX_X_MM, ys * PX_Y_MM
    slope, _ = np.polyfit(ys_mm, xs_mm, 1)
    return float(abs(np.degrees(np.arctan(slope))))


def best_f1_threshold(y_true, y_proba, default=0.5):
    from sklearn.metrics import precision_recall_curve

    y_true = np.asarray(y_true).astype(int)
    y_proba = np.asarray(y_proba, dtype=float)
    valid = np.isfinite(y_proba)
    y_true, y_proba = y_true[valid], y_proba[valid]
    if len(y_true) == 0 or y_true.sum() == 0 or y_true.sum() == len(y_true):
        return float(default)
    precision, recall, thresholds = precision_recall_curve(y_true, y_proba)
    if len(thresholds) == 0:
        return float(default)
    f1 = 2 * precision * recall / (precision + recall + 1e-9)
    return float(thresholds[int(np.nanargmax(f1[:-1]))])


def binary_metrics(y_true, y_pred):
    y_true = np.asarray(y_true).astype(int)
    y_pred = np.asarray(y_pred).astype(int)
    tp = int(((y_pred == 1) & (y_true == 1)).sum())
    fp = int(((y_pred == 1) & (y_true == 0)).sum())
    fn = int(((y_pred == 0) & (y_true == 1)).sum())
    tn = int(((y_pred == 0) & (y_true == 0)).sum())
    sens = tp / (tp + fn) if tp + fn else float("nan")
    spec = tn / (tn + fp) if tn + fp else float("nan")
    prec = tp / (tp + fp) if tp + fp else float("nan")
    f1 = 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else float("nan")
    return {
        "sens": sens,
        "spec": spec,
        "precision": prec,
        "f1": f1,
        "bal_acc": np.nanmean([sens, spec]),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
    }


def cluster_bootstrap(groups, stat_fn, n_boot=2000, seed=42):
    """Bootstrap по study_id: в повтор попадают все строки выбранного исследования."""
    groups = np.asarray(groups)
    uniq, inverse = np.unique(groups, return_inverse=True)
    members = [np.where(inverse == i)[0] for i in range(len(uniq))]
    rng = np.random.RandomState(seed)
    vals = []
    for _ in range(n_boot):
        pick = rng.randint(0, len(uniq), len(uniq))
        idx = np.concatenate([members[i] for i in pick])
        value = stat_fn(idx)
        if value is not None and np.isfinite(value):
            vals.append(float(value))
    point = stat_fn(np.arange(len(groups)))
    if len(vals) < 50:
        return point, float("nan"), float("nan"), len(vals)
    lo, hi = np.percentile(vals, [2.5, 97.5])
    return point, float(lo), float(hi), len(vals)


def evaluate_oof(y, oof, folds, groups, name="", n_boot=2000, seed=42, verbose=True):
    """Порог фолда k считается только по предсказаниям остальных фолдов.

    Порог развёртывания — медиана этих порогов.
    """
    from sklearn.metrics import roc_auc_score

    y = np.asarray(y).astype(int)
    oof = np.atleast_2d(np.asarray(oof, dtype=float))
    folds = np.atleast_2d(np.asarray(folds))
    repeats, n = oof.shape
    if folds.shape != oof.shape:
        raise ValueError(f"folds shape {folds.shape} != oof shape {oof.shape}")
    p_mean = np.nanmean(oof, axis=0)

    def auc_stat(idx):
        yy, pp = y[idx], p_mean[idx]
        valid = np.isfinite(pp)
        yy, pp = yy[valid], pp[valid]
        if len(yy) == 0 or len(np.unique(yy)) < 2:
            return float("nan")
        return roc_auc_score(yy, pp)

    auc, auc_lo, auc_hi, _ = cluster_bootstrap(groups, auc_stat, n_boot, seed)
    preds = np.zeros((repeats, n), dtype=int)
    fold_thresholds = [[] for _ in range(repeats)]

    for repeat in range(repeats):
        for fold in np.unique(folds[repeat]):
            val_mask = folds[repeat] == fold
            train_mask = ~val_mask
            thr = best_f1_threshold(y[train_mask], oof[repeat][train_mask])
            fold_thresholds[repeat].append(float(thr))
            preds[repeat][val_mask] = (oof[repeat][val_mask] >= thr).astype(int)

    out = {
        "name": name,
        "n": int(n),
        "n_pos": int(y.sum()),
        "auc": float(auc),
        "auc_lo": float(auc_lo),
        "auc_hi": float(auc_hi),
    }
    for metric in ["f1", "sens", "spec", "precision", "bal_acc"]:

        def stat(idx, metric=metric):
            vals = [binary_metrics(y[idx], preds[repeat][idx])[metric] for repeat in range(repeats)]
            if np.all(np.isnan(vals)):
                return float("nan")
            return float(np.nanmean(vals))

        value, lo, hi, _ = cluster_bootstrap(groups, stat, n_boot, seed + 1)
        out[metric] = float(value)
        out[metric + "_lo"] = float(lo)
        out[metric + "_hi"] = float(hi)

    all_fold_thresholds = [thr for group in fold_thresholds for thr in group if np.isfinite(thr)]
    out["deployed_threshold"] = float(np.median(all_fold_thresholds)) if all_fold_thresholds else 0.5
    out["fold_thresholds"] = fold_thresholds

    if verbose:
        print(f"[{name}] n={n}, positives={int(y.sum())}, CV repeats={repeats}")
        print(f"  ROC-AUC {auc:.3f} [{auc_lo:.3f}, {auc_hi:.3f}] (cluster bootstrap by study)")
        print(
            f"  F1 cross-fitted threshold {out['f1']:.3f} "
            f"[{out['f1_lo']:.3f}, {out['f1_hi']:.3f}]"
        )
        print(
            f"  sensitivity {out['sens']:.3f} [{out['sens_lo']:.3f}, {out['sens_hi']:.3f}] | "
            f"specificity {out['spec']:.3f} [{out['spec_lo']:.3f}, {out['spec_hi']:.3f}]"
        )
        print(
            "  deployment threshold = median of leave-fold-out thresholds: "
            f"{out['deployed_threshold']:.3f}"
        )
    return out


def roi_score_from_height(h_mm):
    """Монотонный скор для ранжирования ROI. Это не калиброванная вероятность."""
    lo, hi = ROI_SCORE_RANGE_MM
    height = np.asarray(h_mm, dtype=float)
    return float(np.clip(1.0 - (height - lo) / (hi - lo), 0.0, 1.0))


def roi_violation(h_mm, threshold_mm=FEMUR_ROI_MAX_HEIGHT_MM):
    return bool(float(h_mm) <= float(threshold_mm))


def load_thresholds(path=THRESHOLDS_PATH, must_exist=True):
    if not os.path.exists(path):
        if must_exist:
            raise FileNotFoundError(
                f"Нет {path}. Сначала выполните соответствующие train notebooks."
            )
        return {}
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def update_thresholds(new_values, path=THRESHOLDS_PATH):
    current = load_thresholds(path, must_exist=False)
    current.update({key: float(value) for key, value in new_values.items()})
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(current, handle, ensure_ascii=False, indent=2)
    return current


def rescale_score(score, threshold):
    """Переводит скор в [0, 1] так, чтобы порог threshold попал в 0.5."""
    threshold = float(np.clip(threshold, 1e-6, 1 - 1e-6))
    score = float(score)
    if score < threshold:
        return 0.5 * score / threshold
    return 0.5 + 0.5 * (score - threshold) / (1 - threshold)
