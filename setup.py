"""
setup.py – Legacy build support for abspc.

Modern packaging metadata is defined in pyproject.toml.  This file is kept
for compatibility with tools that do not yet fully support PEP 517/518.
"""

from setuptools import setup, find_packages

setup(
    name="abspc",
    version="0.1.6",
    author="Aneurin Bevan University Health Board, Daniel Westwood",
    author_email="daniel.westwood@wales.nhs.uk",
    description=(
        "Statistical Process Control charts following the NHS "
        "Making Data Count methodology"
    ),
    packages=find_packages(include=["abspc", "abspc.*"]),
    python_requires=">=3.9",
    install_requires=[
        "numpy>=1.23",
        "pandas>=1.5",
        "matplotlib>=3.6",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0",
            "pytest-cov>=4.0",
        ],
    },
)
