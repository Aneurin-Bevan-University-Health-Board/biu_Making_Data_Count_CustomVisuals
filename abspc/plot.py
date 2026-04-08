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
    determine_variation_type,
    determine_assurance_type,
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
from .utils import add_target_line, add_nhs_logo, add_logo, add_shading, add_change_line

# ---------------------------------------------------------------------------
# Icon paths (bundled NHS MDC icons)
# ---------------------------------------------------------------------------

import pathlib as _pathlib

_ICON_DIR = _pathlib.Path(__file__).parent / "icons"

_VARIATION_ICON_MAP = {
    "improvement_high": _ICON_DIR / "variation_improvement_high.png",
    "improvement_low": _ICON_DIR / "variation_improvement_low.png",
    "common_cause": _ICON_DIR / "variation_common_cause.png",
    "concern_high": _ICON_DIR / "variation_concern_high.png",
    "concern_low": _ICON_DIR / "variation_concern_low.png",
}

_ASSURANCE_ICON_MAP = {
    "pass": _ICON_DIR / "assurance_pass.png",
    "hit_or_miss": _ICON_DIR / "assurance_hit_or_miss.png",
    "fail": _ICON_DIR / "assurance_fail.png",
    "no_target": _ICON_DIR / "icon_empty.png",
}

_IMPROVEMENT_DIR_ICON_MAP = {
    "high": _ICON_DIR / "improvement_direction_high.png",
    "low": _ICON_DIR / "improvement_direction_low.png",
}

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
# Icon overlay helpers
# ---------------------------------------------------------------------------


def _add_mdc_icons(
    fig: matplotlib.figure.Figure,
    ax: matplotlib.axes.Axes,
    variation_type: str,
    assurance_type: str,
    icon_zoom: float = 0.06,
    improvement_direction: str | None = None,
) -> None:
    """Place variation, assurance, and improvement-direction icons at the
    top-left of the chart.

    Icons are placed side by side at the top-left of the axes, just below
    the title: variation icon first, then assurance icon, then the
    improvement-direction arrow.

    Parameters
    ----------
    fig, ax : matplotlib objects
    variation_type : str
        Key into ``_VARIATION_ICON_MAP``.
    assurance_type : str
        Key into ``_ASSURANCE_ICON_MAP``.
    icon_zoom : float
        Icon height as a fraction of figure height.
    improvement_direction : str or None
        ``"high"`` or ``"low"``.  When supplied, an arrow icon indicating the
        improvement direction is placed after the other icons.
    """
    from matplotlib.offsetbox import OffsetImage, AnnotationBbox
    import matplotlib.image as mpimg

    fig_h = fig.get_size_inches()[1] * fig.dpi
    target_h = icon_zoom * fig_h

    icons_to_draw: list[tuple[str, dict]] = [
        (variation_type, _VARIATION_ICON_MAP),
        (assurance_type, _ASSURANCE_ICON_MAP),
    ]
    if improvement_direction is not None:
        icons_to_draw.append(
            (improvement_direction, _IMPROVEMENT_DIR_ICON_MAP),
        )

    x_offset = 0.0  # running x position in axes-fraction units
    for icon_type, icon_map in icons_to_draw:
        icon_path = icon_map.get(icon_type)
        if icon_path is None or not icon_path.exists():
            continue

        img = mpimg.imread(str(icon_path))
        img_h = img.shape[0]
        img_w = img.shape[1]
        zoom = target_h / img_h if img_h > 0 else 0.1

        # Width of this icon in axes-fraction units
        ax_bbox = ax.get_position()
        fig_w = fig.get_size_inches()[0] * fig.dpi
        ax_w_px = ax_bbox.width * fig_w
        icon_w_frac = (img_w * zoom) / ax_w_px if ax_w_px > 0 else 0.1

        imagebox = OffsetImage(img, zoom=zoom)
        imagebox.image.axes = ax

        ab = AnnotationBbox(
            imagebox,
            (x_offset, 1.0),
            xycoords="axes fraction",
            box_alignment=(0.0, 0.0),
            frameon=False,
            pad=0.1,
        )
        ax.add_artist(ab)

        # Advance x position for the next icon (add small gap)
        x_offset += icon_w_frac + 0.01


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
    logo_path: str | None = None,
    logo_zoom: float = 0.07,
    show_icons: bool = False,
    icon_zoom: float = 0.06,
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
        Path to an image file overlaid **inside** the axes at the lower-right
        corner (legacy parameter).  For a logo placed at the top-right
        *in line with the chart title*, use *logo_path* instead.
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
    logo_path : str or None, optional
        Path to a logo image file (PNG, JPEG, etc.).  When supplied, the logo
        is placed at the **top-right of the figure, in line with the chart
        title**.  Use *logo_zoom* to control the size.
    logo_zoom : float, optional
        Logo height as a fraction of the figure height (default ``0.07``).
        Increase for a larger logo; decrease for a smaller one.
    show_icons : bool, optional
        When ``True``, display NHS MDC variation and assurance icons on the
        chart.  The variation icon appears at the top-left and the assurance
        icon at the top-right (default ``False``).  Assurance icons require
        a *target* to be set; otherwise the empty/no-target icon is shown.
    icon_zoom : float, optional
        Icon height as a fraction of the figure height (default ``0.06``).

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
            logo_path=logo_path,
            logo_zoom=logo_zoom,
            show_icons=show_icons,
            icon_zoom=icon_zoom,
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

    # --- Logo (after tight_layout so ax.get_position() is finalised) --------
    if logo_path is not None:
        add_logo(fig, ax, logo_path, zoom=logo_zoom)
    if nhs_logo_path is not None:
        add_nhs_logo(ax, nhs_logo_path, position="lower right")

    # --- MDC variation & assurance icons ------------------------------------
    if show_icons:
        variation = determine_variation_type(
            result,
            value_col=value_col,
            improvement_direction=improvement_direction,
        )
        assurance = determine_assurance_type(
            result, target=target, improvement_direction=improvement_direction,
        )
        _add_mdc_icons(
            fig, ax, variation, assurance,
            icon_zoom=icon_zoom,
            improvement_direction=improvement_direction,
        )

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
    logo_path: str | None = None,
    logo_zoom: float = 0.07,
    show_icons: bool = False,
    icon_zoom: float = 0.06,
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
    logo_path : str or None, optional
        Path to a logo image file (PNG, JPEG, etc.).  When supplied, the logo
        is placed at the **top-right of the figure, in line with the chart
        title**.  Use *logo_zoom* to control the size.
    logo_zoom : float, optional
        Logo height as a fraction of the figure height (default ``0.07``).

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

    # --- Logo (after tight_layout so ax.get_position() is finalised) --------
    if logo_path is not None:
        add_logo(fig, ax, logo_path, zoom=logo_zoom)
    if nhs_logo_path is not None:
        add_nhs_logo(ax, nhs_logo_path, position="lower right")

    # --- MDC variation icon (run charts have no assurance) -------------------
    if show_icons:
        # Run charts don't have UCL/LCL, so only variation icon applies.
        # Determine variation from run signals instead.
        run_signal = result["run_signal"].to_numpy(dtype=bool)
        if not run_signal.any():
            variation = "common_cause"
        else:
            values_arr = result[value_col].to_numpy(dtype=float)
            median_arr = result["mean"].to_numpy(dtype=float)
            last_sig = int(np.where(run_signal)[0][-1])
            val_is_high = values_arr[last_sig] > median_arr[last_sig]
            if improvement_direction == "high":
                variation = "improvement_high" if val_is_high else "concern_low"
            else:
                variation = "concern_high" if val_is_high else "improvement_low"
        _add_mdc_icons(
            fig, ax, variation, "no_target",
            icon_zoom=icon_zoom,
            improvement_direction=improvement_direction,
        )

    return fig, ax


# ---------------------------------------------------------------------------
# MDC Summary Table
# ---------------------------------------------------------------------------

_VARIATION_LABELS = {
    "improvement_high": "Special-cause improvement (high)",
    "improvement_low": "Special-cause improvement (low)",
    "common_cause": "Common-cause variation",
    "concern_high": "Special-cause concern (high)",
    "concern_low": "Special-cause concern (low)",
}

_ASSURANCE_LABELS = {
    "pass": "Consistently meeting target",
    "hit_or_miss": "Hit or miss – may or may not meet target",
    "fail": "Consistently failing to meet target",
    "no_target": "No target set",
}


def plot_mdc_summary_table(
    rows: list[dict],
    *,
    title: str | None = "MDC Summary",
    figsize: tuple[float, float] | None = None,
    icon_zoom: float = 0.04,
) -> tuple[matplotlib.figure.Figure, matplotlib.axes.Axes]:
    """Render an NHS MDC-style summary table with variation & assurance icons.

    Each item in *rows* describes one measure.  Required keys:

    * ``"data"``   – ``pd.DataFrame`` containing the measure's time-series.
    * ``"chart_type"`` – ``"XmR"``, ``"p"``, ``"u"``, ``"c"``, or ``"run"``.

    Optional keys (all have sensible defaults):

    * ``"measure"`` – display name (default ``"Measure"``).
    * ``"description"`` – free-text description (default ``""``).
    * ``"value_col"`` – column with values (default ``"value"``).
    * ``"improvement_direction"`` – ``"high"`` or ``"low"`` (default ``"high"``).
    * ``"target"`` – numeric target, or ``None``.
    * ``"subgroup_col"`` – subgroup column for ``"p"``/``"u"`` charts.

    Parameters
    ----------
    rows : list[dict]
        One dict per measure (see above).
    title : str | None
        Title rendered above the table.
    figsize : tuple | None
        ``(width, height)`` in inches.  Auto-calculated when ``None``.
    icon_zoom : float
        Icon height as a fraction of figure height.

    Returns
    -------
    fig, ax : matplotlib objects
    """
    from matplotlib.offsetbox import OffsetImage, AnnotationBbox
    import matplotlib.image as mpimg

    n = len(rows)
    if n == 0:
        raise ValueError("rows must contain at least one measure dict")

    # 9 columns: Measure | Description | icon | Variation | icon | Assurance | icon | Improvement Direction | Value
    col_labels = [
        "Measure", "Description", "", "Variation", "", "Assurance",
        "", "Improvement Direction", "Latest Value",
    ]
    n_cols = len(col_labels)

    if figsize is None:
        figsize = (18, 1.2 + n * 0.9)

    fig, ax = plt.subplots(figsize=figsize)
    ax.set_axis_off()

    # ---- build cell text and compute variation / assurance ------------------
    cell_text: list[list[str]] = []
    # (row_idx, col_idx_in_table, icon_path_str)
    icon_cells: list[tuple[int, int, str]] = []

    for i, row in enumerate(rows):
        data = row["data"]
        chart_type = row.get("chart_type", "XmR")
        measure = row.get("measure", "Measure")
        description = row.get("description", "")
        value_col = row.get("value_col", "value")
        improvement_direction = row.get("improvement_direction", "high")
        target = row.get("target", None)
        subgroup_col = row.get("subgroup_col", "subgroup_size")

        is_run = chart_type.lower() == "run"

        # Calculate limits and detect signals
        if is_run:
            result = calculate_control_limits(data, chart_type="run", value_col=value_col)
            result = detect_run_chart_signals(result, value_col=value_col)
        else:
            result = calculate_control_limits(
                data, chart_type=chart_type, value_col=value_col,
                subgroup_col=subgroup_col if chart_type.lower() in ("p", "u") else None,
            )
            result = detect_special_causes(result, value_col=value_col)

        # Variation
        if is_run:
            run_signal = result["run_signal"].to_numpy(dtype=bool)
            if not run_signal.any():
                variation = "common_cause"
            else:
                values_arr = result[value_col].to_numpy(dtype=float)
                median_arr = result["mean"].to_numpy(dtype=float)
                last_sig = int(np.where(run_signal)[0][-1])
                val_is_high = values_arr[last_sig] > median_arr[last_sig]
                if improvement_direction == "high":
                    variation = "improvement_high" if val_is_high else "concern_low"
                else:
                    variation = "concern_high" if val_is_high else "improvement_low"
        else:
            variation = determine_variation_type(
                result, value_col=value_col, improvement_direction=improvement_direction,
            )

        # Assurance
        if is_run or target is None:
            assurance = "no_target"
        else:
            assurance = determine_assurance_type(
                result, target=target, improvement_direction=improvement_direction,
            )

        latest_val = result[value_col].iloc[-1]
        latest_str = f"{latest_val:.4g}"

        variation_label = _VARIATION_LABELS.get(variation, variation)
        assurance_label = _ASSURANCE_LABELS.get(assurance, assurance)
        direction_label = "Higher is better" if improvement_direction == "high" else "Lower is better"

        # Columns: Measure | Description | (icon) | Variation | (icon) | Assurance | (icon) | Imp. Direction | Value
        cell_text.append([
            measure, description, "", variation_label, "", assurance_label,
            "", direction_label, latest_str,
        ])

        # Queue icon inserts — col 2 = variation, col 4 = assurance, col 6 = direction
        var_path = _VARIATION_ICON_MAP.get(variation)
        if var_path and var_path.exists():
            icon_cells.append((i, 2, str(var_path)))

        ass_path = _ASSURANCE_ICON_MAP.get(assurance)
        if ass_path and ass_path.exists():
            icon_cells.append((i, 4, str(ass_path)))

        dir_path = _IMPROVEMENT_DIR_ICON_MAP.get(improvement_direction)
        if dir_path and dir_path.exists():
            icon_cells.append((i, 6, str(dir_path)))

    # ---- draw table ---------------------------------------------------------
    table = ax.table(
        cellText=cell_text,
        colLabels=col_labels,
        loc="center",
        cellLoc="center",
    )
    table.auto_set_font_size(False)
    table.set_fontsize(9)
    table.scale(1.0, 2.2)

    # Set relative column widths — icon columns narrow, text columns wider
    col_widths = [0.11, 0.19, 0.04, 0.17, 0.04, 0.17, 0.04, 0.12, 0.07]
    for j, w in enumerate(col_widths):
        for r in range(n + 1):  # header + data rows
            table[r, j].set_width(w)

    # Style header row
    for j in range(n_cols):
        cell = table[0, j]
        cell.set_facecolor(NHS_DARK_BLUE)
        cell.set_text_props(color="white", fontweight="bold")

    # Alternate row colours
    for i in range(n):
        for j in range(n_cols):
            cell = table[i + 1, j]
            cell.set_facecolor("#F0F4F5" if i % 2 == 0 else "white")
            cell.set_edgecolor("#D8DDE0")

    # Make icon column borders match surrounding cells (seamless look)
    for i in range(n + 1):  # header + data rows
        for icon_col in (2, 4, 6):
            cell = table[i, icon_col]
            cell.set_edgecolor("#D8DDE0")

    # ---- finalise layout BEFORE placing icons --------------------------------
    if title:
        fig.suptitle(title, fontsize=13, fontweight="bold", y=0.98)
    fig.tight_layout(rect=[0, 0, 1, 0.95] if title else [0, 0, 1, 1])

    # ---- place icons centred in their dedicated cells -----------------------
    fig.canvas.draw()  # resolve table cell positions after layout
    renderer = fig.canvas.get_renderer()
    fig_h = fig.get_size_inches()[1] * fig.dpi

    for row_idx, col_idx, icon_path_str in icon_cells:
        cell = table[row_idx + 1, col_idx]  # +1 for header offset
        bbox = cell.get_window_extent(renderer)
        bbox_fig = bbox.transformed(fig.transFigure.inverted())
        cx = bbox_fig.x0 + bbox_fig.width * 0.5
        cy = bbox_fig.y0 + bbox_fig.height * 0.5

        img = mpimg.imread(icon_path_str)
        target_h = icon_zoom * fig_h
        zoom = target_h / img.shape[0] if img.shape[0] > 0 else 0.1

        imagebox = OffsetImage(img, zoom=zoom)
        ab = AnnotationBbox(
            imagebox,
            (cx, cy),
            xycoords="figure fraction",
            frameon=False,
            pad=0,
        )
        fig.add_artist(ab)

    return fig, ax
