import csv
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def write_synthetic_csv(path: Path, rows: int = 400, seed: int = 0) -> None:
    rng = np.random.default_rng(seed)
    with path.open('w', newline='', encoding='utf-8') as handle:
        writer = csv.writer(handle)
        writer.writerow(['student_id', 'assessment_score', 'engagement', 'completion_rate', 'at_risk'])
        for index in range(rows):
            scores = rng.uniform(0, 1, size=3)
            latent = 1.5 * (1 - scores[0]) + 0.8 * (1 - scores[1]) + 0.6 * (1 - scores[2])
            at_risk = int(rng.uniform() < 1 / (1 + np.exp(-(latent - 1.5) * 4)))
            writer.writerow([100000 + index, *(f'{value:.6f}' for value in scores), at_risk])


@pytest.fixture(scope='session')
def trained_model_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    workdir = tmp_path_factory.mktemp('trained')
    data = workdir / 'training_features.csv'
    write_synthetic_csv(data)
    (workdir / 'training_features.meta.json').write_text('{"synthetic": true}', encoding='utf-8')
    models = workdir / 'models'
    subprocess.run(
        [sys.executable, str(ROOT / 'training' / 'train.py'), '--data', str(data), '--models-dir', str(models)],
        check=True,
        capture_output=True,
        text=True,
    )
    return models
