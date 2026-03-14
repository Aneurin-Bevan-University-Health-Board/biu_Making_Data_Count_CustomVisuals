"""
custom_spc_mdc
==============
A Python package for Statistical Process Control (SPC) charts following
the NHS Making Data Count (MDC) methodology.

Supported chart types
---------------------
* ``"XmR"``  – Individuals / moving-range chart
* ``"p"``    – Proportion chart
* ``"u"``    – Counts-per-unit chart
* ``"c"``    – Counts in a fixed population
* ``"run"``  – Basic run chart (median centre line, no control limits)

Quick start
-----------
>>> import pandas as pd
>>> from custom_spc_mdc import plot_spc_chart, plot_run_chart
>>> data = pd.DataFrame({"value": [10, 12, 11, 15, 9, 13, 11, 14, 10, 12]})
>>> plot_spc_chart(data, chart_type="XmR")
>>> plot_run_chart(data)
"""

from .spc import (
    calculate_control_limits,
    detect_special_causes,
    detect_run_chart_signals,
    rebase_control_limits,
    determine_point_colours,
)
from .plot import plot_spc_chart, plot_run_chart
from .utils import validate_data

__all__ = [
    "calculate_control_limits",
    "detect_special_causes",
    "detect_run_chart_signals",
    "rebase_control_limits",
    "determine_point_colours",
    "plot_spc_chart",
    "plot_run_chart",
    "validate_data",
]

__version__ = "0.1.0"
