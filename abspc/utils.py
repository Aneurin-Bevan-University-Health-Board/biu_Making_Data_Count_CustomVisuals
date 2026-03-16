"""
utils.py
========
Helper functions for the abspc package including data validation
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


def add_change_line(
    ax,
    x,
    label: str | None = None,
    color: str = "#425563",
    linestyle: str = ":",
    linewidth: float = 1.5,
    fontsize: int = 8,
    label_rotation: int = 90,
    label_offset: float = 0.01,
) -> None:
    """Draw a vertical change-point line with an optional text annotation.

    Use this to annotate the chart with dates or events where a known process
    change occurred (e.g. a new protocol, staff change, or system upgrade).

    Parameters
    ----------
    ax : matplotlib.axes.Axes
        The axes to annotate.
    x : scalar
        The x-axis position for the vertical line (index, numeric value, or
        date, matching the x-axis type of the chart).
    label : str or None, optional
        Text label to display alongside the line.  When ``None`` no text is
        added (default ``None``).
    color : str, optional
        Line and text colour (default NHS Neutral Grey ``"#425563"``).
    linestyle : str, optional
        Matplotlib line-style string (default ``":"``).
    linewidth : float, optional
        Line width in points (default ``1.5``).
    fontsize : int, optional
        Font size for the label text (default ``8``).
    label_rotation : int, optional
        Rotation of the label text in degrees (default ``90``).
    label_offset : float, optional
        Horizontal offset of the text label as a fraction of the axes width
        (default ``0.01``).
    """
    ax.axvline(
        x=x,
        color=color,
        linestyle=linestyle,
        linewidth=linewidth,
        zorder=5,
    )
    if label is not None:
        y_top = ax.get_ylim()[1]
        ax.text(
            x,
            y_top,
            f"  {label}",
            rotation=label_rotation,
            verticalalignment="top",
            horizontalalignment="left",
            fontsize=fontsize,
            color=color,
            zorder=6,
        )


def add_nhs_logo(
    ax,
    logo_path: str,
    position: str = "lower right",
    zoom: float = 0.12,
) -> None:
    """Overlay an image inside the axes at a cardinal corner position.

    .. note::
        To place a logo at the **top-right in line with the chart title**
        (the typical branding position), use :func:`add_logo` instead.

    Parameters
    ----------
    ax : matplotlib.axes.Axes
        The axes on which to place the logo.
    logo_path : str
        Absolute or relative path to the logo image file (PNG recommended).
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


def add_logo(
    fig,
    ax,
    logo_path: str,
    zoom: float = 0.07,
    padding: float = 0.005,
) -> None:
    """Place a logo at the top-right of the figure, level with the chart title.

    The logo is rendered as a new inset axes positioned in **figure-fraction**
    coordinates so that it sits in the margin above the main axes — visually
    aligned with the chart title.  This function must be called **after**
    ``fig.tight_layout()`` so that the axes position is finalised.

    Parameters
    ----------
    fig : matplotlib.figure.Figure
        The figure containing the chart.
    ax : matplotlib.axes.Axes
        The primary chart axes (used to determine right-edge alignment and
        the vertical position above the axes top).
    logo_path : str
        Path to the logo image file (PNG, JPEG, etc.).
    zoom : float, optional
        Logo height as a fraction of the figure height (default ``0.07``,
        i.e. 7 %).  Increase to make the logo larger; decrease to make it
        smaller.
    padding : float, optional
        Vertical gap between the top of the plot area and the bottom of the
        logo, as a fraction of figure height (default ``0.005``).

    Raises
    ------
    FileNotFoundError
        If *logo_path* does not point to an existing file.

    Examples
    --------
    >>> fig, ax = plot_spc_chart(data, chart_type="XmR", logo_path="logo.png")

    Or call directly after tight_layout:

    >>> from abspc.utils import add_logo
    >>> fig.tight_layout()
    >>> add_logo(fig, ax, "logo.png", zoom=0.08)
    """
    import os
    import matplotlib.image as mpimg

    if not os.path.isfile(logo_path):
        raise FileNotFoundError(f"Logo not found at: {logo_path}")

    logo_img = mpimg.imread(logo_path)
    img_h, img_w = logo_img.shape[:2]
    aspect = img_w / float(img_h)

    # Axes bounding box in figure fraction (finalised after tight_layout)
    ax_pos = ax.get_position()

    # Figure dimensions – needed to preserve the logo's pixel aspect ratio
    fig_w, fig_h = fig.get_size_inches()

    # Convert to figure-fraction dimensions
    logo_h = zoom                            # height fraction of figure
    logo_w = logo_h * aspect * (fig_h / fig_w)  # width fraction

    # Right-align logo with the right edge of the axes;
    # bottom edge sits just above the axes top (in the title margin)
    left   = ax_pos.x1 - logo_w
    bottom = ax_pos.y1 + padding

    logo_ax = fig.add_axes([left, bottom, logo_w, logo_h])
    logo_ax.imshow(logo_img)
    logo_ax.axis("off")


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
