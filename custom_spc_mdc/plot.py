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
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import pandas as pd

from .spc import (
    calculate_control_limits,
    detect_special_causes,
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
from .utils import add_target_line, add_nhs_logo, add_shading

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_CHART_TYPE_LABELS: dict[str, str] = {
    "xmr": "XmR Chart",
    "p": "p Chart (Proportion)",
    "u": "u Chart (Counts per Unit)",
    "c": "c Chart (Counts)",
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
) -> tuple[matplotlib.figure.Figure, matplotlib.axes.Axes]:
    """Create an NHS MDC SPC chart.

    Parameters
    ----------
    data : pd.DataFrame
        Input data.  Must contain at least the column specified by
        *value_col*.  For ``"p"`` and ``"u"`` charts it must also contain the
        subgroup-size column.
    chart_type : str
        One of ``"XmR"``, ``"p"``, ``"u"``, ``"c"`` (case-insensitive).
    value_col : str, optional
        Name of the column containing measured values (default ``"value"``).
    subgroup_col : str or None, optional
        Name of the column containing subgroup sizes (default
        ``"subgroup_size"``).
    numerator_col : str or None, optional
        For ``"p"`` charts: column containing event counts when *value_col*
        holds denominator sizes.
    x_col : str or None, optional
        Column to use as the x-axis.  Defaults to the DataFrame index.
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

    Returns
    -------
    fig : matplotlib.figure.Figure
    ax  : matplotlib.axes.Axes
    """
    chart_type_key = chart_type.strip().lower()

    # --- Calculate limits and detect special causes -------------------------
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

    # x-axis values
    if x_col is not None and x_col in result.columns:
        x = result[x_col].to_numpy()
    else:
        x = np.arange(len(result))

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

    # --- Optional target line -----------------------------------------------
    if show_target and target is not None:
        add_target_line(ax, target, color=NHS_WARM_YELLOW)

    # --- Optional NHS logo --------------------------------------------------
    if nhs_logo_path is not None:
        add_nhs_logo(ax, nhs_logo_path, position="lower right")

    # --- Labels & title -----------------------------------------------------
    default_title = _CHART_TYPE_LABELS.get(chart_type_key, "SPC Chart")
    ax.set_title(title if title is not None else default_title,
                 fontsize=13, fontweight="bold")
    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)

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
