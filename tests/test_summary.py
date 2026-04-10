#!/usr/bin/env python3
"""Test the new show_summary function."""

import pandas as pd
import numpy as np
from abspc import show_summary, plot_spc_chart
import matplotlib.pyplot as plt

# Generate sample data
np.random.seed(42)
dates = pd.date_range("2022-01-01", periods=24, freq="MS")
values = [50, 52, 48, 72, 51, 49, 50, 53, 52, 51, 48, 49, 
          65, 64, 66, 65, 63, 62, 64, 65, 64, 63, 62, 61]
df = pd.DataFrame({"date": dates, "value": values})

# Generate summary
summary = show_summary(
    df, 
    chart_type="XmR", 
    value_col="value", 
    x_col="date",
    improvement_direction="high"
)

# Display summary
print("=" * 80)
print(f"VARIATION: {summary['variation']}")
print(f"ASSURANCE: {summary['assurance']}")
print("-" * 80)
print(f"DATA POINTS: {summary['data_points']}")
print(f"MEAN: {summary['mean']:.2f}")
print(f"UCL: {summary['ucl']:.2f}")
print(f"LCL: {summary['lcl']:.2f}")
print("-" * 80)
print("RULES TRIGGERED:")
for rule, count in summary["rules_triggered"].items():
    print(f"  {rule}: {count}×")
print("-" * 80)
print(f"SIGNAL POINTS ({summary['total_signals']}):")
for point in summary["signal_points"][:5]:
    rules_str = ", ".join(point["rules"])
    print(f"  {point['x'].strftime('%Y-%m-%d')}: {point['value']:.2f} [{rules_str}]")
print("=" * 80)

# Show chart with new legend
fig, ax = plot_spc_chart(
    df,
    chart_type="XmR",
    value_col="value",
    x_col="date",
    title="XmR Chart with Improved Legend",
    xlabel="Month",
    ylabel="Value",
    improvement_direction="high",
    date_format="%b %Y",
    show_icons=True,
)
plt.tight_layout()
plt.savefig("test_legend.png", dpi=150, bbox_inches="tight")
print("\nChart saved as test_legend.png")
