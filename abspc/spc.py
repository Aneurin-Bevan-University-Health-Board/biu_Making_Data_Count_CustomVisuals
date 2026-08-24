"""
spc.py
======
Core Statistical Process Control calculations following the NHS Making Data
Count (MDC) methodology.  Rules are aligned with the NHSRplotthedots R
package (https://github.com/nhs-r-community/NHSRplotthedots).

Supported chart types
---------------------
* ``"XmR"``  – Individuals / moving-range chart
* ``"p"``    – Proportion chart  (requires ``subgroup_sizes`` column)
* ``"u"``    – Counts-per-unit chart (requires ``subgroup_sizes`` column)
* ``"c"``    – Counts in a fixed population
* ``"t"``    – Time-between rare events (Nelson Y^(1/3.6) transformation)
* ``"g"``    – Opportunities-between rare events (geometric distribution)
* ``"run"``  – Basic run chart (median centre line, no control limits)

NHS MDC Special-Cause rules implemented (SPC charts)
------------------------------------------------------
1. **Rule 1 – Astronomical point**: a single value outside the 3-sigma
   process control limits (UCL / LCL).
2. **Rule 2 – Shift**: **eight** or more consecutive points all above *or*
   all below the centre line (mean).
3. **Rule 3 – Trend**: **six** or more consecutive points all going up *or*
   all going down.
4. **Rule 4 – Two-in-three**: two out of three consecutive points in the
   warning zone (between 2-sigma and 3-sigma limits) on the same side.

Run-chart signals (run chart only)
-----------------------------------
* **Shift**: eight or more consecutive points on the same side of the median.
* **Trend**: six or more consecutive points all increasing *or* all
  decreasing.

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

# Minimum number of data points recommended for reliable SPC analysis
SPC_MIN_DATA_POINTS = 15

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
        One of ``"XmR"``, ``"p"``, ``"u"``, ``"c"``, ``"t"``, ``"g"``, ``"run"``.
        ``"i"`` / ``"I"`` are accepted as aliases of ``"XmR"`` (an Individuals
        chart is mathematically identical to an XmR chart) and are normalised
        to ``"xmr"`` internally.
    value_col : str, optional
        Name of the column containing the measured values (default
        ``"value"``).
    subgroup_col : str or None, optional
        Name of the column containing subgroup / denominator sizes.  Required
        for ``"p"`` and ``"u"`` charts.  Defaults to ``"subgroup_size"``
        (ignored for ``"XmR"``, ``"c"``, and ``"run"``).
    numerator_col : str or None, optional
        When provided for ``"p"`` charts, *value_col* is treated as the
        denominator and *numerator_col* as the count of events.  The
        proportion is then computed as ``numerator / value``.

    Returns
    -------
    pd.DataFrame
        A copy of *data* with additional columns:

        * ``mean``  – centre line (constant or per-point where varying
          subgroup sizes are used); for ``"run"`` charts this is the median.
        * ``ucl``   – upper control limit (absent for ``"run"`` charts)
        * ``lcl``   – lower control limit (absent for ``"run"`` charts)
        * ``uwl``   – upper warning limit at 2-sigma (absent for ``"run"``)
        * ``lwl``   – lower warning limit at 2-sigma (absent for ``"run"``)

    Raises
    ------
    ValueError
        If *chart_type* is not one of the supported types.
    """
    chart_type = chart_type.strip().lower() if chart_type else chart_type
    # An I (Individuals) chart is mathematically identical to an XmR chart.
    if chart_type == "i":
        chart_type = "xmr"
    _SUPPORTED = {"xmr", "p", "u", "c", "t", "g", "run"}
    if chart_type not in _SUPPORTED:
        raise ValueError(
            f"Unsupported chart_type '{chart_type}'. "
            f"Must be one of: {sorted(_SUPPORTED)}"
        )

    # When numerator_col is provided for a p-chart, value_col is the denominator
    # (subgroup size), so validate it as the subgroup column.
    if chart_type == "run":
        validate_data(data, "xmr", value_col=value_col, subgroup_col=None)
    elif chart_type == "p" and numerator_col is not None:
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
    elif chart_type == "t":
        result = _calc_t(result, value_col)
    elif chart_type == "g":
        result = _calc_g(result, value_col)
    elif chart_type == "run":
        result = _calc_run(result, value_col)

    # Ensure LCL is non-negative for count / proportion charts
    if chart_type in {"p", "u", "c", "t", "g"}:
        result["lcl"] = result["lcl"].clip(lower=0)
        result["lwl"] = result["lwl"].clip(lower=0)

    return result


def detect_special_causes(
    result: pd.DataFrame,
    value_col: str = "value",
    mean_col: str = "mean",
    ucl_col: str = "ucl",
    lcl_col: str = "lcl",
    uwl_col: str = "uwl",
    lwl_col: str = "lwl",
) -> pd.DataFrame:
    """Detect special-cause variation using NHS MDC rules.

    Four rules are applied (aligned with NHSRplotthedots / NHS MDC):

    * **Rule 1** – astronomical point: value outside 3-sigma control limits.
    * **Rule 2** – shift: ≥ 8 consecutive points on the same side of the mean.
    * **Rule 3** – trend: ≥ 6 consecutive points all increasing *or* all
      decreasing.
    * **Rule 4** – two-in-three: two out of three consecutive points in the
      warning zone (between 2-sigma and 3-sigma), on the same side of the mean.
      Only applied when *uwl_col* / *lwl_col* are present in *result*.

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
    uwl_col : str, optional
        Name of the upper warning-limit column (default ``"uwl"``).  Rule 4
        is skipped when this column is absent.
    lwl_col : str, optional
        Name of the lower warning-limit column (default ``"lwl"``).  Rule 4
        is skipped when this column is absent.

    Returns
    -------
    pd.DataFrame
        A copy of *result* with additional boolean columns:

        * ``rule1`` – point is outside control limits
        * ``rule2`` – point is part of a run on one side of the mean
        * ``rule3`` – point is part of a run trend (up or down)
        * ``rule4`` – point is part of a 2-in-3 warning-zone cluster
          (only set when warning limits are present)
        * ``special_cause`` – True if **any** rule is triggered
    """
    df = result.copy()
    values = df[value_col].to_numpy(dtype=float)
    mean = df[mean_col].to_numpy(dtype=float)
    ucl = df[ucl_col].to_numpy(dtype=float)
    lcl = df[lcl_col].to_numpy(dtype=float)

    rule1 = _rule1_astronomical(values, ucl, lcl)
    rule2 = _rule2_shift(values, mean, run_length=8)
    rule3 = _rule3_trend(values, run_length=6)

    df["rule1"] = rule1
    df["rule2"] = rule2
    df["rule3"] = rule3

    has_warning_limits = uwl_col in df.columns and lwl_col in df.columns
    if has_warning_limits:
        uwl = df[uwl_col].to_numpy(dtype=float)
        lwl = df[lwl_col].to_numpy(dtype=float)
        rule4 = _rule4_two_in_three(values, mean, ucl, lcl, uwl, lwl)
        df["rule4"] = rule4
        df["special_cause"] = rule1 | rule2 | rule3 | rule4
    else:
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
    rule3 = result["rule3"].to_numpy(dtype=bool)

    colours = []
    for i in range(len(values)):
        if not special_cause[i]:
            colours.append(COLOUR_COMMON_CAUSE)
            continue

        # Determine direction of the special cause
        is_high = _is_high_signal(
            values[i], mean[i], ucl[i], lcl[i],
            rule1[i], rule2[i], rule3[i],
            values, mean, i,
        )

        if target is not None:
            # Target-aware classification: a special-cause point is an
            # improvement if it sits on the favourable side of the target
            # (per *improvement_direction*) OR moves in the favourable
            # direction relative to the mean.  This avoids mis-colouring
            # points that have already passed the target on the right side.
            if improvement_direction == "high":
                is_improvement = (values[i] >= target) or is_high
            else:
                is_improvement = (values[i] <= target) or (not is_high)
        elif improvement_direction == "high":
            is_improvement = is_high
        else:
            is_improvement = not is_high

        colours.append(COLOUR_IMPROVEMENT if is_improvement else COLOUR_CONCERN)

    return colours


def detect_run_chart_signals(
    result: pd.DataFrame,
    value_col: str = "value",
    median_col: str = "mean",
) -> pd.DataFrame:
    """Detect signals in a run chart using NHS MDC run-chart rules.

    Two rules are applied against the **median** centre line:

    * **Run shift**: ≥ 8 consecutive points on the same side of the median.
    * **Run trend**: ≥ 6 consecutive points all increasing *or* all decreasing.

    Parameters
    ----------
    result : pd.DataFrame
        Output from :func:`calculate_control_limits` with ``chart_type="run"``.
        Must contain *value_col* and *median_col* (default ``"mean"``).
    value_col : str, optional
        Name of the values column (default ``"value"``).
    median_col : str, optional
        Name of the median / centre-line column (default ``"mean"``).

    Returns
    -------
    pd.DataFrame
        A copy of *result* with additional boolean columns:

        * ``run_shift``  – point is part of an 8+ run on one side of the median
        * ``run_trend``  – point is part of a 6+ consecutive up/down trend
        * ``run_signal`` – True if **either** rule is triggered
    """
    df = result.copy()
    values = df[value_col].to_numpy(dtype=float)
    median = df[median_col].to_numpy(dtype=float)

    run_shift = _rule2_shift(values, median, run_length=8)
    run_trend = _rule3_trend(values, run_length=6)

    df["run_shift"] = run_shift
    df["run_trend"] = run_trend
    df["run_signal"] = run_shift | run_trend

    return df


def rebase_control_limits(
    data: pd.DataFrame,
    chart_type: str,
    improvement_direction: str = "high",
    value_col: str = "value",
    subgroup_col: str | None = "subgroup_size",
    numerator_col: str | None = None,
    min_phase_length: int = 8,
    rebase_on: str = "improvement",
    baseline: int = 15,
) -> pd.DataFrame:
    """Calculate control limits with automatic phase rebasing on a sustained shift.

    When a sustained shift (≥ *min_phase_length* consecutive points on one
    side of the current mean) is detected, control limits are recalculated
    from the start of that shift forward.  The process repeats iteratively so
    that multiple successive phases are all captured.  The *rebase_on*
    parameter controls which direction of shift triggers a rebase and
    *baseline* sets how many points must accumulate within a phase before a
    rebase is permitted.

    Parameters
    ----------
    data : pd.DataFrame
        Input data — same requirements as :func:`calculate_control_limits`.
    chart_type : str
        One of ``"XmR"``, ``"p"``, ``"u"``, ``"c"``, ``"t"``, ``"g"``
        (case-insensitive).  ``"i"`` / ``"I"`` are accepted as aliases of
        ``"XmR"`` and normalised to ``"xmr"`` internally.  ``"run"`` is not
        supported.
    improvement_direction : str, optional
        ``"high"`` (default) or ``"low"`` — direction in which improvement
        lies.
    value_col : str, optional
        Column containing measured values (default ``"value"``).
    subgroup_col : str or None, optional
        Column containing subgroup sizes (required for ``"p"`` and ``"u"``).
    numerator_col : str or None, optional
        For ``"p"`` charts: column with event counts when *value_col* is the
        denominator.
    min_phase_length : int, optional
        Minimum consecutive points on one side of the mean required to trigger
        a rebase (default ``8``, aligned with Rule 2 / the NHS MDC shift rule).
    rebase_on : str, optional
        Which direction of sustained shift triggers a rebase (default
        ``"improvement"``):

        * ``"improvement"`` – only shifts in *improvement_direction*.
        * ``"worsening"``   – only shifts away from *improvement_direction*.
        * ``"any"``         – a sustained run on *either* side of the mean
          (the earliest qualifying shift is used).
    baseline : int, optional
        Minimum number of points that must accumulate within a phase before an
        auto-rebase is permitted (default ``15``).  Implemented as a search
        offset: a shift starting before *baseline* points into a phase is
        absorbed into the baseline rather than triggering a new phase.

    Returns
    -------
    pd.DataFrame
        A copy of *data* with the usual ``mean``, ``ucl``, ``lcl``,
        ``uwl``, ``lwl`` columns (recalculated per phase) plus:

        * ``rebase_phase`` – integer phase index (0 = baseline, 1 = first
          improvement phase, 2 = second, etc.)

    Raises
    ------
    ValueError
        If *chart_type* is ``"run"``, *improvement_direction* is invalid,
        *rebase_on* is not one of ``{"improvement", "worsening", "any"}``, or
        *baseline* is not a non-negative integer.
    """
    chart_type_key = chart_type.strip().lower() if chart_type else chart_type
    # An I (Individuals) chart is mathematically identical to an XmR chart.
    if chart_type_key == "i":
        chart_type_key = "xmr"
        chart_type = "xmr"
    if chart_type_key == "run":
        raise ValueError(
            "Auto-rebasing is not supported for run charts.  "
            "Use chart_type one of 'xmr', 'p', 'u', 'c', 't', 'g'."
        )
    if improvement_direction not in {"high", "low"}:
        raise ValueError(
            "improvement_direction must be 'high' or 'low', "
            f"got '{improvement_direction}'"
        )
    if rebase_on not in {"improvement", "worsening", "any"}:
        raise ValueError(
            "rebase_on must be one of 'improvement', 'worsening', 'any', "
            f"got '{rebase_on}'"
        )
    if isinstance(baseline, bool) or not isinstance(baseline, (int, np.integer)) or baseline < 0:
        raise ValueError(
            f"baseline must be a non-negative integer, got '{baseline}'"
        )

    # Baseline limits over the full dataset
    result = calculate_control_limits(
        data,
        chart_type=chart_type,
        value_col=value_col,
        subgroup_col=subgroup_col,
        numerator_col=numerator_col,
    )
    result["rebase_phase"] = 0

    phase = 0
    phase_start = 0  # absolute row index where the current phase begins

    while True:
        phase_slice = result.iloc[phase_start:]
        values = phase_slice[value_col].to_numpy(dtype=float)
        mean_arr = phase_slice["mean"].to_numpy(dtype=float)

        rel_idx = _find_improvement_shift_start(
            values, mean_arr, improvement_direction, min_phase_length,
            rebase_on=rebase_on, min_start=baseline,
        )
        if rel_idx is None:
            break  # No further improvement detected in this phase
        if rel_idx == 0:
            break  # Shift starts at current phase boundary — no forward progress

        abs_rebase = phase_start + rel_idx
        remaining = len(data) - abs_rebase
        if remaining < min_phase_length:
            break  # Not enough data for a meaningful new phase

        # Recalculate the previous (now-closed) phase's limits using only its
        # own data.  Without this, baseline points retain the original
        # full-dataset mean and may be wrongly flagged as special-cause
        # against a centre line that was contaminated by the later shift.
        prev_phase_raw = data.iloc[phase_start:abs_rebase].reset_index(drop=True)
        if len(prev_phase_raw) >= 2:
            prev_phase_result = calculate_control_limits(
                prev_phase_raw,
                chart_type=chart_type,
                value_col=value_col,
                subgroup_col=subgroup_col,
                numerator_col=numerator_col,
            )
            for col in ("mean", "ucl", "lcl", "uwl", "lwl"):
                if col in prev_phase_result.columns:
                    result.iloc[
                        phase_start:abs_rebase, result.columns.get_loc(col)
                    ] = prev_phase_result[col].to_numpy()

        # Recalculate limits for the new phase using the original raw data
        new_phase_raw = data.iloc[abs_rebase:].reset_index(drop=True)
        new_phase_result = calculate_control_limits(
            new_phase_raw,
            chart_type=chart_type,
            value_col=value_col,
            subgroup_col=subgroup_col,
            numerator_col=numerator_col,
        )

        phase += 1
        # Write the new phase's limits back into the full result DataFrame
        for col in ("mean", "ucl", "lcl", "uwl", "lwl"):
            if col in new_phase_result.columns:
                result.iloc[
                    abs_rebase:, result.columns.get_loc(col)
                ] = new_phase_result[col].to_numpy()
        result.iloc[
            abs_rebase:, result.columns.get_loc("rebase_phase")
        ] = phase

        phase_start = abs_rebase

    return result


def determine_variation_type(
    result: pd.DataFrame,
    value_col: str = "value",
    mean_col: str = "mean",
    improvement_direction: str = "high",
) -> str:
    """Determine the overall variation icon type for an SPC chart.

    Examines the most recent special-cause signals to classify the process
    into one of:

    * ``"improvement_high"`` – special cause improving, values significantly higher
    * ``"improvement_low"``  – special cause improving, values significantly lower
    * ``"concern_high"``     – special cause concerning, values significantly higher
    * ``"concern_low"``      – special cause concerning, values significantly lower
    * ``"common_cause"``     – no special-cause variation detected

    Parameters
    ----------
    result : pd.DataFrame
        Output from :func:`detect_special_causes`.
    value_col : str
        Column containing measured values.
    mean_col : str
        Column containing the centre line.
    improvement_direction : str
        ``"high"`` or ``"low"``.

    Returns
    -------
    str
        One of the variation type strings listed above.
    """
    if improvement_direction not in {"high", "low"}:
        raise ValueError(
            "improvement_direction must be 'high' or 'low', "
            f"got '{improvement_direction}'"
        )

    if "special_cause" not in result.columns:
        return "common_cause"

    # Look at the most recent data points for the overall assessment
    sc = result["special_cause"].to_numpy(dtype=bool)
    if not sc.any():
        return "common_cause"

    values = result[value_col].to_numpy(dtype=float)
    mean = result[mean_col].to_numpy(dtype=float)

    # Assess the most recent special-cause point
    last_sc_idx = int(np.where(sc)[0][-1])
    value_is_high = values[last_sc_idx] > mean[last_sc_idx]

    if improvement_direction == "high":
        if value_is_high:
            return "improvement_high"
        else:
            return "concern_low"
    else:  # improvement_direction == "low"
        if value_is_high:
            return "concern_high"
        else:
            return "improvement_low"


def determine_assurance_type(
    result: pd.DataFrame,
    target: float | None,
    improvement_direction: str = "high",
    ucl_col: str = "ucl",
    lcl_col: str = "lcl",
) -> str:
    """Determine the assurance icon type for an SPC chart.

    Compares the target value against the control limits to classify whether
    the process will consistently meet the target:

    * ``"pass"``        – target is within the process capability on the
      favourable side; the process will consistently PASS the target.
    * ``"hit_or_miss"`` – target falls between UCL and LCL; the process
      may or may not meet the target.
    * ``"fail"``        – target is outside the process capability on the
      unfavourable side; the process will consistently FAIL the target.
    * ``"no_target"``   – no target is set; assurance cannot be determined.

    Parameters
    ----------
    result : pd.DataFrame
        Output from :func:`calculate_control_limits` (must contain UCL/LCL).
    target : float or None
        The target value. Returns ``"no_target"`` when ``None``.
    improvement_direction : str
        ``"high"`` or ``"low"``.
    ucl_col, lcl_col : str
        Column names for the upper and lower control limits.

    Returns
    -------
    str
        One of ``"pass"``, ``"hit_or_miss"``, ``"fail"``, or ``"no_target"``.
    """
    if target is None:
        return "no_target"

    if ucl_col not in result.columns or lcl_col not in result.columns:
        return "no_target"

    # Use the most recent phase's limits (last row)
    ucl = float(result[ucl_col].iloc[-1])
    lcl = float(result[lcl_col].iloc[-1])

    if improvement_direction == "high":
        # Higher is better: pass if target < LCL (all above target)
        if target <= lcl:
            return "pass"
        elif target >= ucl:
            return "fail"
        else:
            return "hit_or_miss"
    else:
        # Lower is better: pass if target > UCL (all below target)
        if target >= ucl:
            return "pass"
        elif target <= lcl:
            return "fail"
        else:
            return "hit_or_miss"


# ---------------------------------------------------------------------------
# Chart-specific helpers
# ---------------------------------------------------------------------------


def _calc_xmr(df: pd.DataFrame, value_col: str) -> pd.DataFrame:
    """XmR (individuals / moving-range) chart calculations.

    Uses the debiasing constant ``d2 = 1.128`` for subgroup size of 2.
    ``UCL = mean + 3 / d2 * mean_mr``  which simplifies to
    ``mean ± 2.66 * mean_mr``.

    Warning limits (2-sigma) use ``limitclose = 2/3 * 2.66 ≈ 1.77``,
    consistent with NHSRplotthedots.
    """
    values = df[value_col].to_numpy(dtype=float)
    mean_val = np.nanmean(values)
    moving_range = np.abs(np.diff(values))
    mean_mr = np.nanmean(moving_range)

    # 3 / d2 ≈ 2.659, rounded to 2.66 in NHS MDC guidance
    d2 = 1.128
    sigma_multiplier = 3.0 / d2          # ≈ 2.66
    warn_multiplier = 2.0 * sigma_multiplier / 3.0  # ≈ 1.77

    df["mean"] = mean_val
    df["ucl"] = mean_val + sigma_multiplier * mean_mr
    df["lcl"] = mean_val - sigma_multiplier * mean_mr
    df["uwl"] = mean_val + warn_multiplier * mean_mr
    df["lwl"] = mean_val - warn_multiplier * mean_mr
    return df


def _calc_p(
    df: pd.DataFrame,
    value_col: str,
    subgroup_col: str | None,
    numerator_col: str | None,
) -> pd.DataFrame:
    """p-chart (proportion) calculations with varying subgroup sizes.

    *value_col* may contain either pre-computed proportions (values in
    ``[0, 1]``) or raw numerator counts (any value > 1, or integer dtype).
    Raw counts are auto-detected and converted to proportions using
    *subgroup_col* as the denominator so that points and limits are both
    plotted on the proportion scale.
    """
    if numerator_col is not None:
        # value_col is the denominator; numerator_col holds event counts
        n = df[value_col].to_numpy(dtype=float)
        numerator = df[numerator_col].to_numpy(dtype=float)
        p_i = numerator / n
        p_bar = np.nansum(numerator) / np.nansum(n)
        df[value_col] = p_i
    else:
        n = df[subgroup_col].to_numpy(dtype=float)
        raw = df[value_col].to_numpy(dtype=float)
        # Auto-detect raw counts: integer dtype or any value > 1 (proportions
        # cannot exceed 1). Convert to proportions using subgroup sizes.
        is_count = (
            pd.api.types.is_integer_dtype(df[value_col])
            or np.any(raw[~np.isnan(raw)] > 1.0)
        )
        if is_count:
            p_i = raw / n
            p_bar = np.nansum(raw) / np.nansum(n)
            df[value_col] = p_i
        else:
            p_i = raw
            # Back-calculate totals from proportions and subgroup sizes
            p_bar = np.nansum(p_i * n) / np.nansum(n)

    sigma_i = np.sqrt(p_bar * (1 - p_bar) / n)

    df["mean"] = p_bar
    df["ucl"] = p_bar + 3 * sigma_i
    df["lcl"] = p_bar - 3 * sigma_i
    df["uwl"] = p_bar + 2 * sigma_i
    df["lwl"] = p_bar - 2 * sigma_i

    return df


def _calc_u(
    df: pd.DataFrame,
    value_col: str,
    subgroup_col: str | None,
) -> pd.DataFrame:
    """u-chart (counts per unit) calculations with varying subgroup sizes.

    *value_col* may contain either pre-computed rates (per-unit counts as
    floats) or raw event counts (integer dtype).  Raw counts are
    auto-detected and divided by *subgroup_col* so that points and limits
    are both plotted on the per-unit-rate scale.
    """
    n = df[subgroup_col].to_numpy(dtype=float)
    raw = df[value_col].to_numpy(dtype=float)

    # Auto-detect raw counts: integer dtype implies counts (rates are
    # generally fractional). Convert to per-unit rates.
    is_count = pd.api.types.is_integer_dtype(df[value_col])
    if is_count:
        u_i = raw / n
        u_bar = np.nansum(raw) / np.nansum(n)
        df[value_col] = u_i
    else:
        u_i = raw
        u_bar = np.nansum(u_i * n) / np.nansum(n)

    sigma_i = np.sqrt(u_bar / n)

    df["mean"] = u_bar
    df["ucl"] = u_bar + 3 * sigma_i
    df["lcl"] = u_bar - 3 * sigma_i
    df["uwl"] = u_bar + 2 * sigma_i
    df["lwl"] = u_bar - 2 * sigma_i
    return df


def _calc_c(df: pd.DataFrame, value_col: str) -> pd.DataFrame:
    """c-chart (counts in fixed population) calculations."""
    values = df[value_col].to_numpy(dtype=float)
    c_bar = np.nanmean(values)
    sigma = np.sqrt(c_bar)

    df["mean"] = c_bar
    df["ucl"] = c_bar + 3 * sigma
    df["lcl"] = c_bar - 3 * sigma
    df["uwl"] = c_bar + 2 * sigma
    df["lwl"] = c_bar - 2 * sigma
    return df


def _calc_run(df: pd.DataFrame, value_col: str) -> pd.DataFrame:
    """Run chart calculations – median centre line only, no control limits."""
    values = df[value_col].to_numpy(dtype=float)
    median_val = float(np.nanmedian(values))
    df["mean"] = median_val
    return df


def _calc_t(df: pd.DataFrame, value_col: str) -> pd.DataFrame:
    """t-chart (time between rare events) calculations.

    Uses Nelson's transformation ``Y' = Y ** (1 / 3.6)`` to symmetrise the
    skewed distribution of times between rare events.  Standard XmR control
    limits are computed on the transformed scale and then back-transformed
    (raised to the power ``3.6``) so that limits and points are plotted on
    the original time scale.

    Reference: R. Lloyd, *Quality Health Care: A Guide to Developing and
    Using Indicators*, Chapter 9 (Shewhart charts for rare events) and
    L.S. Nelson (1994).
    """
    POW = 3.6
    values = df[value_col].to_numpy(dtype=float)
    if (values < 0).any():
        raise ValueError(
            "t-chart values represent times between events and must be >= 0"
        )

    transformed = np.power(values, 1.0 / POW)
    mean_t = np.nanmean(transformed)
    moving_range = np.abs(np.diff(transformed))
    mean_mr = np.nanmean(moving_range) if len(moving_range) else 0.0

    d2 = 1.128
    sigma_multiplier = 3.0 / d2          # ≈ 2.66
    warn_multiplier = 2.0 * sigma_multiplier / 3.0  # ≈ 1.77

    ucl_t = mean_t + sigma_multiplier * mean_mr
    lcl_t = mean_t - sigma_multiplier * mean_mr
    uwl_t = mean_t + warn_multiplier * mean_mr
    lwl_t = mean_t - warn_multiplier * mean_mr

    # Back-transform to the original time scale.  Negative transformed
    # limits map to 0 (times cannot be negative).
    def _back(x: float) -> float:
        if np.isnan(x):
            return float("nan")
        return float(np.power(x, POW)) if x > 0 else 0.0

    df["mean"] = _back(mean_t)
    df["ucl"] = _back(ucl_t)
    df["lcl"] = _back(lcl_t)
    df["uwl"] = _back(uwl_t)
    df["lwl"] = _back(lwl_t)
    return df


def _calc_g(df: pd.DataFrame, value_col: str) -> pd.DataFrame:
    """g-chart (opportunities between rare events) calculations.

    Treats the count between consecutive rare events as following a
    geometric distribution.  Standard formulas (Provost & Murray,
    *The Health Care Data Guide*; R. Lloyd, *QHC* Chapter 9):

    * centre line  ``CL = g_bar`` (mean opportunities between events)
    * standard deviation ``σ = sqrt(g_bar * (g_bar + 1))``
    * ``UCL = g_bar + 3σ`` ; ``LCL = max(0, g_bar - 3σ)`` (typically 0)

    Warning limits at 2σ are also returned (clipped to ≥ 0) to support
    NHS MDC Rule 4.
    """
    values = df[value_col].to_numpy(dtype=float)
    if (values < 0).any():
        raise ValueError(
            "g-chart values are non-negative counts of opportunities "
            "between rare events"
        )

    g_bar = np.nanmean(values)
    # Geometric-distribution standard deviation
    sigma = np.sqrt(g_bar * (g_bar + 1.0))

    lcl = max(g_bar - 3 * sigma, 0.0)
    lwl = max(g_bar - 2 * sigma, 0.0)

    df["mean"] = g_bar
    df["ucl"] = g_bar + 3 * sigma
    df["lcl"] = lcl
    df["uwl"] = g_bar + 2 * sigma
    df["lwl"] = lwl
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
    run_length: int = 8,
) -> np.ndarray:
    """Rule 2 – run of *run_length* consecutive points on the same side of mean."""
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


def _rule3_trend(values: np.ndarray, run_length: int = 6) -> np.ndarray:
    """Rule 3 – run of *run_length* consecutive points increasing/decreasing."""
    n = len(values)
    flags = np.zeros(n, dtype=bool)
    diffs = np.diff(values)  # length n-1

    for start in range(n - run_length + 1):
        # We need (run_length - 1) consecutive diffs all same sign
        seg = diffs[start : start + run_length - 1]
        if (seg > 0).all() or (seg < 0).all():
            flags[start : start + run_length] = True

    return flags


def _rule4_two_in_three(
    values: np.ndarray,
    mean: np.ndarray,
    ucl: np.ndarray,
    lcl: np.ndarray,
    uwl: np.ndarray,
    lwl: np.ndarray,
) -> np.ndarray:
    """Rule 4 – 2 out of 3 consecutive points in the warning zone on same side.

    The warning zone is the region between the 2-sigma warning limits
    (``uwl``/``lwl``) and the 3-sigma control limits (``ucl``/``lcl``).
    Both qualifying points must be on the same side of the centre line.

    Aligned with ``ptd_two_in_three`` from NHSRplotthedots.
    """
    n = len(values)
    flags = np.zeros(n, dtype=bool)

    # close_to_limits: 1 if in warning zone (above uwl or below lwl) and not outside limits
    outside = (values > ucl) | (values < lcl)
    close = ~outside & ((values > uwl) | (values < lwl))

    # relative_to_mean: +1 if above mean, -1 if below, 0 if equal
    rtm = np.sign(values - mean).astype(int)

    # Slide a window of 3 and check if ≥2 are close AND all 3 on same side
    for i in range(n):
        for window_start in (i - 2, i - 1, i):
            ws = window_start
            we = window_start + 3
            if ws < 0 or we > n:
                continue
            seg_close = close[ws:we]
            seg_rtm = rtm[ws:we]
            if seg_close.sum() >= 2 and abs(seg_rtm.sum()) == 3:
                # Point i is only flagged if it is itself close to limits
                if close[i]:
                    flags[i] = True
                    break

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
    is_rule3: bool,
    all_values: np.ndarray,
    all_means: np.ndarray,
    idx: int,
) -> bool:
    """Return True if the special-cause signal is in the *high* direction."""
    if is_rule1:
        return value > ucl
    # Rule 3 (trend): direction is determined by the slope, not by
    # the point's position relative to the mean.  An upward trend is
    # "high" regardless of whether individual points sit below the mean.
    if is_rule3 and not is_rule2:
        if idx > 0:
            return float(all_values[idx]) > float(all_values[idx - 1])
        if idx < len(all_values) - 1:
            return float(all_values[idx + 1]) > float(all_values[idx])
    # Rule 2 or 4: look at which side of mean the point is on
    return value > mean


def _towards_target(value: float, mean: float, target: float) -> bool:
    """Return True if *value* is closer to *target* than the mean is."""
    return abs(value - target) < abs(mean - target)


def _find_improvement_shift_start(
    values: np.ndarray,
    mean: np.ndarray,
    improvement_direction: str,
    run_length: int = 8,
    rebase_on: str = "improvement",
    min_start: int = 0,
) -> int | None:
    """Return the index of the first point in a sustained shift, or ``None``.

    A shift is *run_length* or more consecutive points on one side of *mean*.
    Which side qualifies depends on *rebase_on*:

    * ``"improvement"`` – a run in *improvement_direction* relative to *mean*.
    * ``"worsening"``   – a run away from *improvement_direction*.
    * ``"any"``         – a run on *either* side of *mean*; the earliest
      qualifying start (across both sides) is returned.

    Parameters
    ----------
    values : np.ndarray
        Measured values.
    mean : np.ndarray
        Per-point centre line.
    improvement_direction : str
        ``"high"`` if higher values are better, ``"low"`` otherwise.
    run_length : int, optional
        Number of consecutive points required to constitute a shift
        (default ``8``).
    rebase_on : str, optional
        One of ``"improvement"`` (default), ``"worsening"``, or ``"any"``.
    min_start : int, optional
        Minimum start index for the search; runs that begin before this
        offset are ignored (default ``0``).  Used to enforce a *baseline*
        number of points within a phase before a rebase is permitted.

    Returns
    -------
    int or None
        Index of the first point of the earliest qualifying shift, or
        ``None`` if no shift is found.
    """
    n = len(values)
    high_side = values > mean
    low_side = values < mean
    if improvement_direction == "high":
        improvement_side = high_side
        worsening_side = low_side
    else:
        improvement_side = low_side
        worsening_side = high_side

    if rebase_on == "improvement":
        masks = (improvement_side,)
    elif rebase_on == "worsening":
        masks = (worsening_side,)
    else:  # "any"
        masks = (improvement_side, worsening_side)

    for start in range(max(min_start, 0), n - run_length + 1):
        for mask in masks:
            if mask[start : start + run_length].all():
                return start
    return None


def show_summary(
    data: pd.DataFrame,
    chart_type: str = "XmR",
    value_col: str = "value",
    improvement_direction: str = "high",
    target: float | None = None,
    subgroup_col: str | None = "subgroup_size",
    x_col: str | None = None,
) -> dict:
    """Generate an analysis summary for SPC charts.

    Returns a structured dictionary with variation classification, assurance
    status, statistics, triggered rules, and signal points — similar to the
    NHS Making Data Count dashboard summary view.

    Parameters
    ----------
    data : pd.DataFrame
        The input data containing measurements.
    chart_type : str, optional
        The chart type (``"XmR"``, ``"p"``, ``"u"``, ``"c"``, ``"run"``),
        default ``"XmR"``.  ``"i"`` / ``"I"`` are accepted as aliases of
        ``"XmR"``.
    value_col : str, optional
        Column name for the measured values (default ``"value"``).
    improvement_direction : str, optional
        Whether higher (``"high"``) or lower (``"low"``) values are better
        (default ``"high"``).
    target : float or None, optional
        Optional target value for assurance classification (default ``None``).
    subgroup_col : str or None, optional
        Subgroup size column for p and u charts (default ``"subgroup_size"``).
    x_col : str or None, optional
        Column name for x-axis values (dates or indices, default ``None``).

    Returns
    -------
    dict
        Summary dictionary with keys:
        
        - ``"variation"``: Variation classification string
        - ``"assurance"``: Assurance classification string
        - ``"data_points"``: Number of data points
        - ``"mean"``: Process mean
        - ``"ucl"``: Upper control limit (or ``None`` for run charts)
        - ``"lcl"``: Lower control limit (or ``None`` for run charts)
        - ``"rules_triggered"``: Dict of rule names to trigger counts
        - ``"signal_points"``: List of dicts with signal point details

    Examples
    --------
    >>> import pandas as pd
    >>> from abspc import show_summary
    >>> df = pd.DataFrame({"value": [50, 52, 48, 72, 51, 49, 50, 53]})
    >>> summary = show_summary(df, chart_type="XmR")
    >>> summary["variation"]
    'Special-cause variation — Concern (high)'
    >>> summary["rules_triggered"]
    {'R1': 1}
    """
    validate_data(data, chart_type, value_col, subgroup_col)
    
    is_run = chart_type.lower() == "run"
    
    # Calculate control limits and detect signals
    if is_run:
        result = calculate_control_limits(data, chart_type="run", value_col=value_col)
        result = detect_run_chart_signals(result, value_col=value_col)
    else:
        result = calculate_control_limits(
            data,
            chart_type=chart_type,
            value_col=value_col,
            subgroup_col=subgroup_col if chart_type.lower() in ("p", "u") else None,
        )
        result = detect_special_causes(result, value_col=value_col)
    
    # Gather statistics
    n_points = len(result)
    mean_val = float(result["mean"].iloc[0])
    ucl_val = float(result["ucl"].iloc[0]) if "ucl" in result.columns else None
    lcl_val = float(result["lcl"].iloc[0]) if "lcl" in result.columns else None
    
    # Determine variation
    if is_run:
        run_signal = result["run_signal"].to_numpy(dtype=bool)
        if not run_signal.any():
            variation = "Common-cause variation"
        else:
            values_arr = result[value_col].to_numpy(dtype=float)
            median_arr = result["mean"].to_numpy(dtype=float)
            last_sig = int(np.where(run_signal)[0][-1])
            val_is_high = values_arr[last_sig] > median_arr[last_sig]
            if improvement_direction == "high":
                variation = "Special-cause variation — Improvement (high)" if val_is_high else "Special-cause variation — Concern (low)"
            else:
                variation = "Special-cause variation — Concern (high)" if val_is_high else "Special-cause variation — Improvement (low)"
    else:
        variation_type = determine_variation_type(
            result, value_col=value_col, improvement_direction=improvement_direction
        )
        variation_labels = {
            "common_cause": "Common-cause variation",
            "improvement_low": "Special-cause variation — Improvement (low)",
            "improvement_high": "Special-cause variation — Improvement (high)",
            "concern_low": "Special-cause variation — Concern (low)",
            "concern_high": "Special-cause variation — Concern (high)",
        }
        variation = variation_labels.get(variation_type, variation_type)
    
    # Determine assurance
    if is_run or target is None:
        assurance = "No target set"
    else:
        assurance_type = determine_assurance_type(
            result, target=target, improvement_direction=improvement_direction
        )
        assurance_labels = {
            "pass": "Consistently achieving target",
            "fail": "Consistently failing target",
            "hit_or_miss": "Hit or miss — may or may not meet target",
            "no_target": "No target set",
        }
        assurance = assurance_labels.get(assurance_type, assurance_type)
    
    # Count rules triggered
    rules_triggered = {}
    signal_points = []
    
    if is_run:
        # Run chart signals
        run_shift_count = int(result["run_shift"].sum())
        run_trend_count = int(result["run_trend"].sum())
        if run_shift_count > 0:
            rules_triggered["Shift"] = run_shift_count
        if run_trend_count > 0:
            rules_triggered["Trend"] = run_trend_count
        
        # Collect signal points
        signal_mask = result["run_signal"].to_numpy(dtype=bool)
        for idx in np.where(signal_mask)[0]:
            point_info = {"index": int(idx)}
            if x_col and x_col in result.columns:
                point_info["x"] = result[x_col].iloc[idx]
            point_info["value"] = float(result[value_col].iloc[idx])
            rules = []
            if result["run_shift"].iloc[idx]:
                rules.append("Shift")
            if result["run_trend"].iloc[idx]:
                rules.append("Trend")
            point_info["rules"] = rules
            signal_points.append(point_info)
    else:
        # SPC chart rules
        for rule_num in range(1, 5):
            rule_col = f"rule{rule_num}"
            if rule_col in result.columns:
                count = int(result[rule_col].sum())
                if count > 0:
                    rules_triggered[f"R{rule_num}"] = count
        
        # Collect signal points
        if "special_cause" in result.columns:
            signal_mask = result["special_cause"].to_numpy(dtype=bool)
            for idx in np.where(signal_mask)[0]:
                point_info = {"index": int(idx)}
                if x_col and x_col in result.columns:
                    point_info["x"] = result[x_col].iloc[idx]
                point_info["value"] = float(result[value_col].iloc[idx])
                rules = []
                for rule_num in range(1, 5):
                    rule_col = f"rule{rule_num}"
                    if rule_col in result.columns and result[rule_col].iloc[idx]:
                        rules.append(f"R{rule_num}")
                point_info["rules"] = rules
                signal_points.append(point_info)
    
    return {
        "variation": variation,
        "assurance": assurance,
        "data_points": n_points,
        "mean": mean_val,
        "ucl": ucl_val,
        "lcl": lcl_val,
        "rules_triggered": rules_triggered,
        "signal_points": signal_points,
        "total_signals": len(signal_points),
    }
