"""
spc.py
======
Core Statistical Process Control calculations following the NHS Making Data
Count (MDC) methodology.

Supported chart types
---------------------
* ``"XmR"``  – Individuals / moving-range chart
* ``"p"``    – Proportion chart  (requires ``subgroup_sizes`` column)
* ``"u"``    – Counts-per-unit chart (requires ``subgroup_sizes`` column)
* ``"c"``    – Counts in a fixed population

NHS MDC Special-Cause rules implemented
----------------------------------------
1. **Rule 1 – Astronomical point**: a single value outside the 3-sigma
   process control limits (UCL / LCL).
2. **Rule 2 – Shift**: six or more consecutive points all above *or* all
   below the centre line (mean).
3. **Rule 3 – Trend**: five or more consecutive points all going up *or*
   all going down.

NHS Colour scheme
-----------------
* NHS Blue        ``#005EB8``  – mean line, improvement points
* NHS Dark Blue   ``#003087``  – control-limit lines
* NHS Orange      ``#ED8B00``  – concern points
* Grey            ``#768692``  – common-cause points
* NHS Warm Yellow ``#FFB81C``  – optional target line
* Light Blue      ``#41B6E6``  – optional shading (tolerance band)
* Pale Grey       ``#E8EDEE``  – optional shading (tolerance band)
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .utils import validate_data

# ---------------------------------------------------------------------------
# NHS colour constants
# ---------------------------------------------------------------------------
NHS_BLUE = "#005EB8"
NHS_DARK_BLUE = "#003087"
NHS_ORANGE = "#ED8B00"
NHS_GREY = "#768692"
NHS_WARM_YELLOW = "#FFB81C"
NHS_LIGHT_BLUE = "#41B6E6"
NHS_PALE_GREY = "#E8EDEE"

# Colour assigned to each point category
COLOUR_COMMON_CAUSE = NHS_GREY
COLOUR_IMPROVEMENT = NHS_BLUE
COLOUR_CONCERN = NHS_ORANGE

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def calculate_control_limits(
    data: pd.DataFrame,
    chart_type: str,
    value_col: str = "value",
    subgroup_col: str | None = "subgroup_size",
    numerator_col: str | None = None,
) -> pd.DataFrame:
    """Calculate mean and 3-sigma process control limits.

    Parameters
    ----------
    data : pd.DataFrame
        Input data.  Must contain at least the column specified by
        *value_col*.  For ``"p"`` and ``"u"`` charts it must also contain
        the column specified by *subgroup_col* (default ``"subgroup_size"``).
        Alternatively, supply *numerator_col* together with *subgroup_col* for
        ``"p"`` charts where ``value`` is the raw numerator count rather than
        the pre-computed proportion.
    chart_type : str
        One of ``"XmR"``, ``"p"``, ``"u"``, ``"c"``.
    value_col : str, optional
        Name of the column containing the measured values (default
        ``"value"``).
    subgroup_col : str or None, optional
        Name of the column containing subgroup / denominator sizes.  Required
        for ``"p"`` and ``"u"`` charts.  Defaults to ``"subgroup_size"``
        (ignored for ``"XmR"`` and ``"c"``).
    numerator_col : str or None, optional
        When provided for ``"p"`` charts, *value_col* is treated as the
        denominator and *numerator_col* as the count of events.  The
        proportion is then computed as ``numerator / value``.

    Returns
    -------
    pd.DataFrame
        A copy of *data* with additional columns:

        * ``mean``  – centre line (constant or per-point where varying
          subgroup sizes are used)
        * ``ucl``   – upper control limit
        * ``lcl``   – lower control limit

    Raises
    ------
    ValueError
        If *chart_type* is not one of the supported types.
    """
    chart_type = chart_type.strip().lower() if chart_type else chart_type
    _SUPPORTED = {"xmr", "p", "u", "c"}
    if chart_type not in _SUPPORTED:
        raise ValueError(
            f"Unsupported chart_type '{chart_type}'. "
            f"Must be one of: {sorted(_SUPPORTED)}"
        )

    # When numerator_col is provided for a p-chart, value_col is the denominator
    # (subgroup size), so validate it as the subgroup column.
    if chart_type == "p" and numerator_col is not None:
        validate_data(
            data,
            chart_type,
            value_col=numerator_col,
            subgroup_col=value_col,
        )
    else:
        validate_data(data, chart_type, value_col=value_col, subgroup_col=subgroup_col)

    result = data.copy()

    if chart_type == "xmr":
        result = _calc_xmr(result, value_col)
    elif chart_type == "p":
        result = _calc_p(result, value_col, subgroup_col, numerator_col)
    elif chart_type == "u":
        result = _calc_u(result, value_col, subgroup_col)
    elif chart_type == "c":
        result = _calc_c(result, value_col)

    # Ensure LCL is non-negative for count / proportion charts
    if chart_type in {"p", "u", "c"}:
        result["lcl"] = result["lcl"].clip(lower=0)

    return result


def detect_special_causes(
    result: pd.DataFrame,
    value_col: str = "value",
    mean_col: str = "mean",
    ucl_col: str = "ucl",
    lcl_col: str = "lcl",
) -> pd.DataFrame:
    """Detect special-cause variation using NHS MDC rules.

    Three rules are applied:

    * **Rule 1** – astronomical point: value outside control limits.
    * **Rule 2** – shift: ≥ 6 consecutive points on the same side of the mean.
    * **Rule 3** – trend: ≥ 5 consecutive points all increasing *or* all
      decreasing.

    Parameters
    ----------
    result : pd.DataFrame
        Output from :func:`calculate_control_limits` containing at least the
        columns *value_col*, *mean_col*, *ucl_col*, *lcl_col*.
    value_col : str, optional
        Name of the values column (default ``"value"``).
    mean_col : str, optional
        Name of the mean / centre-line column (default ``"mean"``).
    ucl_col : str, optional
        Name of the UCL column (default ``"ucl"``).
    lcl_col : str, optional
        Name of the LCL column (default ``"lcl"``).

    Returns
    -------
    pd.DataFrame
        A copy of *result* with additional boolean columns:

        * ``rule1`` – point is outside control limits
        * ``rule2`` – point is part of a run on one side of the mean
        * ``rule3`` – point is part of a run trend (up or down)
        * ``special_cause`` – True if **any** rule is triggered
    """
    df = result.copy()
    values = df[value_col].to_numpy(dtype=float)
    mean = df[mean_col].to_numpy(dtype=float)
    ucl = df[ucl_col].to_numpy(dtype=float)
    lcl = df[lcl_col].to_numpy(dtype=float)

    n = len(values)

    rule1 = _rule1_astronomical(values, ucl, lcl)
    rule2 = _rule2_shift(values, mean, run_length=6)
    rule3 = _rule3_trend(values, run_length=5)

    df["rule1"] = rule1
    df["rule2"] = rule2
    df["rule3"] = rule3
    df["special_cause"] = rule1 | rule2 | rule3

    return df


def determine_point_colours(
    result: pd.DataFrame,
    value_col: str = "value",
    mean_col: str = "mean",
    ucl_col: str = "ucl",
    lcl_col: str = "lcl",
    improvement_direction: str = "high",
    target: float | None = None,
) -> list[str]:
    """Determine the NHS MDC colour for every data point.

    Parameters
    ----------
    result : pd.DataFrame
        Output from :func:`detect_special_causes` which must contain the
        boolean flag columns ``rule1``, ``rule2``, ``rule3``,
        ``special_cause``.
    value_col : str, optional
        Column containing measured values (default ``"value"``).
    mean_col : str, optional
        Column containing the centre line (default ``"mean"``).
    ucl_col : str, optional
        Column containing the UCL (default ``"ucl"``).
    lcl_col : str, optional
        Column containing the LCL (default ``"lcl"``).
    improvement_direction : str, optional
        ``"high"`` if higher values are better (e.g. compliance rate) or
        ``"low"`` if lower values are better (e.g. error rate).
        Defaults to ``"high"``.
    target : float or None, optional
        Optional target value.  When supplied, special-cause points that
        move towards the target are coloured as improvement.

    Returns
    -------
    list of str
        A list of hex colour strings, one per row in *result*.

    Raises
    ------
    ValueError
        If *improvement_direction* is not ``"high"`` or ``"low"``.
    """
    if improvement_direction not in {"high", "low"}:
        raise ValueError(
            "improvement_direction must be 'high' or 'low', "
            f"got '{improvement_direction}'"
        )

    required_cols = {"rule1", "rule2", "rule3", "special_cause"}
    missing = required_cols - set(result.columns)
    if missing:
        raise ValueError(
            f"result is missing columns: {missing}.  "
            "Run detect_special_causes() first."
        )

    values = result[value_col].to_numpy(dtype=float)
    mean = result[mean_col].to_numpy(dtype=float)
    ucl = result[ucl_col].to_numpy(dtype=float)
    lcl = result[lcl_col].to_numpy(dtype=float)
    special_cause = result["special_cause"].to_numpy(dtype=bool)
    rule1 = result["rule1"].to_numpy(dtype=bool)
    rule2 = result["rule2"].to_numpy(dtype=bool)

    colours = []
    for i in range(len(values)):
        if not special_cause[i]:
            colours.append(COLOUR_COMMON_CAUSE)
            continue

        # Determine direction of the special cause
        is_high = _is_high_signal(
            values[i], mean[i], ucl[i], lcl[i], rule1[i], rule2[i], values, mean, i
        )

        if target is not None:
            # Override: classify based on proximity to target
            is_improvement = _towards_target(values[i], mean[i], target)
        elif improvement_direction == "high":
            is_improvement = is_high
        else:
            is_improvement = not is_high

        colours.append(COLOUR_IMPROVEMENT if is_improvement else COLOUR_CONCERN)

    return colours


# ---------------------------------------------------------------------------
# Chart-specific helpers
# ---------------------------------------------------------------------------


def _calc_xmr(df: pd.DataFrame, value_col: str) -> pd.DataFrame:
    """XmR (individuals / moving-range) chart calculations.

    Uses the debiasing constant ``d2 = 1.128`` for subgroup size of 2.
    ``UCL = mean + 3 / d2 * mean_mr``  which simplifies to
    ``mean ± 2.66 * mean_mr``.
    """
    values = df[value_col].to_numpy(dtype=float)
    mean_val = np.nanmean(values)
    moving_range = np.abs(np.diff(values))
    mean_mr = np.nanmean(moving_range)

    # 3 / d2 ≈ 2.659, rounded to 2.66 in NHS MDC guidance
    d2 = 1.128
    sigma_multiplier = 3.0 / d2

    df["mean"] = mean_val
    df["ucl"] = mean_val + sigma_multiplier * mean_mr
    df["lcl"] = mean_val - sigma_multiplier * mean_mr
    return df


def _calc_p(
    df: pd.DataFrame,
    value_col: str,
    subgroup_col: str | None,
    numerator_col: str | None,
) -> pd.DataFrame:
    """p-chart (proportion) calculations with varying subgroup sizes."""
    if numerator_col is not None:
        # value_col is the denominator; numerator_col holds event counts
        n = df[value_col].to_numpy(dtype=float)
        numerator = df[numerator_col].to_numpy(dtype=float)
        p_i = numerator / n
        p_bar = np.nansum(numerator) / np.nansum(n)
    else:
        n = df[subgroup_col].to_numpy(dtype=float)
        p_i = df[value_col].to_numpy(dtype=float)
        # Back-calculate totals from proportions and subgroup sizes
        p_bar = np.nansum(p_i * n) / np.nansum(n)

    sigma_i = np.sqrt(p_bar * (1 - p_bar) / n)

    df["mean"] = p_bar
    df["ucl"] = p_bar + 3 * sigma_i
    df["lcl"] = p_bar - 3 * sigma_i

    # Update value_col if numerator was provided (use proportion)
    if numerator_col is not None:
        df[value_col] = p_i

    return df


def _calc_u(
    df: pd.DataFrame,
    value_col: str,
    subgroup_col: str | None,
) -> pd.DataFrame:
    """u-chart (counts per unit) calculations with varying subgroup sizes."""
    n = df[subgroup_col].to_numpy(dtype=float)
    u_i = df[value_col].to_numpy(dtype=float)
    u_bar = np.nansum(u_i * n) / np.nansum(n)

    sigma_i = np.sqrt(u_bar / n)

    df["mean"] = u_bar
    df["ucl"] = u_bar + 3 * sigma_i
    df["lcl"] = u_bar - 3 * sigma_i
    return df


def _calc_c(df: pd.DataFrame, value_col: str) -> pd.DataFrame:
    """c-chart (counts in fixed population) calculations."""
    values = df[value_col].to_numpy(dtype=float)
    c_bar = np.nanmean(values)
    sigma = np.sqrt(c_bar)

    df["mean"] = c_bar
    df["ucl"] = c_bar + 3 * sigma
    df["lcl"] = c_bar - 3 * sigma
    return df


# ---------------------------------------------------------------------------
# Special-cause rule helpers
# ---------------------------------------------------------------------------


def _rule1_astronomical(
    values: np.ndarray,
    ucl: np.ndarray,
    lcl: np.ndarray,
) -> np.ndarray:
    """Rule 1 – single point outside 3-sigma control limits."""
    return (values > ucl) | (values < lcl)


def _rule2_shift(
    values: np.ndarray,
    mean: np.ndarray,
    run_length: int = 6,
) -> np.ndarray:
    """Rule 2 – run of *run_length* or more points on the same side of mean."""
    n = len(values)
    flags = np.zeros(n, dtype=bool)
    above = values > mean
    below = values < mean

    for start in range(n - run_length + 1):
        end = start + run_length
        segment_above = above[start:end]
        segment_below = below[start:end]
        if segment_above.all() or segment_below.all():
            flags[start:end] = True

    return flags


def _rule3_trend(values: np.ndarray, run_length: int = 5) -> np.ndarray:
    """Rule 3 – run of *run_length* or more consecutively increasing/decreasing."""
    n = len(values)
    flags = np.zeros(n, dtype=bool)
    diffs = np.diff(values)  # length n-1

    for start in range(n - run_length + 1):
        # We need (run_length - 1) consecutive diffs all same sign
        seg = diffs[start : start + run_length - 1]
        if (seg > 0).all() or (seg < 0).all():
            flags[start : start + run_length] = True

    return flags


# ---------------------------------------------------------------------------
# Colour-decision helpers
# ---------------------------------------------------------------------------


def _is_high_signal(
    value: float,
    mean: float,
    ucl: float,
    lcl: float,
    is_rule1: bool,
    is_rule2: bool,
    all_values: np.ndarray,
    all_means: np.ndarray,
    idx: int,
) -> bool:
    """Return True if the special-cause signal is in the *high* direction."""
    if is_rule1:
        return value > ucl
    # Rule 2 or 3: look at which side of mean the point is on
    return value > mean


def _towards_target(value: float, mean: float, target: float) -> bool:
    """Return True if *value* is closer to *target* than the mean is."""
    return abs(value - target) < abs(mean - target)
