"""Скоринг DICOM. Тяжёлые функции подгружаются из inference.pipeline при первом обращении."""

_EXPORTS = (
    "load_models",
    "predict_single_dicom",
    "process_directory",
    "visualize_dicom",
)


def __getattr__(name):
    if name in _EXPORTS:
        from inference import pipeline

        return getattr(pipeline, name)
    raise AttributeError(name)


__all__ = list(_EXPORTS)
