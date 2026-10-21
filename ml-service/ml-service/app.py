import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from risk_model import AT_RISK_THRESHOLD, LoadedModel, load_model, score_features

BASELINE_MODEL_ID = 'rule-based-baseline-v1'
BASELINE_WARNING = 'This heuristic has not been trained or validated as a predictive model.'
MODEL_DIR = Path(os.environ.get('MODEL_DIR', Path(__file__).resolve().parent / 'models'))


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.model = load_model(MODEL_DIR)
    yield


app = FastAPI(title='Student Performance Prediction ML Service', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class PredictionFeatures(BaseModel):
    assessment_score: float = Field(ge=0, le=1)
    engagement: float = Field(ge=0, le=1)
    completion_rate: float = Field(ge=0, le=1)


class PredictionInput(BaseModel):
    student_id: int | None = Field(default=None, description='Dataset student ID if available.')
    features: PredictionFeatures


def _loaded_model() -> LoadedModel | None:
    return getattr(app.state, 'model', None)


def _trained_warning(card: dict[str, Any]) -> str:
    warning = (
        'Trained on a sample of OULAD records and checked on a held-out split. It estimates end-of-course '
        'outcomes from full-course data, so it is not an early-warning system and has not been externally '
        'validated. Do not use it for decisions about students.'
    )
    if card.get('data_is_synthetic'):
        return 'SYNTHETIC TRAINING DATA (pipeline test only, not real results). ' + warning
    return warning


def _baseline_risk(features: PredictionFeatures) -> float:
    return (
        0.55 * (1 - features.assessment_score)
        + 0.25 * (1 - features.engagement)
        + 0.20 * (1 - features.completion_rate)
    )


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.get('/ready')
def ready() -> dict[str, str]:
    return {'status': 'ready'}


@app.get('/model/health')
def model_health() -> dict[str, Any]:
    loaded = _loaded_model()
    if loaded is None:
        return {'loaded': False, 'model': BASELINE_MODEL_ID, 'trained': False}
    card = loaded.card
    return {
        'loaded': True,
        'trained': True,
        'model': card['model_version'],
        'trained_at': card['trained_at'],
        'data_is_synthetic': card.get('data_is_synthetic', False),
        'test_roc_auc': card['test_metrics']['roc_auc'],
    }


@app.post('/predict')
def predict(payload: PredictionInput) -> dict[str, Any]:
    features = payload.features
    loaded = _loaded_model()

    if loaded is None:
        risk_score = _baseline_risk(features)
        model_id, warning = BASELINE_MODEL_ID, BASELINE_WARNING
    else:
        risk_score = score_features(
            loaded.estimator,
            (features.assessment_score, features.engagement),
        )
        model_id, warning = loaded.card['model_version'], _trained_warning(loaded.card)

    prediction = 'at_risk' if risk_score >= AT_RISK_THRESHOLD else 'lower_risk'
    return {
        'student_id': payload.student_id,
        'prediction': prediction,
        'risk_score': round(risk_score, 4),
        'model': model_id,
        'warning': warning,
    }
