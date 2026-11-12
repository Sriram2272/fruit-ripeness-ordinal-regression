"""Central configuration: paths, ripeness grades, and how each data source maps to a grade."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw"
FRUITS360 = RAW / "fruits360"
HF_BANANAS = RAW / "hf_bananas"
SELF_COLLECTED = DATA / "self_collected"
PROCESSED = DATA / "processed"
OUTPUTS = ROOT / "outputs"
MODELS = OUTPUTS / "models"
FIGURES = OUTPUTS / "figures"

# Ordinal ripeness scale. The order matters: 0 < 1 < 2 < 3.
GRADES = ["Unripe", "Turning", "Ripe", "Overripe"]
NUM_GRADES = len(GRADES)

# Fruits-360 folders whose fruit shows a clear ripeness stage. Folders whose colour
# comes from the cultivar rather than ripeness (Maroon, Yellow, Orange cherry, Red
# banana) are left out, because a yellow tomato is not "less ripe" than a red one.
FRUITS360_GRADES = {
    # tomato
    "Tomato 11": 0,            # fully green
    "Tomato 7": 1,             # orange-pink, breaker/turning
    "Tomato 10": 1,            # pale orange-pink
    "Tomato 1": 2,
    "Tomato 2": 2,
    "Tomato 3": 2,
    "Tomato 4": 2,
    "Tomato 5": 2,
    "Tomato Cherry Red 1": 2,
    "Tomato Heart 1": 2,
    "Tomato 8": 3,             # dark red, wrinkled
    "Tomato 9": 3,             # dark red, soft spots and rot
    # banana (Fruits-360 has no green banana; the extra subset fills grades 0-1)
    "Banana 1": 2,
    "Banana 2": 2,
    "Banana Lady Finger 1": 2,
    "Banana 3": 3,             # sugar spots, pale and soft
    "Banana 4": 3,             # brown/black peel
}

# Fruits-360 records each fruit while it rotates, so neighbouring frames are almost
# identical. Keeping every Nth frame removes near-duplicates and keeps CPU training fast.
FRUITS360_STRIDE = 3

IMAGE_SIZE = 112
SEED = 42
