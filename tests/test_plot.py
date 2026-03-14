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

matplotlib.use("Agg")  # non-interactive backend for tests

from custom_spc_mdc.plot import plot_spc_chart


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def close_figures():
    """Ensure all figures are closed after each test to avoid resource leaks."""
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


# ---------------------------------------------------------------------------
# Tests
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
        # The target line should be an additional axhline; check line count
        assert len(ax.lines) >= 4  # mean + ucl + lcl + data connector + target

    def test_no_target_line_when_show_target_false(self, xmr_data):
        fig_no, ax_no = plot_spc_chart(xmr_data, chart_type="XmR", show_target=False)
        fig_yes, ax_yes = plot_spc_chart(
            xmr_data, chart_type="XmR", show_target=True, target=11.0
        )
        # Chart with target should have more lines
        assert len(ax_yes.lines) > len(ax_no.lines)

    def test_shade_band(self, xmr_data):
        fig, ax = plot_spc_chart(xmr_data, chart_type="XmR", shade_band=True)
        # fill_between adds to ax.collections
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
        """Should not raise when improvement_direction='low'."""
        fig, ax = plot_spc_chart(
            xmr_data, chart_type="XmR", improvement_direction="low"
        )
        assert isinstance(fig, matplotlib.figure.Figure)
