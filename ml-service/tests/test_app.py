import pytest
import app as ml_app
from fastapi.testclient import TestClient

PAYLOAD = {
    'student_id': 123,
    'features': {'assessment_score': 0.70, 'engagement': 0.45, 'completion_rate': 0.60},
}


def test_falls_back_to_baseline_without_trained_model(tmp_path, monkeypatch):
    monkeypatch.setattr(ml_app, 'MODEL_DIR', tmp_path)
    with TestClient(ml_app.app) as client:
        body = client.post('/predict', json=PAYLOAD).json()
        health = client.get('/model/health').json()

    assert body['model'] == 'rule-based-baseline-v1'
    assert body['risk_score'] == pytest.approx(0.55 * 0.3 + 0.25 * 0.55 + 0.20 * 0.4)
    assert health == {'loaded': False, 'model': 'rule-based-baseline-v1', 'trained': False}


def test_serves_trained_model_and_marks_synthetic(trained_model_dir, monkeypatch):
    monkeypatch.setattr(ml_app, 'MODEL_DIR', trained_model_dir)
    with TestClient(ml_app.app) as client:
        body = client.post('/predict', json=PAYLOAD).json()
        health = client.get('/model/health').json()

    assert body['model'].startswith('risk-')
    assert 0.0 <= body['risk_score'] <= 1.0
    assert body['prediction'] in {'at_risk', 'lower_risk'}
    assert 'SYNTHETIC' in body['warning']
    assert health['loaded'] is True and health['data_is_synthetic'] is True


def test_rejects_out_of_range_features(tmp_path, monkeypatch):
    monkeypatch.setattr(ml_app, 'MODEL_DIR', tmp_path)
    bad = {**PAYLOAD, 'features': {**PAYLOAD['features'], 'engagement': 1.2}}
    with TestClient(ml_app.app) as client:
        assert client.post('/predict', json=bad).status_code == 422

