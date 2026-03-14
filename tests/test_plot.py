"""
tests/test_plot.py
==================
Unit tests for the custom_spc_mdc.plot module.
"""

import pytest
import numpy as np
import pandas as pd
import matplotlib
import matplotlib.pyplot as plt

matplotlib.use("Agg")

from custom_spc_mdc.plot import plot_spc_chart, plot_run_chart


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
            auto_rebase=True, improvement_direction="high",
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
            change_points=change_points,
        )
        assert isinstance(fig, matplotlib.figure.Figure)


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
