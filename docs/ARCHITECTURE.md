# Architecture

## Flow
1. A training node computes a local gradient update.
2. **Commit**: node submits `keccak256(gradientHash, nonce, address)` on-chain
   before revealing anything — prevents copying/adjusting another node's
   gradient after seeing it.
3. **Reveal**: node submits the real gradient hash + nonce; the contract
   checks it matches the commitment, then records the update and an IPFS CID
   pointing at the actual gradient payload.
4. The AIML ensemble validator (Isolation Forest + autoencoder + cosine
   similarity to the population mean) scores the revealed gradient.
5. Flagged gradients dock the node's on-chain reputation; chronic offenders
   are auto-suspended.
6. Aggregation uses a coordinate-wise trimmed mean (robust to gradients that
   evade detection) and weights each node's contribution by its live
   reputation.
7. The dashboard subscribes to a WebSocket feed of every step in real time.

## Why commit-reveal instead of full ZK-SNARKs
A real zk-SNARK circuit proving valid gradient computation is a multi-week
research effort. Commit-reveal gives the same core guarantee needed for a
hackathon-scoped demo — a node can't forge or copy a gradient after the fact
— in a fraction of the engineering time. A Circom/snarkjs circuit is listed
as an optional Expert-tier stretch goal in the deliverables breakdown.
