"""
Loads a user's own model and dataset code at runtime from a file path, so
the training pipeline never hardcodes a specific architecture or dataset.

Contract your file needs to satisfy -- see ml/configs/README.md for the
full spec and ml/examples/ for a working reference implementation.

Model file must define:
    class <ModelClass>(nn.Module):
        def __init__(self):   # no required constructor args
            ...

Dataset file must define:
    def get_node_loaders(num_nodes: int, batch_size: int) -> list[DataLoader]
    def get_test_loader(batch_size: int) -> DataLoader
"""

import importlib.util
import sys


def load_module_from_path(path: str, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load a Python module from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def load_model_class(model_path: str, class_name: str):
    module = load_module_from_path(model_path, "user_model")
    if not hasattr(module, class_name):
        raise AttributeError(
            f"'{class_name}' not found in {model_path}. "
            f"Available names: {[n for n in dir(module) if not n.startswith('_')]}"
        )
    return getattr(module, class_name)


def load_dataset_module(dataset_path: str):
    module = load_module_from_path(dataset_path, "user_dataset")
    required = ["get_node_loaders", "get_test_loader"]
    missing = [fn for fn in required if not hasattr(module, fn)]
    if missing:
        raise AttributeError(
            f"{dataset_path} is missing required function(s): {missing}. "
            f"See ml/configs/README.md for the dataset plugin contract."
        )
    return module
