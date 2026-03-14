"""
tests/conftest.py
=================
Shared pytest fixtures for the custom_spc_mdc test suite.
"""

import numpy as np
import pytest

# Dimensions of the synthetic logo image used in tests
_LOGO_HEIGHT_PX = 40
_LOGO_WIDTH_PX = 80
_LOGO_FILL = 0.7   # grey level (0–1)


@pytest.fixture
def logo_file(tmp_path):
    """Create a minimal PNG logo file for testing logo-placement features."""
    import matplotlib.image as mpimg

    logo = np.full(
        (_LOGO_HEIGHT_PX, _LOGO_WIDTH_PX, 3),
        fill_value=_LOGO_FILL,
        dtype=np.float32,
    )
    path = str(tmp_path / "test_logo.png")
    mpimg.imsave(path, logo)
    return path
