"""
tests/test_spc.py
=================
Unit tests for the abspc.spc module.
"""

import pytest
import numpy as np
import pandas as pd

from abspc.spc import (
    calculate_control_limits,
    detect_special_causes,
    detect_run_chart_signals,
    rebase_control_limits,
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
# calculate_control_limits – SPC charts
# ---------------------------------------------------------------------------


class TestCalculateControlLimitsXmR:
    def test_returns_dataframe(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        assert isinstance(result, pd.DataFrame)

    def test_adds_required_columns(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        for col in ("mean", "ucl", "lcl", "uwl", "lwl"):
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

    def test_uwl_between_mean_and_ucl(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        assert (result["uwl"] > result["mean"]).all()
        assert (result["uwl"] < result["ucl"]).all()

    def test_lwl_between_mean_and_lcl(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        assert (result["lwl"] < result["mean"]).all()
        assert (result["lwl"] > result["lcl"]).all()

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

    def test_lwl_non_negative(self, p_data):
        result = calculate_control_limits(p_data, chart_type="p")
        assert (result["lwl"] >= 0).all()

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
        assert (result["value"] <= 1.0).all()


class TestCalculateControlLimitsU:
    def test_returns_dataframe(self, u_data):
        result = calculate_control_limits(u_data, chart_type="u")
        assert isinstance(result, pd.DataFrame)

    def test_lcl_non_negative(self, u_data):
        result = calculate_control_limits(u_data, chart_type="u")
        assert (result["lcl"] >= 0).all()

    def test_adds_warning_limits(self, u_data):
        result = calculate_control_limits(u_data, chart_type="u")
        assert "uwl" in result.columns
        assert "lwl" in result.columns


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

    def test_adds_warning_limits(self, c_data):
        result = calculate_control_limits(c_data, chart_type="c")
        assert "uwl" in result.columns


class TestCalculateControlLimitsRun:
    def test_returns_dataframe(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="run")
        assert isinstance(result, pd.DataFrame)

    def test_mean_is_median(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="run")
        expected_median = xmr_data["value"].median()
        assert result["mean"].iloc[0] == pytest.approx(expected_median)

    def test_no_control_limit_columns(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="run")
        assert "ucl" not in result.columns
        assert "lcl" not in result.columns

    def test_case_insensitive(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="RUN")
        assert "mean" in result.columns


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

    def test_adds_rule4_when_warning_limits_present(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        flags = detect_special_causes(result)
        assert "rule4" in flags.columns

    def test_rule1_flags_outside_limits(self):
        """A point far outside control limits should trigger Rule 1."""
        values = [10] * 9 + [100]
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="XmR")
        flags = detect_special_causes(result)
        assert flags["rule1"].iloc[-1]

    def test_rule2_detects_shift_seven_points(self):
        """Seven consecutive points all above the mean should trigger Rule 2."""
        # 3 low baseline points + 7 high points well above
        values = [5, 5, 5, 20, 20, 20, 20, 20, 20, 20]
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="XmR")
        flags = detect_special_causes(result)
        assert flags["rule2"].iloc[3:].all()

    def test_rule2_not_triggered_with_six_points(self):
        """Only 6 consecutive above mean — should NOT trigger Rule 2 (NHS MDC uses 7)."""
        values = [5, 5, 5, 5, 20, 20, 20, 20, 20, 20]
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="XmR")
        flags = detect_special_causes(result)
        assert not flags["rule2"].any()

    def test_rule3_detects_trend_seven_points(self):
        """Seven consecutive strictly increasing points should trigger Rule 3."""
        values = [1, 2, 3, 4, 5, 6, 7, 5, 5, 5]
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="XmR")
        flags = detect_special_causes(result)
        assert flags["rule3"].iloc[:7].all()

    def test_rule3_not_triggered_with_five_points(self):
        """Only 5 increasing points — should NOT trigger Rule 3 (NHS MDC uses 7)."""
        values = [1, 2, 3, 4, 5, 3, 3, 3, 3, 3]
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="XmR")
        flags = detect_special_causes(result)
        assert not flags["rule3"].any()

    def test_rule4_two_in_three(self):
        """2 of 3 consecutive points in warning zone on same side trigger Rule 4."""
        from abspc.spc import _rule4_two_in_three
        n = 10
        # 7 stable values at mean, then 2 in the warning zone with 1 in-between
        values = np.array([10.0] * 7 + [14.0, 10.5, 14.0])
        mean = np.full(n, 10.0)
        ucl = np.full(n, 15.0)
        lcl = np.full(n, 5.0)
        uwl = np.full(n, 13.0)
        lwl = np.full(n, 7.0)
        flags = _rule4_two_in_three(values, mean, ucl, lcl, uwl, lwl)
        # Indices 7 and 9 are in the warning zone in window [7,8,9]
        assert flags[7]
        assert flags[9]

    def test_no_special_cause_stable_process(self):
        """Stable process should have no special causes."""
        np.random.seed(42)
        values = list(np.random.normal(50, 1, 20))
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="XmR")
        flags = detect_special_causes(result)
        assert not flags["special_cause"].any()

    def test_special_cause_is_union_of_rules(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        flags = detect_special_causes(result)
        has_rule4 = "rule4" in flags.columns
        if has_rule4:
            expected = flags["rule1"] | flags["rule2"] | flags["rule3"] | flags["rule4"]
        else:
            expected = flags["rule1"] | flags["rule2"] | flags["rule3"]
        pd.testing.assert_series_equal(
            flags["special_cause"], expected, check_names=False
        )


# ---------------------------------------------------------------------------
# detect_run_chart_signals
# ---------------------------------------------------------------------------


class TestDetectRunChartSignals:
    def test_adds_run_signal_columns(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="run")
        flags = detect_run_chart_signals(result)
        for col in ("run_shift", "run_trend", "run_signal"):
            assert col in flags.columns

    def test_run_shift_seven_points(self):
        """Seven consecutive points strictly above median trigger run_shift."""
        # 15 values: first 8 keep median=14, last 7 are all > 14
        values = [1, 2, 3, 4, 5, 6, 7, 14, 15, 16, 17, 18, 19, 20, 21]
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="run")
        flags = detect_run_chart_signals(result)
        # Indices 8–14 are all > median (14); they form a 7-point shift
        assert flags["run_shift"].iloc[8:].all()

    def test_run_trend_seven_points(self):
        """Seven consecutive increasing points should trigger run_trend."""
        values = [1, 2, 3, 4, 5, 6, 7, 5, 5, 5]
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="run")
        flags = detect_run_chart_signals(result)
        assert flags["run_trend"].iloc[:7].all()

    def test_run_signal_is_union(self, xmr_data):
        result = calculate_control_limits(xmr_data, chart_type="run")
        flags = detect_run_chart_signals(result)
        expected = flags["run_shift"] | flags["run_trend"]
        pd.testing.assert_series_equal(
            flags["run_signal"], expected, check_names=False
        )


# ---------------------------------------------------------------------------
# rebase_control_limits
# ---------------------------------------------------------------------------


class TestRebaseControlLimits:
    def test_returns_dataframe(self, xmr_data):
        result = rebase_control_limits(xmr_data, chart_type="XmR")
        assert isinstance(result, pd.DataFrame)

    def test_adds_rebase_phase_column(self, xmr_data):
        result = rebase_control_limits(xmr_data, chart_type="XmR")
        assert "rebase_phase" in result.columns

    def test_baseline_phase_is_zero(self, xmr_data):
        """Stable process with no improvement shift should stay on phase 0."""
        result = rebase_control_limits(xmr_data, chart_type="XmR")
        assert (result["rebase_phase"] == 0).all()

    def test_detects_improvement_shift_high(self):
        """Seven consecutive high points trigger a phase boundary."""
        # Low baseline (phase 0) then 7 clearly higher points (phase 1)
        values = [5.0] * 10 + [30.0] * 10
        df = pd.DataFrame({"value": values})
        result = rebase_control_limits(
            df, chart_type="XmR", improvement_direction="high"
        )
        assert result["rebase_phase"].max() >= 1
        assert result["rebase_phase"].iloc[10] == 1

    def test_detects_improvement_shift_low(self):
        """Seven consecutive low points trigger a phase boundary (improvement_direction='low')."""
        values = [30.0] * 10 + [5.0] * 10
        df = pd.DataFrame({"value": values})
        result = rebase_control_limits(
            df, chart_type="XmR", improvement_direction="low"
        )
        assert result["rebase_phase"].max() >= 1

    def test_new_phase_has_different_mean(self):
        """After a rebase, the mean in the new phase should reflect the new data."""
        values = [5.0] * 10 + [30.0] * 10
        df = pd.DataFrame({"value": values})
        result = rebase_control_limits(
            df, chart_type="XmR", improvement_direction="high"
        )
        mean_phase0 = result.loc[result["rebase_phase"] == 0, "mean"].iloc[0]
        mean_phase1 = result.loc[result["rebase_phase"] == 1, "mean"].iloc[0]
        assert mean_phase1 > mean_phase0

    def test_run_chart_raises(self, xmr_data):
        with pytest.raises(ValueError, match="run"):
            rebase_control_limits(xmr_data, chart_type="run")

    def test_invalid_improvement_direction(self, xmr_data):
        with pytest.raises(ValueError, match="improvement_direction"):
            rebase_control_limits(
                xmr_data, chart_type="XmR", improvement_direction="sideways"
            )

    def test_no_infinite_loop_low_direction(self):
        """Regression: auto_rebase with improvement_direction='low' must not hang.

        Data with a low cluster followed by high values can cause rel_idx == 0
        in _find_improvement_shift_start, leading to no forward progress in the
        while loop.  The fix ensures the loop terminates immediately when
        rel_idx == 0.
        """
        values = [50.0] * 10 + [10.0] * 7 + [100.0] * 3
        df = pd.DataFrame({"value": values})
        # Must complete in well under a second (previously hung forever)
        result = rebase_control_limits(
            df, chart_type="XmR", improvement_direction="low"
        )
        assert isinstance(result, pd.DataFrame)
        assert len(result) == len(df)

    def test_no_infinite_loop_high_direction(self):
        """Same regression guard for improvement_direction='high'."""
        values = [50.0] * 10 + [90.0] * 7 + [1.0] * 3
        df = pd.DataFrame({"value": values})
        result = rebase_control_limits(
            df, chart_type="XmR", improvement_direction="high"
        )
        assert isinstance(result, pd.DataFrame)
        assert len(result) == len(df)


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
        result = calculate_control_limits(xmr_data, chart_type="XmR")
        flags = detect_special_causes(result)
        flags["rule1"] = False
        flags["rule2"] = False
        flags["rule3"] = False
        if "rule4" in flags.columns:
            flags["rule4"] = False
        flags["special_cause"] = False
        colours = determine_point_colours(flags)
        assert all(c == COLOUR_COMMON_CAUSE for c in colours)

    def test_improvement_direction_high(self):
        values = [10] * 9 + [100]
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="XmR")
        flags = detect_special_causes(result)
        colours = determine_point_colours(flags, improvement_direction="high")
        assert colours[-1] == COLOUR_IMPROVEMENT

    def test_improvement_direction_low(self):
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
        with pytest.raises(ValueError, match="missing columns"):
            determine_point_colours(result)

    def test_target_based_colouring(self):
        values = [10] * 9 + [100]
        df = pd.DataFrame({"value": values})
        result = calculate_control_limits(df, chart_type="XmR")
        flags = detect_special_causes(result)
        colours = determine_point_colours(flags, target=110, improvement_direction="high")
        assert colours[-1] == COLOUR_IMPROVEMENT
