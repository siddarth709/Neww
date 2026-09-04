"""
Generic, model-agnostic helpers for turning ANY PyTorch model's state_dict
into a flat vector (for hashing/committing/aggregating) and back. Nothing
here assumes a specific architecture -- works for whatever nn.Module the
user plugs in via their own model config.
"""

import torch


def flatten_state_dict(state_dict) -> torch.Tensor:
    """Flatten every parameter tensor into one 1-D vector -- this is what
    gets hashed for the on-chain commitment and fed to the aggregation
    functions."""
    return torch.cat([v.flatten().float() for v in state_dict.values()])


def unflatten_into_state_dict(flat: torch.Tensor, reference_state_dict) -> dict:
    """Inverse of flatten_state_dict -- rebuilds a state_dict with the same
    shapes as reference_state_dict from a flat vector (e.g. an aggregated
    update coming back from the server)."""
    out = {}
    offset = 0
    for key, ref in reference_state_dict.items():
        numel = ref.numel()
        out[key] = flat[offset: offset + numel].view_as(ref).clone()
        offset += numel
    return out
