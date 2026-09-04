from pandas import offsets
import torch

def flatten_state_dict(state_dict) -> torch.Tensor:
    return torch.cat([v.flatten().float() for v in state_dict.values()])

def unflatten_into_state_dict(flat: torch.Tensor, reference_state_dict) -> dict:
    out = {}
    offset = 0
    for key, ref in reference_state_dict.items():
        numel = ref.numel()
        out[key] = flat[offset:offset + numel].view_as(ref).clone()
        offset += numel
    return out
    