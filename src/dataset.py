"""Dataset and transforms shared by training, evaluation and the web demo."""
import pandas as pd
import torch
from PIL import Image
from torch.utils.data import Dataset, WeightedRandomSampler
from torchvision import transforms as T

from config import IMAGE_SIZE, PROCESSED, ROOT

MEAN, STD = [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]

# No hue or saturation jitter: colour is the main ripeness cue, and shifting the hue
# would turn a green tomato into a red one while keeping the "unripe" label.
train_tf = T.Compose([
    T.RandomResizedCrop(IMAGE_SIZE, scale=(0.6, 1.0)),
    T.RandomHorizontalFlip(),
    T.RandomVerticalFlip(),
    T.RandomRotation(20, fill=255),
    T.ColorJitter(brightness=0.25, contrast=0.25),
    T.ToTensor(),
    T.Normalize(MEAN, STD),
])

eval_tf = T.Compose([
    T.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    T.ToTensor(),
    T.Normalize(MEAN, STD),
])


def load_manifest():
    return pd.read_csv(PROCESSED / "manifest.csv")


class RipenessDataset(Dataset):
    """Images are small, so they are decoded once and kept in memory."""

    def __init__(self, df: pd.DataFrame, transform):
        self.df = df.reset_index(drop=True)
        self.transform = transform
        self.images = [self._load(p) for p in self.df.path]

    @staticmethod
    def _load(path):
        img = Image.open(ROOT / path).convert("RGB")
        img.thumbnail((IMAGE_SIZE * 2, IMAGE_SIZE * 2))
        return img

    def __len__(self):
        return len(self.df)

    def __getitem__(self, i):
        return self.transform(self.images[i]), int(self.df.grade[i])


def balanced_sampler(df: pd.DataFrame, seed: int):
    """Draws every grade equally often; 'Ripe' would otherwise dominate (about 60% of images)."""
    counts = df.grade.value_counts()
    weights = df.grade.map(lambda g: 1.0 / counts[g]).to_numpy(copy=True)
    gen = torch.Generator().manual_seed(seed)
    return WeightedRandomSampler(torch.as_tensor(weights, dtype=torch.double), len(df), generator=gen)
