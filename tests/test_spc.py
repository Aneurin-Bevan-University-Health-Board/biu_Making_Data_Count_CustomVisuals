"""
tests/test_spc.py
=================
Unit tests for the custom_spc_mdc.spc module.
"""

import pytest
import numpy as np
import pandas as pd

from custom_spc_mdc.spc import (
    calculate_control_limits,
    detect_special_causes,
    determine_point_colours,
    COLOUR_COMMON_CAUSE,
    COLOUR_IMPROVEMENT,
    COLOUR_CONCERN,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def xmr_data():
    """Simple XmR dataset with 10 observations."""
    return pd.DataFrame({"value": [10, 12, 11, 15, 9, 13, 11, 14, 10, 12]})


@pytest.fixture
def p_data():
    """p-chart dataset: 10 rows with subgroup sizes and proportions."""
    return pd.DataFrame(
        {
            "value": [0.10, 0.12, 0.08, 0.15, 0.09, 0.11, 0.10, 0.13, 0.07, 0.12],
            "subgroup_size": [100] * 10,
        }
    )


@pytest.fixture
def u_data():
    """u-chart dataset: 10 rows with subgroup sizes."""
    return pd.DataFrame(
        {
            "value": [2.1, 1.8, 2.3, 2.0, 1.9, 2.5, 2.1, 1.7, 2.2, 2.0],
            "subgroup_size": [50] * 10,
        }
    )


@pytest.fixture
def c_data():
    """c-chart dataset: 10 rows of counts."""
    return pd.DataFrame({"value": [3, 5, 2, 6, 4, 3, 7, 5, 4, 6]})


# ---------------------------------------------------------------------------
# calculate_control_limits
# ---------------------------------------------------------------------------


class TestCalculateControlLimitsXmR:
    def test_returns_dataframe(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        assert isinstance(result, pd.DataFrame)

    def test_adds_required_columns(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        for col in ("mean", "ucl", "lcl"):
            assert col in result.columns, f"Missing column '{col}'"

    def test_mean_is_average(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        expected_mean = xmr_data["value"].mean()
        assert result["mean"].iloc[0] == pytest.approx(expected_mean)

    def test_ucl_gt_mean(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        assert (result["ucl"] > result["mean"]).all()

    def test_lcl_lt_mean(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        assert (result["lcl"] < result["mean"]).all()

    def test_does_not_mutate_input(self, xmr_data):
        original_cols = list(xmr_data.columns)
        calculate_control_limits(xmr_data, chart_type="XmR")
        assert list(xmr_data.columns) == original_cols

    def test_case_insensitive_chart_type(self, xmr_data):
        result_lower = calculate_control_limits(xmr_data, chart_type="xmr")
        result_upper = calculate_control_limits(xmr_data, chart_type="XmR")
        pd.testing.assert_frame_equal(result_lower, result_upper)


class TestCalculateControlLimitsP:
    def test_returns_dataframe(self, p_data):
        result = calculate_control_limits(p_data, chart_type="p")
        assert isinstance(result, pd.DataFrame)

    def test_lcl_non_negative(self, p_data):
        result = calculate_control_limits(p_data, chart_type="p")
        assert (result["lcl"] >= 0).all()

    def test_ucl_between_0_and_1(self, p_data):
        result = calculate_control_limits(p_data, chart_type="p")
        assert (result["ucl"] <= 1.0).all()

    def test_mean_constant_equal_subgroups(self, p_data):
        """With equal subgroup sizes mean should be constant."""
        result = calculate_control_limits(p_data, chart_type="p")
        assert result["mean"].nunique() == 1

    def test_numerator_col(self):
        """Test p-chart when numerator and denominator are separate columns."""
        df = pd.DataFrame(
            {
                "numerator": [10, 12, 8, 15, 9],
                "value": [100, 100, 100, 100, 100],
            }
        )
        result = calculate_control_limits(
            df, chart_type="p", value_col="value", numerator_col="numerator"
        )
        # After calculation, value col should contain proportions
        assert (result["value"] <= 1.0).all()


class TestCalculateControlLimitsU:
    def test_returns_dataframe(self, u_data):
        result = calculate_control_limits(u_data, chart_type="u")
        assert isinstance(result, pd.DataFrame)

    def test_lcl_non_negative(self, u_data):
        result = calculate_control_limits(u_data, chart_type="u")
        assert (result["lcl"] >= 0).all()


class TestCalculateControlLimitsC:
    def test_returns_dataframe(self, c_data):
        result = calculate_control_limits(c_data, chart_type="c")
        assert isinstance(result, pd.DataFrame)

    def test_mean_equals_average_of_counts(self, c_data):
        result = calculate_control_limits(c_data, chart_type="c")
        expected_mean = c_data["value"].mean()
        assert result["mean"].iloc[0] == pytest.approx(expected_mean)

    def test_lcl_non_negative(self, c_data):
        result = calculate_control_limits(c_data, chart_type="c")
        assert (result["lcl"] >= 0).all()


class TestCalculateControlLimitsErrors:
    def test_invalid_chart_type(self, xmr_data):
        with pytest.raises(ValueError, match="Unsupported chart_type"):
            calculate_control_limits(xmr_data, chart_type="invalid")

    def test_not_dataframe(self):
        with pytest.raises(TypeError):
            calculate_control_limits([1, 2, 3], chart_type="XmR")

    def test_empty_dataframe(self):
        with pytest.raises(ValueError, match="empty"):
            calculate_control_limits(pd.DataFrame(), chart_type="XmR")

    def test_missing_value_column(self):
        df = pd.DataFrame({"x": [1, 2, 3]})
        with pytest.raises(ValueError, match="not found"):
            calculate_control_limits(df, chart_type="XmR")

    def test_missing_subgroup_column_for_p_chart(self):
        df = pd.DataFrame({"value": [0.1, 0.2, 0.3]})
        with pytest.raises(ValueError, match="subgroup"):
            calculate_control_limits(df, chart_type="p", subgroup_col=None)


# ---------------------------------------------------------------------------
# detect_special_causes
# ---------------------------------------------------------------------------


class TestDetectSpecialCauses:
    def test_adds_rule_columns(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        flags = detect_special_causes(result)
        for col in ("rule1", "rule2", "rule3", "special_cause"):
            assert col in flags.columns

    def test_rule1_flags_outside_limits(self):
        """A point far outside control limits should trigger Rule 1."""
        values = [10] * 9 + [100]  # last point is astronomical
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="XmR")
        flags = detect_special_causes(result)
        assert flags["rule1"].iloc[-1], "Last (astronomical) point should trigger Rule 1"

    def test_rule2_detects_shift(self):
        """Six consecutive points all above the mean should trigger Rule 2."""
        # mean ≈ 10; first 4 points pull mean down, last 6 well above
        values = [5, 5, 5, 5, 20, 20, 20, 20, 20, 20]
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="XmR")
        flags = detect_special_causes(result)
        # The last 6 points should all be flagged
        assert flags["rule2"].iloc[4:].all()

    def test_rule3_detects_trend(self):
        """Five consecutive strictly increasing points should trigger Rule 3."""
        values = [1, 2, 3, 4, 5, 3, 3, 3, 3, 3]
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="XmR")
        flags = detect_special_causes(result)
        assert flags["rule3"].iloc[:5].all()

    def test_no_special_cause_stable_process(self):
        """Stable process with points clustered around mean should have no special causes."""
        np.random.seed(42)
        values = list(np.random.normal(50, 1, 20))
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="XmR")
        flags = detect_special_causes(result)
        # In a near-ideal stable process there should be no special causes
        assert not flags["special_cause"].any()

    def test_special_cause_is_union_of_rules(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        flags = detect_special_causes(result)
        expected = flags["rule1"] | flags["rule2"] | flags["rule3"]
        pd.testing.assert_series_equal(
            flags["special_cause"], expected, check_names=False
        )


# ---------------------------------------------------------------------------
# determine_point_colours
# ---------------------------------------------------------------------------


class TestDeterminePointColours:
    def test_returns_list_of_correct_length(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        flags = detect_special_causes(result)
        colours = determine_point_colours(flags)
        assert len(colours) == len(xmr_data)

    def test_common_cause_colour(self, xmr_data):
        """All points in a stable process should be common-cause coloured."""
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        flags = detect_special_causes(result)
        # Force all special_cause flags to False
        flags["rule1"] = False
        flags["rule2"] = False
        flags["rule3"] = False
        flags["special_cause"] = False
        colours = determine_point_colours(flags)
        assert all(c == COLOUR_COMMON_CAUSE for c in colours)

    def test_improvement_direction_high(self):
        """Point above UCL with improvement_direction='high' should be improvement."""
        values = [10] * 9 + [100]
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="XmR")
        flags = detect_special_causes(result)
        colours = determine_point_colours(flags, improvement_direction="high")
        assert colours[-1] == COLOUR_IMPROVEMENT

    def test_improvement_direction_low(self):
        """Point above UCL with improvement_direction='low' should be concern."""
        values = [10] * 9 + [100]
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="XmR")
        flags = detect_special_causes(result)
        colours = determine_point_colours(flags, improvement_direction="low")
        assert colours[-1] == COLOUR_CONCERN

    def test_invalid_improvement_direction(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        flags = detect_special_causes(result)
        with pytest.raises(ValueError, match="improvement_direction"):
            determine_point_colours(flags, improvement_direction="sideways")

    def test_missing_flag_columns_raises(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        # Not running detect_special_causes first
        with pytest.raises(ValueError, match="missing columns"):
            determine_point_colours(result)

    def test_target_based_colouring(self):
        """With target set, points closer to target than mean should be improvement."""
        values = [10] * 9 + [100]
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="XmR")
        flags = detect_special_causes(result)
        # target=110 means point at 100 is moving towards it
        colours = determine_point_colours(flags, target=110, improvement_direction="high")
        assert colours[-1] == COLOUR_IMPROVEMENT
