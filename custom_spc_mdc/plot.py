"""
plot.py
=======
Plotting and visualisation for NHS Making Data Count SPC charts.

All charts use the NHS colour scheme:

* NHS Blue        ``#005EB8``  – centre line, improvement points
* NHS Dark Blue   ``#003087``  – control-limit lines
* NHS Orange      ``#ED8B00``  – concern points
* Grey            ``#768692``  – common-cause points
* NHS Warm Yellow ``#FFB81C``  – optional target line
* Light Blue      ``#41B6E6``  – optional tolerance-band shading
* Pale Grey       ``#E8EDEE``  – optional tolerance-band shading (alternate)
"""

from __future__ import annotations

import matplotlib
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import pandas as pd

from .spc import (
    calculate_control_limits,
    detect_special_causes,
    detect_run_chart_signals,
    rebase_control_limits,
    determine_point_colours,
    NHS_BLUE,
    NHS_DARK_BLUE,
    NHS_ORANGE,
    NHS_GREY,
    NHS_WARM_YELLOW,
    NHS_LIGHT_BLUE,
    NHS_PALE_GREY,
    COLOUR_COMMON_CAUSE,
    COLOUR_IMPROVEMENT,
    COLOUR_CONCERN,
)
from .utils import add_target_line, add_nhs_logo, add_shading, add_change_line

# ---------------------------------------------------------------------------
# Date-axis helpers
# ---------------------------------------------------------------------------


def _is_datetime_like(arr) -> bool:
    """Return ``True`` when *arr* contains datetime / date values."""
    if hasattr(arr, "dtype"):
        return pd.api.types.is_datetime64_any_dtype(arr)
    # Numpy object arrays or plain Python sequences
    if len(arr) > 0:
        import datetime
        first = arr[0]
        return isinstance(first, (pd.Timestamp, datetime.date, np.datetime64))
    return False


def _apply_date_formatting(
    ax: matplotlib.axes.Axes,
    x,
    date_format: str | None = None,
) -> None:
    """Apply date locator/formatter to *ax* when *x* contains datetime values.

    Parameters
    ----------
    ax : matplotlib.axes.Axes
        The axes to format.
    x : array-like
        The x-axis values used for plotting.
    date_format : str or None, optional
        A ``strftime``-style format string (e.g. ``"%b %Y"``).  When ``None``
        matplotlib's ``ConciseDateFormatter`` is used to pick a smart format
        automatically (default ``None``).
    """
    if not _is_datetime_like(x):
        return

    if date_format is not None:
        locator = mdates.AutoDateLocator(minticks=4, maxticks=12)
        formatter = mdates.DateFormatter(date_format)
    else:
        locator = mdates.AutoDateLocator(minticks=4, maxticks=12)
        formatter = mdates.ConciseDateFormatter(locator)

    ax.xaxis.set_major_locator(locator)
    ax.xaxis.set_major_formatter(formatter)
    plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha="right")


def _extract_x(result: pd.DataFrame, x_col: str | None) -> np.ndarray:
    """Return the x-axis array for *result*.

    Priority order:

    1. ``x_col`` column (if supplied and present in *result*)
    2. ``DatetimeIndex`` of *result* (auto-detected)
    3. Integer sequence ``0, 1, 2, …``
    """
    if x_col is not None and x_col in result.columns:
        return result[x_col].to_numpy()
    if isinstance(result.index, pd.DatetimeIndex):
        return result.index.to_numpy()
    return np.arange(len(result))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_CHART_TYPE_LABELS: dict[str, str] = {
    "xmr": "XmR Chart",
    "p": "p Chart (Proportion)",
    "u": "u Chart (Counts per Unit)",
    "c": "c Chart (Counts)",
    "run": "Run Chart",
}


def plot_spc_chart(
    data: pd.DataFrame,
    chart_type: str,
    value_col: str = "value",
    subgroup_col: str | None = "subgroup_size",
    numerator_col: str | None = None,
    x_col: str | None = None,
    title: str | None = None,
    xlabel: str = "Observation",
    ylabel: str = "Value",
    improvement_direction: str = "high",
    target: float | None = None,
    show_target: bool = False,
    shade_band: bool = False,
    shade_color: str = NHS_LIGHT_BLUE,
    nhs_logo_path: str | None = None,
    ax: matplotlib.axes.Axes | None = None,
    figsize: tuple[float, float] = (12, 5),
    show_legend: bool = True,
    change_points: list[dict] | None = None,
    auto_rebase: bool = False,
    date_format: str | None = None,
) -> tuple[matplotlib.figure.Figure, matplotlib.axes.Axes]:
    """Create an NHS MDC SPC or run chart.

    When ``chart_type="run"`` this function delegates to
    :func:`plot_run_chart` automatically.

    Parameters
    ----------
    data : pd.DataFrame
        Input data.  Must contain at least the column specified by
        *value_col*.  For ``"p"`` and ``"u"`` charts it must also contain the
        subgroup-size column.
    chart_type : str
        One of ``"XmR"``, ``"p"``, ``"u"``, ``"c"``, ``"run"``
        (case-insensitive).
    value_col : str, optional
        Name of the column containing measured values (default ``"value"``).
    subgroup_col : str or None, optional
        Name of the column containing subgroup sizes (default
        ``"subgroup_size"``).
    numerator_col : str or None, optional
        For ``"p"`` charts: column containing event counts when *value_col*
        holds denominator sizes.
    x_col : str or None, optional
        Column to use as the x-axis.  When ``None`` the function checks whether
        the DataFrame has a :class:`pandas.DatetimeIndex` and uses it
        automatically; otherwise integer positions are used.
    title : str or None, optional
        Chart title.  If omitted, a default title is generated from
        *chart_type*.
    xlabel : str, optional
        x-axis label (default ``"Observation"``).
    ylabel : str, optional
        y-axis label (default ``"Value"``).
    improvement_direction : str, optional
        ``"high"`` (default) or ``"low"`` – whether higher values represent
        improvement.
    target : float or None, optional
        Optional target value.  Also controls improvement colouring when set.
    show_target : bool, optional
        Draw a dashed target line when ``True`` (requires *target* to be set).
    shade_band : bool, optional
        Fill the region between UCL and LCL when ``True`` (default ``False``).
    shade_color : str, optional
        Colour for the tolerance-band shading (default NHS Light Blue).
    nhs_logo_path : str or None, optional
        Path to an NHS logo image file.  When provided the logo is overlaid in
        the lower-right corner.
    ax : matplotlib.axes.Axes or None, optional
        Axes on which to draw the chart.  A new figure / axes is created when
        ``None`` (default).
    figsize : tuple of float, optional
        Figure size in inches ``(width, height)`` (default ``(12, 5)``).
    show_legend : bool, optional
        Add a legend to the chart (default ``True``).
    change_points : list of dict or None, optional
        Vertical annotation lines marking known process changes.  Each dict
        must contain:

        * ``"x"`` – x-axis position of the change (index, numeric, or date).
        * ``"label"`` – text label to display beside the line.

        Example::

            change_points=[
                {"x": 6,  "label": "New protocol"},
                {"x": 14, "label": "Staff training"},
            ]
    auto_rebase : bool, optional
        When ``True``, automatically detect sustained improvement shifts
        (≥ 7 consecutive points in *improvement_direction*) and recalculate
        the mean and control limits for each new phase.  A dashed vertical
        line is drawn at each detected rebase boundary.  Default ``False``.
        Not supported for ``chart_type="run"``; pass ``"run"`` data to
        :func:`plot_run_chart` instead.
    date_format : str or None, optional
        A ``strftime``-style format string applied to the x-axis when datetime
        values are detected (e.g. ``"%b %Y"`` for *Jan 2024*).  When ``None``
        matplotlib's ``ConciseDateFormatter`` chooses a format automatically
        (default ``None``).

    Returns
    -------
    fig : matplotlib.figure.Figure
    ax  : matplotlib.axes.Axes
    """
    chart_type_key = chart_type.strip().lower()

    # Delegate run charts to the dedicated function
    if chart_type_key == "run":
        return plot_run_chart(
            data,
            value_col=value_col,
            x_col=x_col,
            title=title,
            xlabel=xlabel,
            ylabel=ylabel,
            improvement_direction=improvement_direction,
            target=target,
            show_target=show_target,
            nhs_logo_path=nhs_logo_path,
            ax=ax,
            figsize=figsize,
            show_legend=show_legend,
            change_points=change_points,
            date_format=date_format,
        )

    # --- Calculate limits ---------------------------------------------------
    if auto_rebase:
        result = rebase_control_limits(
            data,
            chart_type=chart_type,
            improvement_direction=improvement_direction,
            value_col=value_col,
            subgroup_col=subgroup_col,
            numerator_col=numerator_col,
        )
    else:
        result = calculate_control_limits(
            data,
            chart_type=chart_type,
            value_col=value_col,
            subgroup_col=subgroup_col,
            numerator_col=numerator_col,
        )

    result = detect_special_causes(result, value_col=value_col)
    colours = determine_point_colours(
        result,
        value_col=value_col,
        improvement_direction=improvement_direction,
        target=target,
    )

    # --- Axes setup ---------------------------------------------------------
    if ax is None:
        fig, ax = plt.subplots(figsize=figsize)
    else:
        fig = ax.get_figure()

    # x-axis values (date column → DatetimeIndex → integer fallback)
    x = _extract_x(result, x_col)

    values = result[value_col].to_numpy(dtype=float)
    mean = result["mean"].to_numpy(dtype=float)
    ucl = result["ucl"].to_numpy(dtype=float)
    lcl = result["lcl"].to_numpy(dtype=float)

    # --- Optional shading ---------------------------------------------------
    if shade_band:
        add_shading(ax, x, lcl, ucl, color=shade_color, alpha=0.12)

    # --- Control limit lines ------------------------------------------------
    ax.plot(x, ucl, color=NHS_DARK_BLUE, linewidth=1.2, linestyle="--",
            label="UCL / LCL", zorder=3)
    ax.plot(x, lcl, color=NHS_DARK_BLUE, linewidth=1.2, linestyle="--",
            zorder=3)

    # --- Centre line --------------------------------------------------------
    ax.plot(x, mean, color=NHS_BLUE, linewidth=1.8, linestyle="-",
            label="Mean", zorder=3)

    # --- Data line (thin grey connector) ------------------------------------
    ax.plot(x, values, color=NHS_GREY, linewidth=0.8, linestyle="-",
            alpha=0.6, zorder=2)

    # --- Data points (coloured by rule) -------------------------------------
    for xi, yi, colour in zip(x, values, colours):
        ax.plot(xi, yi, "o", color=colour, markersize=6, zorder=4)

    # --- Auto-rebase phase boundaries --------------------------------------
    if auto_rebase and "rebase_phase" in result.columns:
        phases = result["rebase_phase"].to_numpy()
        for i in range(1, len(phases)):
            if phases[i] != phases[i - 1]:
                ax.axvline(
                    x=x[i],
                    color=NHS_DARK_BLUE,
                    linestyle="-.",
                    linewidth=1.0,
                    alpha=0.6,
                    zorder=5,
                )
                ax.text(
                    x[i], ax.get_ylim()[1],
                    f"  Phase {phases[i]}",
                    rotation=90,
                    verticalalignment="top",
                    horizontalalignment="left",
                    fontsize=7,
                    color=NHS_DARK_BLUE,
                    alpha=0.8,
                    zorder=6,
                )

    # --- Optional target line -----------------------------------------------
    if show_target and target is not None:
        add_target_line(ax, target, color=NHS_WARM_YELLOW)

    # --- Change-point annotations ------------------------------------------
    if change_points:
        for cp in change_points:
            add_change_line(ax, x=cp["x"], label=cp.get("label"))

    # --- Optional NHS logo --------------------------------------------------
    if nhs_logo_path is not None:
        add_nhs_logo(ax, nhs_logo_path, position="lower right")

    # --- Labels & title -----------------------------------------------------
    default_title = _CHART_TYPE_LABELS.get(chart_type_key, "SPC Chart")
    ax.set_title(title if title is not None else default_title,
                 fontsize=13, fontweight="bold")
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)

    # --- Date-axis formatting (no-op for numeric/integer x) -----------------
    _apply_date_formatting(ax, x, date_format=date_format)

    # --- Legend -------------------------------------------------------------
    if show_legend:
        legend_handles = [
            mpatches.Patch(color=NHS_BLUE, label="Mean"),
            mpatches.Patch(color=NHS_DARK_BLUE, label="UCL / LCL"),
            mpatches.Patch(color=COLOUR_COMMON_CAUSE, label="Common cause"),
            mpatches.Patch(color=COLOUR_IMPROVEMENT, label="Improvement"),
            mpatches.Patch(color=COLOUR_CONCERN, label="Concern"),
        ]
        if show_target and target is not None:
            legend_handles.append(
                mpatches.Patch(color=NHS_WARM_YELLOW, label="Target")
            )
        ax.legend(handles=legend_handles, loc="upper right", fontsize=8)

    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    fig.tight_layout()
    return fig, ax


def plot_run_chart(
    data: pd.DataFrame,
    value_col: str = "value",
    x_col: str | None = None,
    title: str | None = None,
    xlabel: str = "Observation",
    ylabel: str = "Value",
    improvement_direction: str = "high",
    target: float | None = None,
    show_target: bool = False,
    nhs_logo_path: str | None = None,
    ax: matplotlib.axes.Axes | None = None,
    figsize: tuple[float, float] = (12, 5),
    show_legend: bool = True,
    change_points: list[dict] | None = None,
    date_format: str | None = None,
) -> tuple[matplotlib.figure.Figure, matplotlib.axes.Axes]:
    """Create an NHS MDC run chart with median centre line.

    Signals are detected using run-chart rules:

    * **Shift** – ≥ 7 consecutive points on the same side of the median.
    * **Trend** – ≥ 7 consecutive points all increasing *or* all decreasing.

    Signal points are coloured NHS Orange (concern) or NHS Blue (improvement)
    according to *improvement_direction*.  Common-cause points are grey.

    Parameters
    ----------
    data : pd.DataFrame
        Input data containing at least *value_col*.
    value_col : str, optional
        Name of the column containing measured values (default ``"value"``).
    x_col : str or None, optional
        Column to use as the x-axis.  Defaults to the DataFrame index.
    title : str or None, optional
        Chart title.  Defaults to ``"Run Chart"``.
    xlabel : str, optional
        x-axis label (default ``"Observation"``).
    ylabel : str, optional
        y-axis label (default ``"Value"``).
    improvement_direction : str, optional
        ``"high"`` (default) or ``"low"`` – whether higher values represent
        improvement.
    target : float or None, optional
        Optional target value.  When provided with *show_target*, a dashed
        line is drawn.
    show_target : bool, optional
        Draw a dashed target line when ``True`` (default ``False``).
    nhs_logo_path : str or None, optional
        Path to an NHS logo image file.
    ax : matplotlib.axes.Axes or None, optional
        Axes on which to draw.  A new figure / axes is created when ``None``.
    figsize : tuple of float, optional
        Figure size in inches (default ``(12, 5)``).
    show_legend : bool, optional
        Add a legend (default ``True``).
    change_points : list of dict or None, optional
        Vertical annotation lines marking known process changes.  Each dict
        must contain ``"x"`` (position) and ``"label"`` (text).
    date_format : str or None, optional
        A ``strftime``-style format string applied to the x-axis when datetime
        values are detected (e.g. ``"%b %Y"`` for *Jan 2024*).  When ``None``
        matplotlib's ``ConciseDateFormatter`` is used automatically.

    Returns
    -------
    fig : matplotlib.figure.Figure
    ax  : matplotlib.axes.Axes
    """
    if improvement_direction not in {"high", "low"}:
        raise ValueError(
            "improvement_direction must be 'high' or 'low', "
            f"got '{improvement_direction}'"
        )

    # --- Compute median and detect signals ----------------------------------
    result = calculate_control_limits(data, chart_type="run", value_col=value_col)
    result = detect_run_chart_signals(result, value_col=value_col)

    # --- Axes setup ---------------------------------------------------------
    if ax is None:
        fig, ax = plt.subplots(figsize=figsize)
    else:
        fig = ax.get_figure()

    # x-axis values (date column → DatetimeIndex → integer fallback)
    x = _extract_x(result, x_col)

    values = result[value_col].to_numpy(dtype=float)
    median = result["mean"].to_numpy(dtype=float)
    run_signal = result["run_signal"].to_numpy(dtype=bool)
    run_shift = result["run_shift"].to_numpy(dtype=bool)

    # --- Median line --------------------------------------------------------
    ax.plot(x, median, color=NHS_BLUE, linewidth=1.8, linestyle="-",
            label="Median", zorder=3)

    # --- Data line (thin grey connector) ------------------------------------
    ax.plot(x, values, color=NHS_GREY, linewidth=0.8, linestyle="-",
            alpha=0.6, zorder=2)

    # --- Data points --------------------------------------------------------
    for i, (xi, yi) in enumerate(zip(x, values)):
        if not run_signal[i]:
            colour = COLOUR_COMMON_CAUSE
        else:
            is_high = yi > median[i]
            if improvement_direction == "high":
                colour = COLOUR_IMPROVEMENT if is_high else COLOUR_CONCERN
            else:
                colour = COLOUR_CONCERN if is_high else COLOUR_IMPROVEMENT
        ax.plot(xi, yi, "o", color=colour, markersize=6, zorder=4)

    # --- Optional target line -----------------------------------------------
    if show_target and target is not None:
        add_target_line(ax, target, color=NHS_WARM_YELLOW)

    # --- Change-point annotations ------------------------------------------
    if change_points:
        for cp in change_points:
            add_change_line(ax, x=cp["x"], label=cp.get("label"))

    # --- Optional NHS logo --------------------------------------------------
    if nhs_logo_path is not None:
        add_nhs_logo(ax, nhs_logo_path, position="lower right")

    # --- Labels & title -----------------------------------------------------
    ax.set_title(title if title is not None else "Run Chart",
                 fontsize=13, fontweight="bold")
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)

    # --- Date-axis formatting (no-op for numeric/integer x) -----------------
    _apply_date_formatting(ax, x, date_format=date_format)

    # --- Legend -------------------------------------------------------------
    if show_legend:
        legend_handles = [
            mpatches.Patch(color=NHS_BLUE, label="Median"),
            mpatches.Patch(color=COLOUR_COMMON_CAUSE, label="Common cause"),
            mpatches.Patch(color=COLOUR_IMPROVEMENT, label="Improvement signal"),
            mpatches.Patch(color=COLOUR_CONCERN, label="Concern signal"),
        ]
        if show_target and target is not None:
            legend_handles.append(
                mpatches.Patch(color=NHS_WARM_YELLOW, label="Target")
            )
        ax.legend(handles=legend_handles, loc="upper right", fontsize=8)

    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    fig.tight_layout()
    return fig, ax
