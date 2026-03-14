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

Quick start
-----------
>>> import pandas as pd
>>> from custom_spc_mdc import calculate_control_limits, detect_special_causes, plot_spc_chart
>>> data = pd.DataFrame({"value": [10, 12, 11, 15, 9, 13, 11, 14, 10, 12]})
>>> result = calculate_control_limits(data, chart_type="XmR")
>>> flags = detect_special_causes(result)
>>> plot_spc_chart(data, chart_type="XmR")
"""

from .spc import calculate_control_limits, detect_special_causes, determine_point_colours
from .plot import plot_spc_chart
from .utils import validate_data

__all__ = [
    "calculate_control_limits",
    "detect_special_causes",
    "determine_point_colours",
    "plot_spc_chart",
    "validate_data",
]

__version__ = "0.1.0"
