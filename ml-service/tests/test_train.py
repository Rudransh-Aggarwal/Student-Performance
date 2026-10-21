import json

import pytest

from conftest import write_synthetic_csv
from training.train import read_dataset
from risk_model import FEATURE_NAMES


def test_card_records_contract_and_metrics(trained_model_dir):
    card = json.loads((trained_model_dir / 'model_card.json').read_text(encoding='utf-8'))

    assert card['feature_names'] == list(FEATURE_NAMES)
    assert card['data_is_synthetic'] is True
    assert card['test_metrics']['roc_auc'] > 0.5
    assert set(card['baseline_test_metrics']) == set(card['test_metrics'])
    assert (trained_model_dir / card['model_file']).is_file()


def test_read_dataset_rejects_out_of_range_features(tmp_path):
    bad = tmp_path / 'bad.csv'
    write_synthetic_csv(bad, rows=250)
    text = bad.read_text(encoding='utf-8').replace('100000,', '100000,1.5,', 1)
    bad.write_text(text, encoding='utf-8')
    with pytest.raises(ValueError):
        read_dataset(bad)


def test_read_dataset_requires_both_classes(tmp_path):
    single = tmp_path / 'single.csv'
    lines = ['student_id,assessment_score,engagement,completion_rate,at_risk']
    lines += [f'{i},0.5,0.5,0.5,0' for i in range(250)]
    single.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    with pytest.raises(ValueError, match='one outcome class'):
        read_dataset(single)
