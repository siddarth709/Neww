"""
EXAMPLE dataset plugin -- a reference implementation, not something the
pipeline depends on. Splits MNIST across N simulated nodes (free, ~11MB,
auto-downloaded by torchvision on first run, no signup, no cost).

Contract (see configs/README.md for full details):
    get_node_loaders(num_nodes: int, batch_size: int) -> list[DataLoader]
    get_test_loader(batch_size: int) -> DataLoader

Copy this file to point at your own dataset -- CIFAR10, a custom
torchvision-compatible dataset, or your own Dataset subclass -- and
train_real.py will use it with zero changes elsewhere.
"""

import torch
from torch.utils.data import DataLoader, Subset
from torchvision import datasets, transforms

DATASET_DIR = "./data"


def load_dataset(train: bool = True):
    transform = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize((0.1307,), (0.3081,)),
    ])
    return datasets.MNIST(root=DATASET_DIR, train=train, download=True, transform=transform)


def partition_iid(dataset, num_nodes: int, seed: int = 42) -> list[Subset]:
    """IID split — each node gets a random, roughly-equal shard. Good enough
    for a demo; swap in a Dirichlet non-IID split later if you want to show
    the system handling heterogeneous data too."""
    g = torch.Generator().manual_seed(seed)
    n = len(dataset)
    perm = torch.randperm(n, generator=g).tolist()
    shard_size = n // num_nodes
    shards = []
    for i in range(num_nodes):
        idx = perm[i * shard_size: (i + 1) * shard_size]
        shards.append(Subset(dataset, idx))
    return shards


def get_node_loaders(num_nodes: int, batch_size: int = 32) -> list[DataLoader]:
    train_set = load_dataset(train=True)
    shards = partition_iid(train_set, num_nodes)
    return [DataLoader(shard, batch_size=batch_size, shuffle=True) for shard in shards]


def get_test_loader(batch_size: int = 256) -> DataLoader:
    test_set = load_dataset(train=False)
    return DataLoader(test_set, batch_size=batch_size, shuffle=False)
