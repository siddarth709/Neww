from dataclasses import dataclass
from typing import Optional
import yaml


@dataclass
class TrainingConfig:
    model_path: str        
    model_class: str          
    dataset_path: str          

    num_nodes: int = 6
    malicious_nodes: int = 0
    rounds: int = 15

    local_epochs: int = 1
    learning_rate: float = 0.01
    batch_size: int = 32
    optimizer: str = "sgd"          
    loss: str = "cross_entropy"    

    attack_type: str = "scale"     
    attack_scale: float = 8.0
    num_classes: Optional[int] = None 

    anomaly_threshold: float = 0.7
    projection_dim: int = 256
    trim_fraction: float = 0.1

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