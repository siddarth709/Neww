from __future__ import annotations

import numpy as np
from dataclasses import dataclass
from sklearn.ensemble import IsolationForest
import torch
import torch.nn as nn


class GradientAutoencoder(nn.Module):
    """Learns the 'normal' distribution of flattened gradient vectors across
    honest nodes in early rounds; large reconstruction error later ⇒ likely
    poisoned or fabricated gradient."""

    def __init__(self, dim: int, latent: int = 32):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(dim, 256), nn.ReLU(),
            nn.Linear(256, latent),
        )
        self.decoder = nn.Sequential(
            nn.Linear(latent, 256), nn.ReLU(),
            nn.Linear(256, dim),
        )

    def forward(self, x):
        z = self.encoder(x)
        return self.decoder(z)

    def reconstruction_error(self, x: torch.Tensor) -> torch.Tensor:
        with torch.no_grad():
            recon = self.forward(x)
            return torch.mean((recon - x) ** 2, dim=-1)

@dataclass
class ValidationResult:
    node_id: str
    isolation_score: float      
    reconstruction_error: float
    cosine_to_mean: float
    combined_anomaly_score: float   
    is_malicious: bool


class GradientValidator:
    def __init__(self, gradient_dim: int, contamination: float = 0.1, threshold: float = 0.7):
        self.iforest = IsolationForest(contamination=contamination, random_state=42)
        self.autoencoder = GradientAutoencoder(gradient_dim)
        self.threshold = threshold
        self._fitted = False

    def fit_baseline(self, honest_gradients: np.ndarray):
        self.iforest.fit(honest_gradients)

        x = torch.tensor(honest_gradients, dtype=torch.float32)
        opt = torch.optim.Adam(self.autoencoder.parameters(), lr=1e-3)
        loss_fn = nn.MSELoss()
        for _ in range(50):
            opt.zero_grad()
            recon = self.autoencoder(x)
            loss = loss_fn(recon, x)
            loss.backward()
            opt.step()
        self._fitted = True

    def validate(self, node_id: str, gradient: np.ndarray, population_mean: np.ndarray) -> ValidationResult:
        if not self._fitted:
            raise RuntimeError("call fit_baseline() first")

        iso_raw = self.iforest.score_samples(gradient.reshape(1, -1))[0]
        iso_norm = 1 - _sigmoid(iso_raw)
        x = torch.tensor(gradient, dtype=torch.float32).unsqueeze(0)
        recon_err = self.autoencoder.reconstruction_error(x).item()

        cos_sim = _cosine_similarity(gradient, population_mean)
        cos_anomaly = 1 - max(cos_sim, 0)

        combined = 0.4 * iso_norm + 0.35 * min(recon_err, 1.0) + 0.25 * cos_anomaly

        return ValidationResult(
            node_id=node_id,
            isolation_score=iso_raw,
            reconstruction_error=recon_err,
            cosine_to_mean=cos_sim,
            combined_anomaly_score=combined,
            is_malicious=combined > self.threshold,
        )


def _sigmoid(x: float) -> float:
    return 1 / (1 + np.exp(-x))


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = (np.linalg.norm(a) * np.linalg.norm(b)) or 1e-9
    return float(np.dot(a, b) / denom)


def trimmed_mean_aggregate(gradients: np.ndarray, trim_fraction: float = 0.1) -> np.ndarray:
    """Coordinate-wise trimmed mean — drops the top/bottom trim_fraction of
    values per coordinate before averaging. Robust to a minority of poisoned
    submissions even if they weren't individually flagged.

    With a small node count, trim_fraction can round down to zero trimmed
    values and silently provide no protection — so we round up to at least
    one trimmed sample per side whenever there are enough nodes to still
    leave a non-empty middle after trimming (n > 2)."""
    n = gradients.shape[0]
    k = int(n * trim_fraction)
    if k == 0 and n > 2:
        k = 1
    sorted_grads = np.sort(gradients, axis=0)
    trimmed = sorted_grads[k: n - k] if n - 2 * k > 0 else sorted_grads
    return trimmed.mean(axis=0)


def reputation_weighted_fedavg(gradients: np.ndarray, reputations: np.ndarray) -> np.ndarray:
    """FedAvg where each node's contribution is scaled by its on-chain
    reputation (pulled from TrainingVerification.getReputation). Nodes with
    low/negative reputation contribute little or nothing."""
    weights = np.clip(reputations, 0, None).astype(float)
    if weights.sum() == 0:
        return gradients.mean(axis=0)
    weights = weights / weights.sum()
    return np.average(gradients, axis=0, weights=weights)