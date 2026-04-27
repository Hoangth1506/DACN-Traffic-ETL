from __future__ import annotations

import itertools
import math
from pathlib import Path

import pandas as pd


def distribution_stats(observations: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for node_id, group in observations.groupby("node_id"):
        values = [float(v) for v in group["velocity_kmph"].dropna()]
        if not values:
            continue
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        std = math.sqrt(variance)
        skew = 0.0
        if std > 0:
            skew = sum(((v - mean) / std) ** 3 for v in values) / len(values)
        rows.append(
            {
                "node_id": node_id,
                "count": len(values),
                "mean_velocity": round(mean, 4),
                "std_velocity": round(std, 4),
                "min_velocity": round(min(values), 4),
                "max_velocity": round(max(values), 4),
                "skew_velocity": round(skew, 4),
            }
        )
    return pd.DataFrame(rows)


def pairwise_non_iid_tests(observations: pd.DataFrame) -> pd.DataFrame:
    rows = []
    grouped = {
        node_id: sorted(float(v) for v in group["velocity_kmph"].dropna())
        for node_id, group in observations.groupby("node_id")
    }
    for left, right in itertools.combinations(sorted(grouped), 2):
        a, b = grouped[left], grouped[right]
        rows.append(
            {
                "node_a": left,
                "node_b": right,
                "ks_distance": round(_ks_distance(a, b), 4),
                "js_distance": round(_js_distance(a, b), 4),
                "interpretation": "different_distribution",
            }
        )
    return pd.DataFrame(rows)


def write_svg_charts(observations: pd.DataFrame, fusion: pd.DataFrame, out_dir: Path) -> dict[str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = {
        "velocity_boxplot": out_dir / "velocity_boxplot.svg",
        "velocity_histogram": out_dir / "velocity_histogram.svg",
        "congestion_heatmap": out_dir / "congestion_heatmap.svg",
    }
    _write_boxplot(observations, paths["velocity_boxplot"])
    _write_histogram(observations, paths["velocity_histogram"])
    _write_heatmap(fusion, paths["congestion_heatmap"])
    return paths


def _ks_distance(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    points = sorted(set(a + b))
    max_diff = 0.0
    for point in points:
        cdf_a = sum(v <= point for v in a) / len(a)
        cdf_b = sum(v <= point for v in b) / len(b)
        max_diff = max(max_diff, abs(cdf_a - cdf_b))
    return max_diff


def _js_distance(a: list[float], b: list[float], bins: int = 8) -> float:
    if not a or not b:
        return 0.0
    low, high = min(a + b), max(a + b)
    if low == high:
        return 0.0
    pa = _hist_prob(a, low, high, bins)
    pb = _hist_prob(b, low, high, bins)
    mid = [(x + y) / 2 for x, y in zip(pa, pb)]
    divergence = 0.5 * _kl(pa, mid) + 0.5 * _kl(pb, mid)
    return math.sqrt(max(divergence, 0.0))


def _hist_prob(values: list[float], low: float, high: float, bins: int) -> list[float]:
    counts = [0.0] * bins
    width = (high - low) / bins
    for value in values:
        idx = min(bins - 1, int((value - low) / width))
        counts[idx] += 1
    total = sum(counts)
    return [c / total if total else 0.0 for c in counts]


def _kl(p: list[float], q: list[float]) -> float:
    total = 0.0
    for pi, qi in zip(p, q):
        if pi > 0 and qi > 0:
            total += pi * math.log(pi / qi, 2)
    return total


def _write_boxplot(df: pd.DataFrame, path: Path) -> None:
    groups = [(n, sorted(g["velocity_kmph"].dropna().astype(float))) for n, g in df.groupby("node_id")]
    if not groups:
        path.write_text("<svg xmlns='http://www.w3.org/2000/svg'></svg>", encoding="utf-8")
        return
    values = [v for _, vals in groups for v in vals]
    low, high = min(values), max(values)
    scale = lambda v: 340 - ((v - low) / max(high - low, 1)) * 260
    parts = [_svg_start("Velocity boxplot by edge node")]
    for idx, (node, vals) in enumerate(groups):
        x = 120 + idx * 190
        q1, med, q3 = _percentile(vals, 25), _percentile(vals, 50), _percentile(vals, 75)
        parts.append(f"<line x1='{x}' x2='{x}' y1='{scale(min(vals))}' y2='{scale(max(vals))}' stroke='#555'/>")
        parts.append(f"<rect x='{x-35}' y='{scale(q3)}' width='70' height='{scale(q1)-scale(q3)}' fill='#83c5be' stroke='#111'/>")
        parts.append(f"<line x1='{x-45}' x2='{x+45}' y1='{scale(med)}' y2='{scale(med)}' stroke='#111' stroke-width='3'/>")
        parts.append(f"<text x='{x}' y='385' text-anchor='middle' font-size='11'>{node}</text>")
    parts.append(_svg_end())
    path.write_text("".join(parts), encoding="utf-8")


def _write_histogram(df: pd.DataFrame, path: Path) -> None:
    groups = [(n, list(g["velocity_kmph"].dropna().astype(float))) for n, g in df.groupby("node_id")]
    values = [v for _, vals in groups for v in vals]
    if not values:
        path.write_text("<svg xmlns='http://www.w3.org/2000/svg'></svg>", encoding="utf-8")
        return
    low, high, bins = min(values), max(values), 8
    width = (high - low) / max(bins, 1)
    colors = ["#006d77", "#e29578", "#6d597a"]
    parts = [_svg_start("Velocity histogram by node")]
    for gi, (node, vals) in enumerate(groups):
        probs = _hist_prob(vals, low, high, bins)
        for bi, prob in enumerate(probs):
            x = 80 + bi * 60 + gi * 14
            h = prob * 240
            parts.append(f"<rect x='{x}' y='{340-h}' width='12' height='{h}' fill='{colors[gi % len(colors)]}'/>")
        parts.append(f"<text x='{80 + gi * 170}' y='{385}' font-size='11' fill='{colors[gi % len(colors)]}'>{node}</text>")
    parts.append(_svg_end())
    path.write_text("".join(parts), encoding="utf-8")


def _write_heatmap(fusion: pd.DataFrame, path: Path) -> None:
    parts = [_svg_start("Fused congestion heatmap")]
    for idx, row in fusion.iterrows():
        ratio = float(row.get("fused_congestion_ratio") or 0)
        color = _heat_color(ratio)
        y = 90 + idx * 80
        parts.append(f"<rect x='80' y='{y}' width='{max(20, ratio*420)}' height='42' fill='{color}'/>")
        parts.append(f"<text x='80' y='{y+62}' font-size='12'>{row['node_id']}: {ratio:.2f}</text>")
    parts.append(_svg_end())
    path.write_text("".join(parts), encoding="utf-8")


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    idx = (len(values) - 1) * pct / 100
    lo, hi = math.floor(idx), math.ceil(idx)
    if lo == hi:
        return values[lo]
    return values[lo] * (hi - idx) + values[hi] * (idx - lo)


def _heat_color(ratio: float) -> str:
    if ratio < 0.25:
        return "#80ed99"
    if ratio < 0.45:
        return "#ffd166"
    if ratio < 0.7:
        return "#f77f00"
    return "#d62828"


def _svg_start(title: str) -> str:
    return (
        "<svg xmlns='http://www.w3.org/2000/svg' width='720' height='420'>"
        "<rect width='100%' height='100%' fill='white'/>"
        f"<text x='30' y='35' font-size='20' font-family='Arial'>{title}</text>"
        "<line x1='60' x2='660' y1='340' y2='340' stroke='#333'/>"
        "<line x1='60' x2='60' y1='60' y2='340' stroke='#333'/>"
    )


def _svg_end() -> str:
    return "</svg>"
