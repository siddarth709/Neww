import numpy as np

class RandomProjector:
    def __init__(self, input_dim: int, output_dim: int = 256, seed: int = 42):
        rng = np.random.default_rng(seed)
        self.matrix = rng.normal(0, 1 / np.sqrt(output_dim), size = (input_dim, output_dim))

    def project(self, vec: np.ndarray) -> np.ndarray:
        return vec @ self.matrix
    