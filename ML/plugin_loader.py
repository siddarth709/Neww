import importlib.util
import sys

def load_module_from_path(path: str, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load a python module from {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module

def load_model_class(model_path: str, class_name: str):
    module = load_module_from_path(model_path, "user_model")
    if not hasattr(module, class_name):
        raise AttributeError(
            f" {class_name} not found in {model_path}"
            f"Available names: {[n for n in dir(module) if not n.startswith('_')]}"
    
        )

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