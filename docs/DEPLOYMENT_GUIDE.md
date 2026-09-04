# Deployment Guide — Blockchain-Verified Neural Network Training

Everything here runs locally and costs **$0**. No cloud accounts, no API
keys with billing attached, no real crypto. Total setup time: ~15 minutes.

## 0. Prerequisites (all free)

- Node.js 18+ and npm
- Python 3.11+
- Docker Desktop (for Postgres + IPFS containers)
- Git

## 1. Start the local blockchain

```bash
cd contracts
npm install
npx hardhat node
```

Leave this running — it's your free local Ethereum network with 20
pre-funded test accounts (10,000 fake ETH each). No faucet, no real coins.

## 2. Deploy the contract

In a new terminal:

```bash
cd contracts
npx hardhat compile
npm run deploy:local
npm run register:local
```

This writes `backend/TrainingVerification.abi.json` and
`backend/contract_address.txt` automatically — the backend picks these up.

## 3. Start Postgres + IPFS (free, local containers)

```bash
cd infra
export CONTRACT_ADDRESS=$(cat ../backend/contract_address.txt)
docker compose up -d postgres ipfs
```

Check they're healthy:
```bash
docker compose ps
```

## 4. Run the backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Edit .env: set RPC_URL=http://127.0.0.1:8545 and CONTRACT_ADDRESS from step 2

uvicorn main:app --reload
```

Confirm it's up: open `http://localhost:8000/docs` (FastAPI's free
auto-generated API explorer).

## 5. Run the frontend

```bash
cd frontend
npm install
npm start
```

Opens at `http://localhost:3000`. The dashboard connects to the backend's
WebSocket automatically (`REACT_APP_WS_URL`, defaults to
`ws://localhost:8000/ws/dashboard`).

## 6. Run real federated training (recommended)

Nothing about the model or dataset is hardcoded — you declare both in a
YAML config and point it at your own Python files.

```bash
cd ml
pip install -r requirements.txt   # torch, torchvision, scikit-learn, numpy, pyyaml
python train_real.py --config configs/mnist_cnn.yaml
```

`configs/mnist_cnn.yaml` is a working example that uses the reference
plugins in `ml/examples/` (a small CNN + MNIST, auto-downloaded by
torchvision on first run — free, ~11MB, no signup). Each simulated node
trains that model on a real, disjoint data shard, computes a real weight
delta, and pushes it through the full commit → reveal → verify → aggregate
flow. One node (`malicious_nodes` in the config) runs a genuine
label-flipping + gradient-scaling poisoning attack so you can watch the
ensemble detector flag it and the trimmed-mean aggregation stay stable —
the strongest thing to show judges, since the accuracy curve and the
flagged-node behavior are both real, not scripted.

**To train your own model on your own data:** copy
`configs/mnist_cnn.yaml`, point `model_path` / `model_class` /
`dataset_path` at your own files, and run with `--config your_copy.yaml`.
Full plugin contract in `ml/configs/README.md` — no changes to the
pipeline code itself are needed.

`ml/simulate_nodes.py` is kept as a lighter-weight fallback if you just want
to sanity-check the dashboard/backend wiring without waiting on real
training (synthetic random gradients instead of real ones).

## 7. One-command version (optional)

If you'd rather not run five terminals:

```bash
docker compose -f infra/docker-compose.yml up -d
```

(Still need the Hardhat node running on the host — see step 1 — since it's
not containerized by default in this setup.)

## Troubleshooting

| Symptom | Fix |
|---|---|
| Backend can't reach the contract | Confirm `CONTRACT_ADDRESS` in `.env` matches `backend/contract_address.txt` |
| Dashboard shows "reconnecting…" | Backend isn't running, or `REACT_APP_WS_URL` points to the wrong port |
| `ipfs` container unhealthy | First boot can take ~30s to initialize the repo; check `docker compose logs ipfs` |
| Hardhat account "insufficient funds" | You're pointed at a real network by mistake — confirm `RPC_URL` is `127.0.0.1:8545`, not a public RPC |

## Going public (still free, optional)

If you want a shareable link for judges instead of localhost:
- **Frontend:** Vercel free tier (`vercel deploy`)
- **Backend:** Render.com free web service tier
- **Chain:** Sepolia testnet — free faucet ETH from `sepoliafaucet.com`, no real funds involved anywhere in this path
