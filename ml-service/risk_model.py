"""Shared contract between training and serving: feature order, threshold, and model loading."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import joblib
import numpy as np

# Features the trained model uses. completion_rate is excluded: it is closely tied to withdrawal,
# which is part of the outcome being predicted, so it would mostly leak the label.
FEATURE_NAMES: tuple[str, ...] = ('assessment_score', 'engagement')
AT_RISK_THRESHOLD = 0.5
CARD_FILENAME = 'model_card.json'


@dataclass(frozen=True)
class LoadedModel:
    estimator: Any
    card: dict[str, Any]


def load_model(model_dir: Path) -> LoadedModel | None:
    """Return the trained model described by model_card.json, or None when no trained model exists."""
    card_path = model_dir / CARD_FILENAME
    if not card_path.is_file():
        return None

    card: dict[str, Any] = json.loads(card_path.read_text(encoding='utf-8'))
    if tuple(card['feature_names']) != FEATURE_NAMES:
        raise RuntimeError('model_card.json feature_names do not match the service feature contract; retrain the model.')

    model_path = model_dir / card['model_file']
    estimator = joblib.load(model_path)
    return LoadedModel(estimator=estimator, card=card)


def score_features(estimator: Any, features: tuple[float, ...]) -> float:
    """Probability that the student ends in the at-risk outcome. Features must follow FEATURE_NAMES order."""
    row = np.asarray([features], dtype=float)
    return float(estimator.predict_proba(row)[0, 1])