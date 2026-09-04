"""
Real model weight-deltas can have tens of thousands of dimensions — too many
to run Isolation Forest / an autoencoder on efficiently or reliably. A fixed
random projection (Johnson-Lindenstrauss-style) compresses each delta down to
a manageable size for *scoring* while the full-dimensional vector is still
what actually gets aggregated into the global model. The projection matrix
is seeded so every node's contribution in a round is projected consistently.
"""

import numpy as np


class RandomProjector:
    def __init__(self, input_dim: int, output_dim: int = 256, seed: int = 42):
        rng = np.random.default_rng(seed)
        # Scaled Gaussian random projection — preserves relative distances well
        # enough for anomaly scoring purposes (Johnson–Lindenstrauss).
        self.matrix = rng.normal(0, 1 / np.sqrt(output_dim), size=(input_dim, output_dim))

    def project(self, vec: np.ndarray) -> np.ndarray:
        return vec @ self.matrix
