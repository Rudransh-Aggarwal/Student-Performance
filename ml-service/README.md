# ML Service

FastAPI service that scores students' end-of-course outcome risk. It loads a trained model from `models/` when one exists; otherwise it falls back to the rule-based baseline.

## Train the model

Training uses features exported by data-service from the OULAD sample (see `data-service/README.md`).

```bash
# from data-service/ (needs the OULAD CSVs in data/oulad/)
npm run export:training -- --students 1000 --seed 42
# from ml-service/
pip install -r requirements-dev.txt
python training/train.py --data data/training_features.csv --models-dir models --version v1
python -m pytest -q
```

`train.py` compares logistic regression and a shallow decision tree by 5-fold ROC-AUC on the training split, refits the winner, and evaluates it once on a held-out 20% split. It writes `models/risk_model_<version>.joblib` and `models/model_card.json` (metrics, baseline comparison, coefficients, limitations). The same rule-based baseline is scored on the same test split for comparison.

If the export is built from synthetic data (`SYNTHETIC_DATA.txt` present), the card is flagged `data_is_synthetic` and the API warning says so. Synthetic results only test the pipeline.

## Run locally

1. `cd ml-service`
2. `python -m venv .venv`
3. `./.venv/Scripts/activate` (Windows) or `source .venv/bin/activate` (macOS/Linux)
4. `pip install -r requirements.txt`
5. `uvicorn app:app --host 0.0.0.0 --port 5000`

Set `MODEL_DIR` to load models from another folder.

## Endpoints

- `GET /health`, `GET /ready`
- `GET /model/health`: whether a trained model is loaded, its version and test ROC-AUC
- `POST /predict`: requires `assessment_score`, `engagement`, and `completion_rate`, each 0–1. Returns `prediction` (`at_risk` if the risk score is at least 0.5), `risk_score`, `model` and `warning`.

The model is retrospective (it uses whole-course features), so it is not an early-warning system. It has not been externally validated and must not be used for decisions about students.

## Example

```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"student_id":123,"features":{"assessment_score":0.70,"engagement":0.45,"completion_rate":0.60}}'
```
