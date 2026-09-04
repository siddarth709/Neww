# Blockchain-Verified Neural Network Training

A decentralized platform that verifies distributed neural-network gradient
contributions using a commit-reveal proof-of-learning scheme on-chain, an
ensemble anomaly detector, and Byzantine-robust, reputation-weighted
aggregation. Built entirely on free/open-source tooling — $0 to run.

See `docs/DEPLOYMENT_GUIDE.md` to get running in ~15 minutes, and
`docs/ARCHITECTURE.md` for the design rationale.

## Structure
- `contracts/` — Solidity commit-reveal verification contract (Hardhat)
- `backend/` — FastAPI relay + WebSocket event broadcast
- `ml/` — config-driven federated training (`train_real.py` + `configs/`) — bring your own model and dataset, nothing hardcoded; ensemble gradient validator; robust aggregation; a lightweight synthetic-data simulator for quick wiring checks; `examples/` holds a reference MNIST plugin, `configs/README.md` documents the plugin contract
- `frontend/` — React monitoring dashboard
- `infra/` — docker-compose for local Postgres + IPFS
- `docs/` — architecture + deployment docs
