"""
Everything about a training run -- which model, which dataset, how many
nodes, learning rate, attack type, and so on -- is declared here, loaded
from a YAML file the user writes. Nothing about the run is hardcoded in
train_real.py itself.
"""

from dataclasses import dataclass
from typing import Optional
import yaml


@dataclass
class TrainingConfig:
    # --- required: point these at your own code ---
    model_path: str            # path to a .py file defining your nn.Module
    model_class: str           # name of the class inside that file
    dataset_path: str          # path to a .py file implementing the dataset contract

    # --- federation shape ---
    num_nodes: int = 6
    malicious_nodes: int = 0
    rounds: int = 15

    # --- local training hyperparameters (all user-set) ---
    local_epochs: int = 1
    learning_rate: float = 0.01
    batch_size: int = 32
    optimizer: str = "sgd"          # "sgd" | "adam"
    loss: str = "cross_entropy"     # "cross_entropy" | "mse" | "bce"

    # --- attack simulation (optional, for demoing the defenses) ---
    attack_type: str = "scale"      # "scale" | "label_flip" | "none"
    attack_scale: float = 8.0
    num_classes: Optional[int] = None   # required only for label_flip

    # --- verification / aggregation ---
    anomaly_threshold: float = 0.7
    projection_dim: int = 256
    trim_fraction: float = 0.1

    # --- infra ---
    backend_url: str = "http://localhost:8000"
    checkpoint_path: str = "models/global_model_final.pt"
    seed: int = 42

    @staticmethod
    def from_yaml(path: str) -> "TrainingConfig":
        with open(path) as f:
            data = yaml.safe_load(f) or {}
        known = {f for f in TrainingConfig.__dataclass_fields__}
        unknown = set(data) - known
        if unknown:
            raise ValueError(f"Unknown config key(s) in {path}: {sorted(unknown)}")
        return TrainingConfig(**data)
