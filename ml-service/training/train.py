"""Train and evaluate the at-risk outcome model on the features exported by data-service.

Usage (from ml-service/):
    python training/train.py --data data/training_features.csv --models-dir models --version v2
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import sklearn
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline, make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from risk_model import AT_RISK_THRESHOLD, CARD_FILENAME, FEATURE_NAMES  # noqa: E402

LABEL = 'at_risk'
# Every feature in the exported CSV, in column order. The model uses only FEATURE_NAMES;
# the baseline comparison uses all of them, because the original rule weighted completion_rate.
CSV_FEATURES: tuple[str, ...] = ('assessment_score', 'engagement', 'completion_rate')
MODEL_COLUMNS = [CSV_FEATURES.index(name) for name in FEATURE_NAMES]
MIN_ROWS = 200
OULAD_CITATION = (
    'Kuzilek J., Hlosta M., Zdrahal Z. Open University Learning Analytics dataset. '
    'Sci. Data 4:170171 (2017). doi:10.1038/sdata.2017.171'
)


def read_dataset(path: Path) -> tuple[np.ndarray, np.ndarray, int]:
    with path.open(newline='', encoding='utf-8') as handle:
        reader = csv.DictReader(handle)
        missing = {*CSV_FEATURES, LABEL} - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f'{path} is missing columns: {sorted(missing)}')

        features: list[list[float]] = []
        labels: list[int] = []
        for line_number, row in enumerate(reader, start=2):
            values = [float(row[name]) for name in CSV_FEATURES]
            if any(not 0.0 <= value <= 1.0 for value in values):
                raise ValueError(f'{path}:{line_number}: feature outside [0, 1]')
            label = int(row[LABEL])
            if label not in (0, 1):
                raise ValueError(f'{path}:{line_number}: {LABEL} must be 0 or 1')
            features.append(values)
            labels.append(label)

    x = np.asarray(features, dtype=float)
    y = np.asarray(labels, dtype=int)
    if len(y) < MIN_ROWS:
        raise ValueError(f'Need at least {MIN_ROWS} rows to train; found {len(y)}.')
    if len(np.unique(y)) < 2:
        raise ValueError('Training data contains only one outcome class.')
    return x, y, len(y)


def candidate_models(seed: int) -> dict[str, Pipeline | DecisionTreeClassifier]:
    return {
        'logistic_regression': make_pipeline(
            StandardScaler(),
            LogisticRegression(class_weight='balanced', max_iter=1000, random_state=seed),
        ),
        'decision_tree': DecisionTreeClassifier(
            max_depth=3, min_samples_leaf=20, class_weight='balanced', random_state=seed
        ),
    }


def classification_metrics(y_true: np.ndarray, probabilities: np.ndarray) -> dict[str, Any]:
    predicted = (probabilities >= AT_RISK_THRESHOLD).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, predicted, labels=[0, 1]).ravel()
    return {
        'roc_auc': round(float(roc_auc_score(y_true, probabilities)), 4),
        'accuracy': round(float(accuracy_score(y_true, predicted)), 4),
        'precision': round(float(precision_score(y_true, predicted, zero_division=0)), 4),
        'recall': round(float(recall_score(y_true, predicted, zero_division=0)), 4),
        'f1': round(float(f1_score(y_true, predicted, zero_division=0)), 4),
        'brier': round(float(brier_score_loss(y_true, probabilities)), 4),
        'confusion_matrix': {'tn': int(tn), 'fp': int(fp), 'fn': int(fn), 'tp': int(tp)},
    }


def baseline_probabilities(x_all: np.ndarray) -> np.ndarray:
    """The original rule-based weights (assessment 55%, engagement 25%, completion 20%), for comparison only."""
    assessment, engagement, completion = x_all[:, 0], x_all[:, 1], x_all[:, 2]
    return np.clip(0.55 * (1 - assessment) + 0.25 * (1 - engagement) + 0.20 * (1 - completion), 0.0, 1.0)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--data', type=Path, default=ROOT / 'data' / 'training_features.csv')
    parser.add_argument('--models-dir', type=Path, default=ROOT / 'models')
    parser.add_argument('--version', default='v2')
    parser.add_argument('--test-size', type=float, default=0.2)
    parser.add_argument('--seed', type=int, default=42)
    args = parser.parse_args()

    x_all, y, row_count = read_dataset(args.data)
    x_train_all, x_test_all, y_train, y_test = train_test_split(
        x_all, y, test_size=args.test_size, stratify=y, random_state=args.seed
    )
    x_train = x_train_all[:, MODEL_COLUMNS]
    x_test = x_test_all[:, MODEL_COLUMNS]

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=args.seed)
    cv_results: dict[str, float] = {}
    for name, estimator in candidate_models(args.seed).items():
        scores = cross_val_score(estimator, x_train, y_train, cv=cv, scoring='roc_auc')
        cv_results[name] = round(float(scores.mean()), 4)

    best_name = max(cv_results, key=cv_results.__getitem__)
    best = candidate_models(args.seed)[best_name]
    best.fit(x_train, y_train)

    test_probabilities = best.predict_proba(x_test)[:, 1]
    test_metrics = classification_metrics(y_test, test_probabilities)
    baseline_metrics = classification_metrics(y_test, baseline_probabilities(x_test_all))

    synthetic = False
    meta_path = args.data.with_suffix('.meta.json')
    if meta_path.is_file():
        synthetic = bool(json.loads(meta_path.read_text(encoding='utf-8')).get('synthetic', False))

    args.models_dir.mkdir(parents=True, exist_ok=True)
    model_file = f'risk_model_{args.version}.joblib'
    joblib.dump(best, args.models_dir / model_file)

    coefficients = None
    if best_name == 'logistic_regression':
        coefficients = {
            name: round(float(weight), 4)
            for name, weight in zip(FEATURE_NAMES, best[-1].coef_[0], strict=True)
        }

    excluded = [name for name in CSV_FEATURES if name not in FEATURE_NAMES]
    card: dict[str, Any] = {
        'model_version': f'risk-{args.version}',
        'model_file': model_file,
        'model_type': best_name,
        'trained_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'sklearn_version': sklearn.__version__,
        'feature_names': list(FEATURE_NAMES),
        'excluded_features': excluded,
        'threshold': AT_RISK_THRESHOLD,
        'label_definition': 'at_risk = 1 if any enrollment ended in Fail or Withdrawn, else 0',
        'data_file': args.data.name,
        'data_is_synthetic': synthetic,
        'dataset_rows': row_count,
        'split': {'test_size': args.test_size, 'seed': args.seed, 'train_rows': len(y_train), 'test_rows': len(y_test)},
        'cv_roc_auc': cv_results,
        'test_metrics': test_metrics,
        'baseline_test_metrics': baseline_metrics,
        'coefficients_standardized': coefficients,
        'limitations': [
            'Retrospective: features cover the whole course, so this is not an early-warning model.',
            'completion_rate is excluded because it is closely tied to withdrawal, the outcome being predicted.',
            'Single sample of OULAD students; not externally validated or tested on other institutions.',
            'Gender, region, deprivation band and disability are excluded by design.',
        ],
        'citation': OULAD_CITATION,
    }
    (args.models_dir / CARD_FILENAME).write_text(json.dumps(card, indent=2) + '\n', encoding='utf-8')

    print(f'Trained {best_name} on {len(y_train)} rows; tested on {len(y_test)} rows.')
    print(f'Features used: {list(FEATURE_NAMES)}; excluded: {excluded}')
    print(f'CV ROC-AUC: {cv_results}')
    print(f'Test metrics: {test_metrics}')
    print(f'Rule-based baseline test metrics: {baseline_metrics}')
    if synthetic:
        print('WARNING: training data is SYNTHETIC. These results only test the pipeline.')
    print(f'Saved {args.models_dir / model_file} and {args.models_dir / CARD_FILENAME}')


if __name__ == '__main__':
    main()