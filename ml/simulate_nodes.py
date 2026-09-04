"""
Simulates N training nodes submitting gradients through the full commit-reveal
flow, with one node optionally seeded as malicious (submits a poisoned/adversarial
gradient). Drives real traffic through the backend so the dashboard has live
data during a demo — no cloud services required.

Usage:
    python simulate_nodes.py --nodes 5 --malicious 1 --rounds 10
"""

import argparse
import hashlib
import time
import numpy as np
import requests

from gradient_validator import GradientValidator, trimmed_mean_aggregate, reputation_weighted_fedavg

BACKEND_URL = "http://localhost:8000"
GRADIENT_DIM = 128


def fake_gradient(malicious: bool, rng: np.random.Generator) -> np.ndarray:
    base = rng.normal(0, 1, GRADIENT_DIM)
    if malicious:
        # Poisoned gradient: large-magnitude, adversarially-directed spike
        base = base * 15 + rng.normal(5, 1, GRADIENT_DIM)
    return base


def gradient_hash(vec: np.ndarray) -> str:
    return "0x" + hashlib.sha3_256(vec.tobytes()).hexdigest()


def run_round(round_id: int, node_ids: list[str], malicious_idx: set[int], validator: GradientValidator, rng):
    gradients = []
    for i, node in enumerate(node_ids):
        grad = fake_gradient(malicious=i in malicious_idx, rng=rng)
        gradients.append(grad)

        g_hash = gradient_hash(grad)
        nonce = int(rng.integers(0, 1_000_000))

        # Step 1: commit
        try:
            requests.post(f"{BACKEND_URL}/commitGradient", json={
                "node_address": node, "gradient_hash": g_hash, "nonce": nonce,
            }, timeout=5)
        except requests.RequestException as e:
            print(f"[warn] commit failed for {node}: {e}")

        # Step 2: reveal
        try:
            requests.post(f"{BACKEND_URL}/revealGradient", json={
                "node_address": node, "gradient_hash": g_hash, "nonce": nonce,
                "ipfs_cid": f"bafy-simulated-{round_id}-{i}", "round_id": round_id,
            }, timeout=5)
        except requests.RequestException as e:
            print(f"[warn] reveal failed for {node}: {e}")

    gradients = np.array(gradients)
    pop_mean = gradients.mean(axis=0)

    if round_id == 0:
        validator.fit_baseline(gradients)

    # Step 3: validate + push verification results
    for i, node in enumerate(node_ids):
        result = validator.validate(node, gradients[i], pop_mean)
        try:
            requests.post(f"{BACKEND_URL}/verifyUpdate", json={
                "node_address": node, "round_id": round_id, "update_index": i,
                "anomaly_score": result.combined_anomaly_score,
                "is_malicious": result.is_malicious,
                "reason": "ensemble anomaly score above threshold" if result.is_malicious else None,
            }, timeout=5)
        except requests.RequestException as e:
            print(f"[warn] verify failed for {node}: {e}")

        tag = "FLAGGED" if result.is_malicious else "ok"
        print(f"  round {round_id} | {node[:10]}… | score={result.combined_anomaly_score:.3f} [{tag}]")

    aggregated = trimmed_mean_aggregate(gradients)
    print(f"  round {round_id} aggregated (trimmed-mean) norm={np.linalg.norm(aggregated):.3f}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--nodes", type=int, default=5)
    parser.add_argument("--malicious", type=int, default=1)
    parser.add_argument("--rounds", type=int, default=10)
    parser.add_argument("--delay", type=float, default=1.5, help="seconds between rounds, for a watchable demo")
    args = parser.parse_args()

    rng = np.random.default_rng(42)
    node_ids = [f"0xSIM{str(i).zfill(4)}{'0'*30}"[:42] for i in range(args.nodes)]
    malicious_idx = set(rng.choice(args.nodes, size=min(args.malicious, args.nodes), replace=False).tolist())

    print(f"Simulating {args.nodes} nodes, {len(malicious_idx)} malicious, {args.rounds} rounds")
    validator = GradientValidator(gradient_dim=GRADIENT_DIM)

    for r in range(args.rounds):
        run_round(r, node_ids, malicious_idx, validator, rng)
        time.sleep(args.delay)


if __name__ == "__main__":
    main()
