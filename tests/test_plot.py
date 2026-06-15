"""
tests/test_plot.py
==================
Unit tests for the abspc.plot module.
"""

import pytest
import numpy as np
import pandas as pd
import matplotlib
import matplotlib.pyplot as plt

matplotlib.use("Agg")

from abspc.plot import plot_spc_chart, plot_run_chart, plot_mdc_summary_table


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def close_figures():
    yield
    plt.close("all")


@pytest.fixture
def xmr_data():
    return pd.DataFrame({"value": [10, 12, 11, 15, 9, 13, 11, 14, 10, 12]})


@pytest.fixture
def p_data():
    return pd.DataFrame(
        {
            "value": [0.10, 0.12, 0.08, 0.15, 0.09, 0.11, 0.10, 0.13, 0.07, 0.12],
            "subgroup_size": [100] * 10,
        }
    )


@pytest.fixture
def c_data():
    return pd.DataFrame({"value": [3, 5, 2, 6, 4, 3, 7, 5, 4, 6]})


@pytest.fixture
def rebase_data():
    """20-point dataset with a clear improvement shift at index 10."""
    return pd.DataFrame({"value": [5.0] * 10 + [30.0] * 10})


# ---------------------------------------------------------------------------
# plot_spc_chart – basic
# ---------------------------------------------------------------------------


class TestPlotSpcChart:
    def test_returns_fig_and_ax(self, xmr_data):
        fig, ax = plot_spc_chart(xmr_data, chart_type="XmR")
        assert isinstance(fig, matplotlib.figure.Figure)
        assert isinstance(ax, matplotlib.axes.Axes)

    def test_xmr_chart(self, xmr_data):
        fig, ax = plot_spc_chart(xmr_data, chart_type="XmR")
        assert ax.get_title() != ""

    def test_p_chart(self, p_data):
        fig, ax = plot_spc_chart(p_data, chart_type="p")
        assert ax.get_title() != ""

    def test_c_chart(self, c_data):
        fig, ax = plot_spc_chart(c_data, chart_type="c")
        assert ax.get_title() != ""

    def test_custom_title(self, xmr_data):
        fig, ax = plot_spc_chart(xmr_data, chart_type="XmR", title="My Custom Title")
        assert ax.get_title() == "My Custom Title"

    def test_custom_labels(self, xmr_data):
        fig, ax = plot_spc_chart(
            xmr_data, chart_type="XmR", xlabel="Date", ylabel="Rate"
        )
        assert ax.get_xlabel() == "Date"
        assert ax.get_ylabel() == "Rate"

    def test_target_line_appears(self, xmr_data):
        fig, ax = plot_spc_chart(
            xmr_data, chart_type="XmR", show_target=True, target=11.0
        )
        assert len(ax.lines) >= 4

    def test_no_target_line_when_show_target_false(self, xmr_data):
        fig_no, ax_no = plot_spc_chart(xmr_data, chart_type="XmR", show_target=False)
        fig_yes, ax_yes = plot_spc_chart(
            xmr_data, chart_type="XmR", show_target=True, target=11.0
        )
        assert len(ax_yes.lines) > len(ax_no.lines)

    def test_shade_band(self, xmr_data):
        fig, ax = plot_spc_chart(xmr_data, chart_type="XmR", shade_band=True)
        assert len(ax.collections) > 0

    def test_accepts_existing_axes(self, xmr_data):
        fig_ext, ax_ext = plt.subplots()
        fig_ret, ax_ret = plot_spc_chart(xmr_data, chart_type="XmR", ax=ax_ext)
        assert ax_ret is ax_ext
        assert fig_ret is fig_ext

    def test_legend_present_by_default(self, xmr_data):
        fig, ax = plot_spc_chart(xmr_data, chart_type="XmR", show_legend=True)
        assert ax.get_legend() is not None

    def test_legend_absent_when_disabled(self, xmr_data):
        fig, ax = plot_spc_chart(xmr_data, chart_type="XmR", show_legend=False)
        assert ax.get_legend() is None

    def test_improvement_direction_low(self, xmr_data):
        fig, ax = plot_spc_chart(
            xmr_data, chart_type="XmR", improvement_direction="low"
        )
        assert isinstance(fig, matplotlib.figure.Figure)

    def test_run_chart_dispatches_to_plot_run_chart(self, xmr_data):
        """chart_type='run' produces a run chart (no UCL/LCL lines)."""
        fig_spc, ax_spc = plot_spc_chart(xmr_data, chart_type="XmR")
        fig_run, ax_run = plot_spc_chart(xmr_data, chart_type="run")
        assert len(ax_run.lines) < len(ax_spc.lines)

    def test_run_chart_title(self, xmr_data):
        fig, ax = plot_spc_chart(xmr_data, chart_type="run")
        assert "Run" in ax.get_title()


# ---------------------------------------------------------------------------
# plot_spc_chart – change_points
# ---------------------------------------------------------------------------


class TestPlotSpcChartChangePoints:
    def test_single_change_point_adds_line(self, xmr_data):
        change_points = [{"x": 4, "label": "Policy change"}]
        fig_base, ax_base = plot_spc_chart(xmr_data, chart_type="XmR")
        fig_cp, ax_cp = plot_spc_chart(
            xmr_data, chart_type="XmR", change_points=change_points
        )
        assert len(ax_cp.lines) > len(ax_base.lines)

    def test_multiple_change_points(self, xmr_data):
        change_points = [
            {"x": 3, "label": "Change A"},
            {"x": 7, "label": "Change B"},
        ]
        fig, ax = plot_spc_chart(
            xmr_data, chart_type="XmR", change_points=change_points
        )
        assert isinstance(fig, matplotlib.figure.Figure)

    def test_change_points_none_no_extra_lines(self, xmr_data):
        fig_base, ax_base = plot_spc_chart(xmr_data, chart_type="XmR")
        fig_none, ax_none = plot_spc_chart(
            xmr_data, chart_type="XmR", change_points=None
        )
        assert len(ax_base.lines) == len(ax_none.lines)


# ---------------------------------------------------------------------------
# plot_spc_chart – annotations
# ---------------------------------------------------------------------------


class TestPlotSpcChartAnnotations:
    def test_single_point_annotation_adds_line(self, xmr_data):
        annotations = [{"start": 4, "label": "New plan"}]
        fig_base, ax_base = plot_spc_chart(xmr_data, chart_type="XmR")
        fig_ann, ax_ann = plot_spc_chart(
            xmr_data, chart_type="XmR", annotations=annotations
        )
        assert len(ax_ann.lines) > len(ax_base.lines)

    def test_period_annotation_adds_shading_and_lines(self, xmr_data):
        annotations = [{"start": 2, "end": 5, "label": "Improvement phase"}]
        fig_base, ax_base = plot_spc_chart(xmr_data, chart_type="XmR")
        fig_ann, ax_ann = plot_spc_chart(
            xmr_data, chart_type="XmR", annotations=annotations
        )
        # Period annotation adds 2 boundary lines
        assert len(ax_ann.lines) > len(ax_base.lines)

    def test_multiple_annotations(self, xmr_data):
        annotations = [
            {"start": 2, "label": "Event A"},
            {"start": 5, "end": 8, "label": "Phase B"},
        ]
        fig, ax = plot_spc_chart(
            xmr_data, chart_type="XmR", annotations=annotations
        )
        assert isinstance(fig, matplotlib.figure.Figure)

    def test_annotations_none_no_extra_lines(self, xmr_data):
        fig_base, ax_base = plot_spc_chart(xmr_data, chart_type="XmR")
        fig_none, ax_none = plot_spc_chart(
            xmr_data, chart_type="XmR", annotations=None
        )
        assert len(ax_base.lines) == len(ax_none.lines)

    def test_annotations_with_dates(self):
        dates = pd.date_range("2023-01-01", periods=24, freq="MS")
        data = pd.DataFrame({"value": list(range(10, 34))}, index=dates)
        annotations = [
            {"start": pd.Timestamp("2023-07-01"), "label": "New protocol"},
            {
                "start": pd.Timestamp("2024-01-01"),
                "end": pd.Timestamp("2024-06-01"),
                "label": "Pilot phase",
            },
        ]
        fig, ax = plot_spc_chart(
            data, chart_type="XmR", annotations=annotations
        )
        assert isinstance(fig, matplotlib.figure.Figure)

    def test_annotations_custom_color_and_alpha(self, xmr_data):
        annotations = [
            {"start": 3, "end": 7, "label": "Phase", "color": "#005EB8", "alpha": 0.3}
        ]
        fig, ax = plot_spc_chart(
            xmr_data, chart_type="XmR", annotations=annotations
        )
        assert isinstance(fig, matplotlib.figure.Figure)

    def test_run_chart_dispatch_passes_annotations(self, xmr_data):
        """chart_type='run' should pass annotations through to plot_run_chart."""
        annotations = [{"start": 4, "label": "Event"}]
        fig_base, ax_base = plot_spc_chart(xmr_data, chart_type="run")
        fig_ann, ax_ann = plot_spc_chart(
            xmr_data, chart_type="run", annotations=annotations
        )
        assert len(ax_ann.lines) > len(ax_base.lines)


# ---------------------------------------------------------------------------
# plot_run_chart – annotations
# ---------------------------------------------------------------------------


class TestPlotRunChartAnnotations:
    def test_single_annotation_adds_line(self, xmr_data):
        annotations = [{"start": 5, "label": "Change"}]
        fig_base, ax_base = plot_run_chart(xmr_data)
        fig_ann, ax_ann = plot_run_chart(xmr_data, annotations=annotations)
        assert len(ax_ann.lines) > len(ax_base.lines)

    def test_period_annotation(self, xmr_data):
        annotations = [{"start": 2, "end": 6, "label": "Pilot"}]
        fig, ax = plot_run_chart(xmr_data, annotations=annotations)
        assert isinstance(fig, matplotlib.figure.Figure)


# ---------------------------------------------------------------------------
# plot_spc_chart – auto_rebase
# ---------------------------------------------------------------------------


class TestPlotSpcChartAutoRebase:
    def test_auto_rebase_false_no_change(self, xmr_data):
        fig, ax = plot_spc_chart(xmr_data, chart_type="XmR", auto_rebase=False)
        assert isinstance(fig, matplotlib.figure.Figure)

    def test_auto_rebase_true_with_improvement(self, rebase_data):
        """auto_rebase=True on clear improvement data adds a phase line."""
        fig_no, ax_no = plot_spc_chart(
            rebase_data, chart_type="XmR", auto_rebase=False
        )
        fig_yes, ax_yes = plot_spc_chart(
            rebase_data, chart_type="XmR",
            auto_rebase=True, improvement_direction="high", baseline=0,
        )
        assert len(ax_yes.lines) > len(ax_no.lines)

    def test_auto_rebase_true_stable_data_no_extra_lines(self, xmr_data):
        """auto_rebase=True on stable data adds no phase lines."""
        fig_no, ax_no = plot_spc_chart(xmr_data, chart_type="XmR", auto_rebase=False)
        fig_yes, ax_yes = plot_spc_chart(xmr_data, chart_type="XmR", auto_rebase=True)
        assert len(ax_yes.lines) == len(ax_no.lines)

    def test_auto_rebase_and_change_points_combined(self, rebase_data):
        change_points = [{"x": 5, "label": "Training"}]
        fig, ax = plot_spc_chart(
            rebase_data, chart_type="XmR",
            auto_rebase=True, improvement_direction="high",
            change_points=change_points, baseline=0,
        )
        assert isinstance(fig, matplotlib.figure.Figure)

    def test_invalid_rebase_on_raises(self, xmr_data):
        with pytest.raises(ValueError, match="rebase_on"):
            plot_spc_chart(xmr_data, chart_type="XmR", rebase_on="sideways")

    def test_invalid_baseline_raises(self, xmr_data):
        with pytest.raises(ValueError, match="baseline"):
            plot_spc_chart(xmr_data, chart_type="XmR", baseline=-5)

    def test_i_chart_auto_rebase_any_baseline(self):
        """I chart with auto_rebase/rebase_on='any'/baseline runs headless.

        The title/label must reflect the I chart even though the limits are
        computed exactly as for an XmR chart.
        """
        data = pd.DataFrame({"value": [5.0] * 12 + [30.0] * 12})
        fig, ax = plot_spc_chart(
            data, chart_type="I", auto_rebase=True,
            rebase_on="any", baseline=15,
        )
        assert isinstance(fig, matplotlib.figure.Figure)
        assert ax.get_title() == "I Chart (Individuals)"

    def test_i_chart_default_title(self, xmr_data):
        fig, ax = plot_spc_chart(xmr_data, chart_type="i")
        assert ax.get_title() == "I Chart (Individuals)"


# ---------------------------------------------------------------------------
# plot_run_chart
# ---------------------------------------------------------------------------


class TestPlotRunChart:
    def test_returns_fig_and_ax(self, xmr_data):
        fig, ax = plot_run_chart(xmr_data)
        assert isinstance(fig, matplotlib.figure.Figure)
        assert isinstance(ax, matplotlib.axes.Axes)

    def test_default_title(self, xmr_data):
        fig, ax = plot_run_chart(xmr_data)
        assert "Run" in ax.get_title()

    def test_custom_title(self, xmr_data):
        fig, ax = plot_run_chart(xmr_data, title="My Run Chart")
        assert ax.get_title() == "My Run Chart"

    def test_custom_labels(self, xmr_data):
        fig, ax = plot_run_chart(xmr_data, xlabel="Month", ylabel="Count")
        assert ax.get_xlabel() == "Month"
        assert ax.get_ylabel() == "Count"

    def test_target_line_appears(self, xmr_data):
        fig_no, ax_no = plot_run_chart(xmr_data, show_target=False)
        fig_yes, ax_yes = plot_run_chart(xmr_data, show_target=True, target=11.0)
        assert len(ax_yes.lines) > len(ax_no.lines)

    def test_legend_present_by_default(self, xmr_data):
        fig, ax = plot_run_chart(xmr_data)
        assert ax.get_legend() is not None

    def test_change_point_adds_line(self, xmr_data):
        change_points = [{"x": 5, "label": "Change"}]
        fig_base, ax_base = plot_run_chart(xmr_data)
        fig_cp, ax_cp = plot_run_chart(xmr_data, change_points=change_points)
        assert len(ax_cp.lines) > len(ax_base.lines)

    def test_improvement_direction_low(self, xmr_data):
        fig, ax = plot_run_chart(xmr_data, improvement_direction="low")
        assert isinstance(fig, matplotlib.figure.Figure)

    def test_invalid_improvement_direction(self, xmr_data):
        with pytest.raises(ValueError, match="improvement_direction"):
            plot_run_chart(xmr_data, improvement_direction="sideways")


# ---------------------------------------------------------------------------
# logo_path parameter (top-right, title-aligned logo)
# ---------------------------------------------------------------------------


class TestLogoPath:
    def test_spc_chart_logo_adds_inset_axes(self, xmr_data, logo_file):
        fig, ax = plot_spc_chart(xmr_data, chart_type="XmR", logo_path=logo_file)
        # The logo is added as an extra axes after tight_layout
        assert len(fig.axes) == 2  # main axes + logo inset

    def test_run_chart_logo_adds_inset_axes(self, xmr_data, logo_file):
        fig, ax = plot_run_chart(xmr_data, logo_path=logo_file)
        assert len(fig.axes) == 2

    def test_no_logo_no_extra_axes(self, xmr_data):
        fig, ax = plot_spc_chart(xmr_data, chart_type="XmR")
        assert len(fig.axes) == 1

    def test_logo_missing_file_raises(self, xmr_data, tmp_path):
        with pytest.raises(FileNotFoundError):
            plot_spc_chart(
                xmr_data, chart_type="XmR",
                logo_path=str(tmp_path / "nope.png"),
            )

    def test_logo_zoom_respected(self, xmr_data, logo_file):
        fig_small, _ = plot_spc_chart(
            xmr_data, chart_type="XmR", logo_path=logo_file, logo_zoom=0.04
        )
        fig_large, _ = plot_spc_chart(
            xmr_data, chart_type="XmR", logo_path=logo_file, logo_zoom=0.12
        )
        h_small = fig_small.axes[-1].get_position().height
        h_large = fig_large.axes[-1].get_position().height
        assert h_large > h_small

    def test_run_chart_dispatches_logo(self, xmr_data, logo_file):
        """chart_type='run' should also carry logo_path through dispatch."""
        fig, ax = plot_spc_chart(
            xmr_data, chart_type="run", logo_path=logo_file
        )
        assert len(fig.axes) == 2


# ---------------------------------------------------------------------------
# Date-axis support
# ---------------------------------------------------------------------------


@pytest.fixture
def date_index_data():
    """XmR data with a monthly DatetimeIndex (no separate date column)."""
    dates = pd.date_range("2023-01-01", periods=24, freq="MS")
    return pd.DataFrame({"value": list(range(10, 34))}, index=dates)


@pytest.fixture
def date_col_data():
    """XmR data with an explicit 'period' date column."""
    dates = pd.date_range("2022-01-01", periods=18, freq="MS")
    return pd.DataFrame(
        {"period": dates, "value": list(range(20, 38))}
    )


class TestDateAxis:
    """Tests for date-axis auto-detection and formatting."""

    def test_datetime_index_used_as_x(self, date_index_data):
        """When the DataFrame has a DatetimeIndex it should be used automatically."""
        fig, ax = plot_spc_chart(date_index_data, chart_type="XmR")
        # x-axis should be in date mode — formatter is a ConciseDateFormatter
        import matplotlib.dates as mdates
        assert isinstance(
            ax.xaxis.get_major_formatter(),
            (mdates.ConciseDateFormatter, mdates.DateFormatter),
        )

    def test_date_col_used_when_x_col_set(self, date_col_data):
        """Passing x_col pointing to a datetime column formats the axis."""
        fig, ax = plot_spc_chart(
            date_col_data, chart_type="XmR", x_col="period"
        )
        import matplotlib.dates as mdates
        assert isinstance(
            ax.xaxis.get_major_formatter(),
            (mdates.ConciseDateFormatter, mdates.DateFormatter),
        )

    def test_date_format_override(self, date_index_data):
        """date_format='%Y-%m' should produce a DateFormatter (not Concise)."""
        fig, ax = plot_spc_chart(
            date_index_data, chart_type="XmR", date_format="%Y-%m"
        )
        import matplotlib.dates as mdates
        assert isinstance(ax.xaxis.get_major_formatter(), mdates.DateFormatter)

    def test_integer_index_unchanged(self, xmr_data):
        """Plain integer data should not trigger date formatting."""
        fig, ax = plot_spc_chart(xmr_data, chart_type="XmR")
        import matplotlib.dates as mdates
        assert not isinstance(
            ax.xaxis.get_major_formatter(),
            (mdates.ConciseDateFormatter, mdates.DateFormatter),
        )

    def test_run_chart_date_index(self, date_index_data):
        """plot_run_chart should also pick up a DatetimeIndex."""
        fig, ax = plot_run_chart(date_index_data)
        import matplotlib.dates as mdates
        assert isinstance(
            ax.xaxis.get_major_formatter(),
            (mdates.ConciseDateFormatter, mdates.DateFormatter),
        )

    def test_change_points_with_dates(self, date_index_data):
        """change_points with Timestamp x values should not raise."""
        change_points = [
            {"x": pd.Timestamp("2023-07-01"), "label": "Intervention"}
        ]
        fig, ax = plot_spc_chart(
            date_index_data,
            chart_type="XmR",
            change_points=change_points,
        )
        assert isinstance(fig, matplotlib.figure.Figure)

    def test_tick_labels_rotated_for_dates(self, date_index_data):
        """Tick labels should be rotated 45° when the x-axis shows dates."""
        fig, ax = plot_spc_chart(date_index_data, chart_type="XmR")
        rotations = [t.get_rotation() for t in ax.xaxis.get_majorticklabels()]
        # After tight_layout the labels should be at 45°
        assert all(r == pytest.approx(45.0) for r in rotations if r != 0.0)


# ---------------------------------------------------------------------------
# Improvement-direction icon
# ---------------------------------------------------------------------------


class TestImprovementDirectionIcon:
    """Tests for the improvement-direction arrow icon shown with show_icons."""

    def test_spc_chart_icons_include_direction_high(self, xmr_data):
        """show_icons=True adds an improvement-direction icon for 'high'."""
        fig, ax = plot_spc_chart(
            xmr_data, chart_type="XmR", show_icons=True,
            improvement_direction="high",
        )
        # Three AnnotationBbox artists: variation + assurance + direction
        annot_boxes = [
            c for c in ax.get_children()
            if type(c).__name__ == "AnnotationBbox"
        ]
        assert len(annot_boxes) == 3

    def test_spc_chart_icons_include_direction_low(self, xmr_data):
        """show_icons=True adds an improvement-direction icon for 'low'."""
        fig, ax = plot_spc_chart(
            xmr_data, chart_type="XmR", show_icons=True,
            improvement_direction="low",
        )
        annot_boxes = [
            c for c in ax.get_children()
            if type(c).__name__ == "AnnotationBbox"
        ]
        assert len(annot_boxes) == 3

    def test_run_chart_icons_include_direction(self, xmr_data):
        """plot_run_chart with show_icons=True also shows direction icon."""
        fig, ax = plot_run_chart(
            xmr_data, show_icons=True, improvement_direction="low",
        )
        annot_boxes = [
            c for c in ax.get_children()
            if type(c).__name__ == "AnnotationBbox"
        ]
        # run chart: variation + no_target (empty) + direction = 3
        assert len(annot_boxes) >= 2  # at least variation + direction

    def test_no_direction_icon_when_show_icons_false(self, xmr_data):
        """show_icons=False should not add any annotation-box icons."""
        fig, ax = plot_spc_chart(
            xmr_data, chart_type="XmR", show_icons=False,
        )
        annot_boxes = [
            c for c in ax.get_children()
            if type(c).__name__ == "AnnotationBbox"
        ]
        assert len(annot_boxes) == 0
# Insufficient data warning for SPC charts (< 15 data points)
# ---------------------------------------------------------------------------


class TestInsufficientDataWarning:
    """SPC charts with fewer than 15 data points must display a warning."""

    def test_warning_shown_for_small_xmr(self):
        """XmR chart with < 15 points should show a warning text annotation."""
        data = pd.DataFrame({"value": list(range(10))})
        fig, ax = plot_spc_chart(data, chart_type="XmR")
        texts = [t.get_text() for t in ax.texts]
        assert any("Warning" in t and "15" in t for t in texts)

    def test_warning_shown_for_small_p_chart(self):
        data = pd.DataFrame({
            "value": [0.1, 0.2, 0.15, 0.12, 0.18],
            "subgroup_size": [100] * 5,
        })
        fig, ax = plot_spc_chart(data, chart_type="p")
        texts = [t.get_text() for t in ax.texts]
        assert any("Warning" in t for t in texts)

    def test_warning_shown_for_small_c_chart(self):
        data = pd.DataFrame({"value": [3, 5, 2, 6, 4]})
        fig, ax = plot_spc_chart(data, chart_type="c")
        texts = [t.get_text() for t in ax.texts]
        assert any("Warning" in t for t in texts)

    def test_no_warning_for_15_points(self):
        """Exactly 15 data points should NOT trigger the warning."""
        data = pd.DataFrame({"value": list(range(15))})
        fig, ax = plot_spc_chart(data, chart_type="XmR")
        texts = [t.get_text() for t in ax.texts]
        assert not any("Warning" in t for t in texts)

    def test_no_warning_for_more_than_15_points(self):
        data = pd.DataFrame({"value": list(range(20))})
        fig, ax = plot_spc_chart(data, chart_type="XmR")
        texts = [t.get_text() for t in ax.texts]
        assert not any("Warning" in t for t in texts)

    def test_no_warning_for_run_chart(self):
        """Run charts are not SPC charts — no minimum-data warning."""
        data = pd.DataFrame({"value": list(range(5))})
        fig, ax = plot_run_chart(data)
        texts = [t.get_text() for t in ax.texts]
        assert not any("Warning" in t for t in texts)

    def test_warning_contains_actual_count(self):
        """Warning text should mention the actual number of data points."""
        data = pd.DataFrame({"value": list(range(8))})
        fig, ax = plot_spc_chart(data, chart_type="XmR")
        texts = [t.get_text() for t in ax.texts]
        warning_texts = [t for t in texts if "Warning" in t]
        assert len(warning_texts) == 1
        assert "8" in warning_texts[0]
