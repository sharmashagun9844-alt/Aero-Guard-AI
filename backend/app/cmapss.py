"""NASA C-MAPSS column layout and sensor descriptions.

Layout: unit, cycle, 3 operational settings, 21 sensor channels (26 columns, no header in the
original .txt files). Sensor names follow the C-MAPSS documentation (Saxena & Goebel, 2008).
"""
from __future__ import annotations

CMAPSS_COLUMNS: list[str] = ["unit", "cycle", "op1", "op2", "op3"] + [f"s{i}" for i in range(1, 22)]
DEFAULT_FEATURES: list[str] = ["op1", "op2", "op3"] + [f"s{i}" for i in range(1, 22)]

SENSORS: dict[str, dict[str, str]] = {
    "s1": {"symbol": "T2", "label": "Total temperature at fan inlet"},
    "s2": {"symbol": "T24", "label": "Total temperature at LPC outlet"},
    "s3": {"symbol": "T30", "label": "Total temperature at HPC outlet"},
    "s4": {"symbol": "T50", "label": "Total temperature at LPT outlet"},
    "s5": {"symbol": "P2", "label": "Pressure at fan inlet"},
    "s6": {"symbol": "P15", "label": "Total pressure in bypass duct"},
    "s7": {"symbol": "P30", "label": "Total pressure at HPC outlet"},
    "s8": {"symbol": "Nf", "label": "Physical fan speed"},
    "s9": {"symbol": "Nc", "label": "Physical core speed"},
    "s10": {"symbol": "epr", "label": "Engine pressure ratio"},
    "s11": {"symbol": "Ps30", "label": "Static pressure at HPC outlet"},
    "s12": {"symbol": "phi", "label": "Ratio of fuel flow to Ps30"},
    "s13": {"symbol": "NRf", "label": "Corrected fan speed"},
    "s14": {"symbol": "NRc", "label": "Corrected core speed"},
    "s15": {"symbol": "BPR", "label": "Bypass ratio"},
    "s16": {"symbol": "farB", "label": "Burner fuel-air ratio"},
    "s17": {"symbol": "htBleed", "label": "Bleed enthalpy"},
    "s18": {"symbol": "Nf_dmd", "label": "Demanded fan speed"},
    "s19": {"symbol": "PCNfR_dmd", "label": "Demanded corrected fan speed"},
    "s20": {"symbol": "W31", "label": "HPT coolant bleed"},
    "s21": {"symbol": "W32", "label": "LPT coolant bleed"},
}
