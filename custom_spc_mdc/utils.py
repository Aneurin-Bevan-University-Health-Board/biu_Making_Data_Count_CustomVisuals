"""
utils.py
========
Helper functions for the custom_spc_mdc package including data validation
and chart annotation utilities.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Data validation
# ---------------------------------------------------------------------------


def validate_data(
    data: pd.DataFrame,
    chart_type: str,
    value_col: str = "value",
    subgroup_col: str | None = "subgroup_size",
) -> None:
    """Validate that *data* contains the required columns for *chart_type*.

    Parameters
    ----------
    data : pd.DataFrame
        The input DataFrame to validate.
    chart_type : str
        One of ``"xmr"``, ``"p"``, ``"u"``, ``"c"`` (case-insensitive before
        this call, already lower-cased by the caller).
    value_col : str, optional
        Name of the column containing measured values (default ``"value"``).
    subgroup_col : str or None, optional
        Name of the column containing subgroup sizes.  Required for ``"p"``
        and ``"u"`` charts.

    Raises
    ------
    TypeError
        If *data* is not a :class:`pandas.DataFrame`.
    ValueError
        If the DataFrame is empty, if required columns are missing, or if any
        value column contains non-numeric data.
    """
    if not isinstance(data, pd.DataFrame):
        raise TypeError(f"data must be a pandas DataFrame, got {type(data).__name__}")

    if data.empty:
        raise ValueError("data DataFrame is empty")

    if value_col not in data.columns:
        raise ValueError(
            f"Column '{value_col}' not found in data. "
            f"Available columns: {list(data.columns)}"
        )

    # Ensure the value column is numeric
    if not pd.api.types.is_numeric_dtype(data[value_col]):
        raise ValueError(
            f"Column '{value_col}' must be numeric, "
            f"got dtype '{data[value_col].dtype}'"
        )

    if chart_type in {"p", "u"}:
        if subgroup_col is None or subgroup_col not in data.columns:
            raise ValueError(
                f"Chart type '{chart_type}' requires a subgroup size column. "
                f"Expected column '{subgroup_col}' in data. "
                f"Available columns: {list(data.columns)}"
            )
        if not pd.api.types.is_numeric_dtype(data[subgroup_col]):
            raise ValueError(
                f"Subgroup column '{subgroup_col}' must be numeric, "
                f"got dtype '{data[subgroup_col].dtype}'"
            )
        if (data[subgroup_col] <= 0).any():
            raise ValueError(
                f"All values in subgroup column '{subgroup_col}' must be > 0"
            )


# ---------------------------------------------------------------------------
# Annotation helpers (used by plot.py)
# ---------------------------------------------------------------------------


def add_target_line(
    ax,
    target: float,
    color: str = "#FFB81C",
    linestyle: str = "--",
    linewidth: float = 1.5,
    label: str = "Target",
) -> None:
    """Draw a horizontal target line on *ax*.

    Parameters
    ----------
    ax : matplotlib.axes.Axes
        The axes to annotate.
    target : float
        The target value to draw the line at.
    color : str, optional
        Line colour (default NHS Warm Yellow ``#FFB81C``).
    linestyle : str, optional
        Matplotlib line-style string (default ``"--"``).
    linewidth : float, optional
        Line width in points (default ``1.5``).
    label : str, optional
        Legend label for the target line (default ``"Target"``).
    """
    ax.axhline(
        y=target,
        color=color,
        linestyle=linestyle,
        linewidth=linewidth,
        label=label,
        zorder=2,
    )


def add_nhs_logo(
    ax,
    logo_path: str,
    position: str = "lower right",
    zoom: float = 0.12,
) -> None:
    """Overlay the NHS logo on *ax* at the requested position.

    Parameters
    ----------
    ax : matplotlib.axes.Axes
        The axes on which to place the logo.
    logo_path : str
        Absolute or relative path to the NHS logo image file (PNG recommended).
    position : str, optional
        One of ``"upper left"``, ``"upper right"``, ``"lower left"``,
        ``"lower right"`` (default ``"lower right"``).
    zoom : float, optional
        Scaling factor applied to the logo image (default ``0.12``).

    Raises
    ------
    FileNotFoundError
        If *logo_path* does not point to an existing file.
    """
    import os
    from matplotlib.offsetbox import AnnotationBbox, OffsetImage
    import matplotlib.image as mpimg

    if not os.path.isfile(logo_path):
        raise FileNotFoundError(f"NHS logo not found at: {logo_path}")

    logo = mpimg.imread(logo_path)
    imagebox = OffsetImage(logo, zoom=zoom)

    _POSITION_MAP = {
        "upper left": (0.02, 0.95),
        "upper right": (0.98, 0.95),
        "lower left": (0.02, 0.05),
        "lower right": (0.98, 0.05),
    }

    if position not in _POSITION_MAP:
        raise ValueError(
            f"position must be one of {list(_POSITION_MAP)}, got '{position}'"
        )

    xy = _POSITION_MAP[position]
    ab = AnnotationBbox(
        imagebox,
        xy,
        xycoords="axes fraction",
        frameon=False,
        box_alignment=(1, 0) if "right" in position else (0, 0),
    )
    ax.add_artist(ab)


def add_shading(
    ax,
    x: np.ndarray | list,
    lower: np.ndarray | list,
    upper: np.ndarray | list,
    color: str = "#41B6E6",
    alpha: float = 0.15,
    label: str | None = None,
) -> None:
    """Shade the region between *lower* and *upper* on *ax*.

    Typically used to shade the tolerance band between the control limits.

    Parameters
    ----------
    ax : matplotlib.axes.Axes
        The axes to shade.
    x : array-like
        x-coordinates (e.g. index or date values).
    lower : array-like
        Lower boundary of the shaded band.
    upper : array-like
        Upper boundary of the shaded band.
    color : str, optional
        Fill colour (default NHS Light Blue ``#41B6E6``).
    alpha : float, optional
        Opacity of the fill (default ``0.15``).
    label : str or None, optional
        Legend label for the shaded region (default ``None``).
    """
    ax.fill_between(x, lower, upper, color=color, alpha=alpha, label=label, zorder=1)
