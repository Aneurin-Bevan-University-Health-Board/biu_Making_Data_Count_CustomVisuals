"""
tests/test_utils.py
===================
Unit tests for the abspc.utils module.
"""

import pytest
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from abspc.utils import validate_data, add_target_line, add_shading, add_change_line, add_logo


# ---------------------------------------------------------------------------
# validate_data
# ---------------------------------------------------------------------------


class TestValidateData:
    def test_valid_xmr(self):
        df = pd.DataFrame({"value": [1.0, 2.0, 3.0]})
        validate_data(df, "xmr")  # should not raise

    def test_valid_p(self):
        df = pd.DataFrame({"value": [0.1, 0.2], "subgroup_size": [100, 100]})
        validate_data(df, "p")  # should not raise

    def test_valid_u(self):
        df = pd.DataFrame({"value": [2.0, 3.0], "subgroup_size": [50, 50]})
        validate_data(df, "u")  # should not raise

    def test_not_dataframe_raises_typeerror(self):
        with pytest.raises(TypeError):
            validate_data([1, 2, 3], "xmr")

    def test_empty_dataframe_raises(self):
        with pytest.raises(ValueError, match="empty"):
            validate_data(pd.DataFrame(), "xmr")

    def test_missing_value_col(self):
        df = pd.DataFrame({"x": [1, 2, 3]})
        with pytest.raises(ValueError, match="not found"):
            validate_data(df, "xmr")

    def test_non_numeric_value_col(self):
        df = pd.DataFrame({"value": ["a", "b", "c"]})
        with pytest.raises(ValueError, match="numeric"):
            validate_data(df, "xmr")

    def test_missing_subgroup_col_for_p(self):
        df = pd.DataFrame({"value": [0.1, 0.2]})
        with pytest.raises(ValueError, match="subgroup"):
            validate_data(df, "p")

    def test_zero_subgroup_size_raises(self):
        df = pd.DataFrame({"value": [0.1, 0.2], "subgroup_size": [0, 100]})
        with pytest.raises(ValueError, match="> 0"):
            validate_data(df, "p")


# ---------------------------------------------------------------------------
# add_target_line
# ---------------------------------------------------------------------------


class TestAddTargetLine:
    def test_adds_a_line(self):
        fig, ax = plt.subplots()
        initial_lines = len(ax.lines)
        add_target_line(ax, target=50.0)
        assert len(ax.lines) == initial_lines + 1
        plt.close(fig)

    def test_correct_y_value(self):
        fig, ax = plt.subplots()
        add_target_line(ax, target=42.0)
        # axhline adds an infinite line; check ydata is constant at 42
        line = ax.lines[-1]
        assert line.get_ydata()[0] == pytest.approx(42.0)
        plt.close(fig)


# ---------------------------------------------------------------------------
# add_shading
# ---------------------------------------------------------------------------


class TestAddShading:
    def test_adds_collection(self):
        fig, ax = plt.subplots()
        x = np.arange(5)
        lower = np.zeros(5)
        upper = np.ones(5)
        initial_collections = len(ax.collections)
        add_shading(ax, x, lower, upper)
        assert len(ax.collections) > initial_collections
        plt.close(fig)


# ---------------------------------------------------------------------------
# add_change_line
# ---------------------------------------------------------------------------


class TestAddChangeLine:
    def test_adds_a_vertical_line(self):
        fig, ax = plt.subplots()
        ax.set_xlim(0, 10)
        ax.set_ylim(0, 100)
        initial_lines = len(ax.lines)
        add_change_line(ax, x=5)
        assert len(ax.lines) > initial_lines
        plt.close(fig)

    def test_adds_text_label_when_provided(self):
        fig, ax = plt.subplots()
        ax.set_xlim(0, 10)
        ax.set_ylim(0, 100)
        initial_texts = len(ax.texts)
        add_change_line(ax, x=5, label="New protocol")
        assert len(ax.texts) > initial_texts
        plt.close(fig)

    def test_no_text_when_label_is_none(self):
        fig, ax = plt.subplots()
        ax.set_xlim(0, 10)
        ax.set_ylim(0, 100)
        initial_texts = len(ax.texts)
        add_change_line(ax, x=5, label=None)
        assert len(ax.texts) == initial_texts
        plt.close(fig)


# ---------------------------------------------------------------------------
# add_logo
# ---------------------------------------------------------------------------


class TestAddLogo:
    def test_adds_an_inset_axes(self, logo_file):
        """add_logo should add a new axes to the figure."""
        fig, ax = plt.subplots(figsize=(12, 5))
        ax.plot([1, 2, 3], [1, 2, 3])
        fig.tight_layout()
        initial_axes_count = len(fig.axes)
        add_logo(fig, ax, logo_file)
        assert len(fig.axes) > initial_axes_count
        plt.close(fig)

    def test_logo_axes_has_no_visible_axes_frame(self, logo_file):
        """The logo inset axes should have no frame or labels."""
        fig, ax = plt.subplots(figsize=(12, 5))
        ax.plot([1, 2, 3], [1, 2, 3])
        fig.tight_layout()
        add_logo(fig, ax, logo_file)
        logo_ax = fig.axes[-1]
        assert not logo_ax.axison
        plt.close(fig)

    def test_logo_positioned_above_axes_top(self, logo_file):
        """The logo inset axes should sit above the main axes top edge."""
        fig, ax = plt.subplots(figsize=(12, 5))
        ax.plot([1, 2, 3], [1, 2, 3])
        fig.tight_layout()
        ax_top = ax.get_position().y1
        add_logo(fig, ax, logo_file)
        logo_ax = fig.axes[-1]
        logo_bottom = logo_ax.get_position().y0
        assert logo_bottom >= ax_top  # logo sits at or above the axes top
        plt.close(fig)

    def test_logo_right_aligned_with_axes(self, logo_file):
        """The logo right edge should be ≤ the axes right edge (with tolerance)."""
        fig, ax = plt.subplots(figsize=(12, 5))
        ax.plot([1, 2, 3], [1, 2, 3])
        fig.tight_layout()
        ax_right = ax.get_position().x1
        add_logo(fig, ax, logo_file)
        logo_ax = fig.axes[-1]
        logo_right = logo_ax.get_position().x1
        assert logo_right == pytest.approx(ax_right, abs=0.02)
        plt.close(fig)

    def test_missing_file_raises_file_not_found(self, tmp_path):
        fig, ax = plt.subplots()
        fig.tight_layout()
        with pytest.raises(FileNotFoundError, match="Logo not found"):
            add_logo(fig, ax, str(tmp_path / "nonexistent.png"))
        plt.close(fig)

    def test_zoom_changes_logo_size(self, logo_file):
        """A larger zoom value should produce a taller logo axes."""
        fig1, ax1 = plt.subplots(figsize=(12, 5))
        ax1.plot([0, 1], [0, 1])
        fig1.tight_layout()
        add_logo(fig1, ax1, logo_file, zoom=0.05)
        h_small = fig1.axes[-1].get_position().height
        plt.close(fig1)

        fig2, ax2 = plt.subplots(figsize=(12, 5))
        ax2.plot([0, 1], [0, 1])
        fig2.tight_layout()
        add_logo(fig2, ax2, logo_file, zoom=0.12)
        h_large = fig2.axes[-1].get_position().height
        plt.close(fig2)

        assert h_large > h_small
