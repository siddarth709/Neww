# Bringing your own model and dataset

Nothing about the architecture, dataset, or hyperparameters is hardcoded in
`train_real.py` -- you declare all of it in a YAML config and point it at
your own Python files. `ml/examples/` is a *reference* plugin (MNIST + a
small CNN), not a dependency.

## 1. Write your model file

Any file defining an `nn.Module` subclass with a no-required-args
constructor:

```python
# my_model.py
import torch.nn as nn

class MyModel(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Linear(784, 10)

    def forward(self, x):
        return self.net(x)
```

## 2. Write your dataset file

Must define exactly these two functions:

```python
# my_dataset.py
from torch.utils.data import DataLoader

def get_node_loaders(num_nodes: int, batch_size: int) -> list[DataLoader]:
    """Return one DataLoader per simulated node, each yielding (x, y) batches."""
    ...

def get_test_loader(batch_size: int) -> DataLoader:
    """Return a single held-out DataLoader used to score the global model
    after each round."""
    ...
```

How you split data across nodes is entirely up to you -- IID, Dirichlet
non-IID, or real per-organization data silos. `ml/examples/mnist_dataset.py`
shows a simple IID split as a starting point.

## 3. Write your config

Copy `configs/mnist_cnn.yaml`, point `model_path` / `model_class` /
`dataset_path` at your files, and set your hyperparameters:

```yaml
model_path: my_model.py
model_class: MyModel
dataset_path: my_dataset.py

num_nodes: 8
rounds: 20
local_epochs: 2
learning_rate: 0.005
optimizer: adam
loss: cross_entropy
```

Every field in `TrainingConfig` (see `ml/config.py`) is overridable this way
-- nothing needs to be edited in the pipeline code itself.

## 4. Run it

```bash
python train_real.py --config my_config.yaml
```

## Notes

- **Loss/attack compatibility:** `attack_type: label_flip` assumes integer
  class labels and requires `num_classes` in the config. For regression or
  other label formats, use `attack_type: scale` (or `none`) instead.
- **Model size:** the anomaly detector projects your full parameter vector
  down to `projection_dim` (default 256) before scoring, so this pipeline
  scales to much larger models than the tiny example CNN -- the full
  vector is still what actually gets aggregated into the global model.
- **Non-classification models:** `evaluate()` in `train_real.py` currently
  assumes classification accuracy (`argmax` + label match). For a
  regression model, swap in your own metric there.
