import copy
import hashlib

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

from utils import flatten_state_dict, unflatten_into_state_dict

LOSS_FNS = {
    "cross_entropy": nn.CrossEntropyLoss,
    "mse": nn.MSELoss,
    "bce": nn.BCEWithLogitsLoss,
}


class federatedNode:
    def __init__(
        self,
        node_id: str,
        loader: DataLoader,
        model_class,
        loss: str = "cross_entropy",
        optimizer_name: str = "sgd",
        malicious: bool = False,
        attack_type: str = "scale",
        attack_scale: float = 8.0,
        num_classes=None,
        device: str = "cpu",
    ):
        if loss not in LOSS_FNS:
            raise ValueError(f"Unknown loss '{loss}'. Supported: {list(LOSS_FNS)}")
        if attack_type == "label_flip" and num_classes is None:
            raise ValueError("num_classes is required in the config when attack_type is 'label_flip'")

        self.node_id = node_id
        self.loader = loader
        self.model_class = model_class
        self.loss_name = loss
        self.optimizer_name = optimizer_name
        self.malicious = malicious
        self.attack_type = attack_type
        self.attack_scale = attack_scale
        self.num_classes = num_classes
        self.device = device

    def _build_optimizer(self, params, lr: float):
        if self.optimizer_name == "sgd":
            return optim.SGD(params, lr=lr, momentum=0.9)
        if self.optimizer_name == "adam":
            return optim.Adam(params, lr=lr)
        raise ValueError(f"Unknown optimizer '{self.optimizer_name}'. Supported: sgd, adam")

    def local_train(self, global_state_dict: dict, epochs: int = 1, lr: float = 0.01) -> np.ndarray:
        model = self.model_class().to(self.device)
        model.load_state_dict(copy.deepcopy(global_state_dict))
        model.train()

        optimizer = self._build_optimizer(model.parameters(), lr)
        criterion = LOSS_FNS[self.loss_name]()

        for _ in range(epochs):
            for x, y in self.loader:
                x, y = x.to(self.device), y.to(self.device)

                if self.malicious and self.attack_type == "label_flip":
                    y = self._label_flip(y)

                optimizer.zero_grad()
                out = model(x)
                loss = criterion(out, y)
                loss.backward()
                optimizer.step()

        local_flat = flatten_state_dict(model.state_dict())
        global_flat = flatten_state_dict(global_state_dict)
        delta = (local_flat - global_flat).detach().cpu().numpy()

        if self.malicious and self.attack_type == "scale":
            delta = delta * self.attack_scale

        return delta

    def _label_flip(self, y: torch.Tensor) -> torch.Tensor:
        return (y + 1) % self.num_classes

    @staticmethod
    def gradient_hash(vec: np.ndarray) -> str:
        return "0x" + hashlib.sha3_256(vec.tobytes()).hexdigest()

    @staticmethod
    def apply_delta(global_state_dict: dict, aggregated_delta: np.ndarray) -> dict:
        global_flat = flatten_state_dict(global_state_dict)
        new_flat = global_flat + torch.tensor(aggregated_delta, dtype=global_flat.dtype)
        return unflatten_into_state_dict(new_flat, global_state_dict)