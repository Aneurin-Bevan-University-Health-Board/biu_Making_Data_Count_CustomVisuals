"""
tests/test_utils.py
===================
Unit tests for the custom_spc_mdc.utils module.
"""

import pytest
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from custom_spc_mdc.utils import validate_data, add_target_line, add_shading


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
