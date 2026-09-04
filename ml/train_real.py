"""
Runs real federated training end-to-end, using a model and dataset YOU
supply via a YAML config -- nothing about the architecture, dataset, or
hyperparameters is hardcoded here.

Usage:
    python train_real.py --config configs/mnist_cnn.yaml

To train your own model on your own data, copy configs/mnist_cnn.yaml,
point model_path/model_class and dataset_path at your own files, and run
with --config pointing at your copy. See configs/README.md for the exact
contract your files need to satisfy.
"""

import argparse
import os

import numpy as np
import requests
import torch

from config import TrainingConfig
from plugin_loader import load_model_class, load_dataset_module
from federated_node import FederatedNode
from gradient_validator import GradientValidator, trimmed_mean_aggregate, reputation_weighted_fedavg
from utils import flatten_state_dict
from projection import RandomProjector


def evaluate(model, test_loader, device="cpu") -> float:
    model.eval()
    correct, total = 0, 0
    with torch.no_grad():
        for x, y in test_loader:
            x, y = x.to(device), y.to(device)
            preds = model(x).argmax(dim=1)
            correct += (preds == y).sum().item()
            total += y.size(0)
    return correct / total if total > 0 else float("nan")


def post(backend_url: str, path: str, payload: dict):
    try:
        requests.post(f"{backend_url}{path}", json=payload, timeout=10)
    except requests.RequestException as e:
        print(f"[warn] backend call {path} failed (continuing without it): {e}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True, help="Path to a YAML training config (see configs/)")
    args = parser.parse_args()

    cfg = TrainingConfig.from_yaml(args.config)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Config: {args.config}")
    print(f"Model: {cfg.model_class} from {cfg.model_path}")
    print(f"Dataset: {cfg.dataset_path}")
    print(f"Device: {device}  |  nodes={cfg.num_nodes}  malicious={cfg.malicious_nodes}  rounds={cfg.rounds}")

    # --- load the user's own model + dataset code, nothing hardcoded ---
    ModelClass = load_model_class(cfg.model_path, cfg.model_class)
    dataset_module = load_dataset_module(cfg.dataset_path)

    node_loaders = dataset_module.get_node_loaders(cfg.num_nodes, cfg.batch_size)
    test_loader = dataset_module.get_test_loader(cfg.batch_size)

    node_ids = [f"0xNODE{str(i).zfill(3)}{'0'*33}"[:42] for i in range(cfg.num_nodes)]
    rng = np.random.default_rng(cfg.seed)
    malicious_set = set(
        rng.choice(cfg.num_nodes, size=min(cfg.malicious_nodes, cfg.num_nodes), replace=False).tolist()
    ) if cfg.malicious_nodes > 0 else set()

    nodes = [
        FederatedNode(
            node_id=node_ids[i],
            loader=node_loaders[i],
            model_class=ModelClass,
            loss=cfg.loss,
            optimizer_name=cfg.optimizer,
            malicious=(i in malicious_set),
            attack_type=cfg.attack_type,
            attack_scale=cfg.attack_scale,
            num_classes=cfg.num_classes,
            device=device,
        )
        for i in range(cfg.num_nodes)
    ]

    global_model = ModelClass().to(device)
    global_state = global_model.state_dict()
    param_dim = flatten_state_dict(global_state).numel()
    print(f"Model has {param_dim:,} parameters (this is the on-chain gradient vector length)")

    projector = RandomProjector(input_dim=param_dim, output_dim=cfg.projection_dim, seed=cfg.seed)
    validator = GradientValidator(gradient_dim=cfg.projection_dim, threshold=cfg.anomaly_threshold)
    reputations = {nid: 100.0 for nid in node_ids}

    for round_id in range(cfg.rounds):
        print(f"\n=== Round {round_id} ===")
        deltas = []

        for node in nodes:
            delta = node.local_train(global_state, epochs=cfg.local_epochs, lr=cfg.learning_rate)
            deltas.append(delta)

            g_hash = FederatedNode.gradient_hash(delta)
            nonce = int(rng.integers(0, 1_000_000))
            post(cfg.backend_url, "/commitGradient", {"node_address": node.node_id, "gradient_hash": g_hash, "nonce": nonce})
            post(cfg.backend_url, "/revealGradient", {
                "node_address": node.node_id, "gradient_hash": g_hash, "nonce": nonce,
                "ipfs_cid": f"bafy-round{round_id}-{node.node_id[:8]}", "round_id": round_id,
            })

        deltas = np.array(deltas)
        projected = np.array([projector.project(d) for d in deltas])
        pop_mean_proj = projected.mean(axis=0)

        if round_id == 0:
            validator.fit_baseline(projected)

        flags = []
        for i, node in enumerate(nodes):
            result = validator.validate(node.node_id, projected[i], pop_mean_proj)
            flags.append(result.is_malicious)

            if result.is_malicious:
                reputations[node.node_id] = max(-150, reputations[node.node_id] - 25)
            else:
                reputations[node.node_id] = min(200, reputations[node.node_id] + 5)

            post(cfg.backend_url, "/verifyUpdate", {
                "node_address": node.node_id, "round_id": round_id, "update_index": i,
                "anomaly_score": result.combined_anomaly_score, "is_malicious": bool(result.is_malicious),
                "reason": "ensemble anomaly score above threshold" if result.is_malicious else None,
            })

            tag = "FLAGGED" if result.is_malicious else "ok"
            actual = "malicious" if node.malicious else "honest"
            print(f"  {node.node_id[:10]}... [{actual:9}] score={result.combined_anomaly_score:.3f} rep={reputations[node.node_id]:.0f} [{tag}]")

        all_flagged = all(flags)
        clean_deltas = deltas if all_flagged else np.array([d for d, f in zip(deltas, flags) if not f])
        rep_array = (
            np.array([reputations[n.node_id] for n in nodes])
            if all_flagged
            else np.array([reputations[n.node_id] for n, f in zip(nodes, flags) if not f])
        )

        trimmed = trimmed_mean_aggregate(clean_deltas, trim_fraction=cfg.trim_fraction)
        aggregated = reputation_weighted_fedavg(clean_deltas, rep_array)

        global_state = FederatedNode.apply_delta(global_state, aggregated)
        global_model.load_state_dict(global_state)

        acc = evaluate(global_model, test_loader, device=device)
        print(f"  round {round_id} global model test accuracy: {acc*100:.2f}%")

        accepted = sum(1 for f in flags if not f)
        rejected = sum(1 for f in flags if f)
        post(cfg.backend_url, "/finalizeRound", {"round_id": round_id, "accepted": accepted, "rejected": rejected, "accuracy": acc})

    os.makedirs(os.path.dirname(cfg.checkpoint_path) or ".", exist_ok=True)
    torch.save(global_model.state_dict(), cfg.checkpoint_path)
    print(f"\nSaved final model to {cfg.checkpoint_path}")


if __name__ == "__main__":
    main()
