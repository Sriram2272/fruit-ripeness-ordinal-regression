"""ResNet-18 backbone with two interchangeable heads.

ce     standard classifier: K logits -> softmax -> cross-entropy. Treats the grades as
       unrelated labels, so calling "Unripe" "Overripe" costs the same as calling it "Turning".
coral  ordinal regression (CORAL, Cao et al. 2020). K-1 binary questions "is grade > k?"
       that share one weight vector and differ only in their bias. Sharing the weights
       makes the K-1 answers rank-consistent, and the loss grows with the ordinal distance.
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision.models import ResNet18_Weights, resnet18

from config import NUM_GRADES


class CoralLayer(nn.Module):
    def __init__(self, in_features: int, num_classes: int):
        super().__init__()
        self.fc = nn.Linear(in_features, 1, bias=False)
        # Start the thresholds where an untrained model reproduces the (balanced) class prior:
        # P(grade > k) = (K-1-k)/K, i.e. biases logit(0.75), logit(0.5), logit(0.25) for K = 4.
        # Bunched-up thresholds (gaps of 1/3) leave the middle grades almost no room to be predicted.
        p = torch.arange(num_classes - 1, 0, -1).float() / num_classes
        self.bias = nn.Parameter(torch.log(p / (1 - p)))

    def forward(self, x):
        return self.fc(x) + self.bias          # (N, K-1) logits for P(grade > k)


class RipenessNet(nn.Module):
    def __init__(self, head: str = "coral", num_classes: int = NUM_GRADES, pretrained: bool = True):
        super().__init__()
        assert head in ("ce", "coral")
        self.head_type = head
        self.num_classes = num_classes
        backbone = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1 if pretrained else None)
        in_features = backbone.fc.in_features
        backbone.fc = nn.Identity()
        self.backbone = backbone
        self.head = nn.Linear(in_features, num_classes) if head == "ce" else CoralLayer(in_features, num_classes)

    def forward(self, x):
        return self.head(self.backbone(x))

    def loss(self, logits, y):
        if self.head_type == "ce":
            return F.cross_entropy(logits, y)
        return coral_loss(logits, y, self.num_classes)

    @torch.no_grad()
    def predict(self, logits):
        """Returns (predicted grade, class probabilities, expected grade as a 0..K-1 score)."""
        if self.head_type == "ce":
            probs = logits.softmax(1)
            pred = probs.argmax(1)
        else:
            gt = torch.sigmoid(logits)                      # P(grade > k), k = 0..K-2
            pred = (gt > 0.5).sum(1)
            ones = torch.ones_like(gt[:, :1])
            zeros = torch.zeros_like(gt[:, :1])
            cum = torch.cat([ones, gt, zeros], 1)            # P(grade > k-1) for k = 0..K
            probs = (cum[:, :-1] - cum[:, 1:]).clamp(min=0)
            probs = probs / probs.sum(1, keepdim=True)
        score = (probs * torch.arange(self.num_classes, device=probs.device)).sum(1)
        return pred, probs, score


def levels_from_labels(y, num_classes):
    """grade 2 of 4 -> [1, 1, 0]: the answers to 'grade > 0', 'grade > 1', 'grade > 2'."""
    return (y.unsqueeze(1) > torch.arange(num_classes - 1, device=y.device)).float()


def coral_loss(logits, y, num_classes):
    levels = levels_from_labels(y, num_classes)
    return F.binary_cross_entropy_with_logits(logits, levels, reduction="none").sum(1).mean()
