"""Reading and validating uploaded sensor files. Pure functions, no FastAPI imports."""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .cmapss import CMAPSS_COLUMNS

ACCEPTED_EXTENSIONS = (".csv", ".txt", ".tsv")


class ValidationFailure(Exception):
    """Raised with one or more user-facing messages describing what to fix."""

    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors))
        self.errors = errors


@dataclass
class ParsedUpload:
    df: pd.DataFrame
    header_detected: bool
    delimiter: str
    warnings: list[str] = field(default_factory=list)


_UNIT = re.compile(r"^(unit|unit_?(number|id|nr|no)|engine|engine_?(id|no|nr|number)|id)$")
_CYCLE = re.compile(r"^(cycle|cycles|time|time_?in_?cycles|t)$")
_OP = re.compile(r"^(op|setting|op_?setting|operational_?setting|operating_?setting)_?([1-3])$")
_SENSOR = re.compile(r"^(s|sensor|sensor_?measurement|sensor_?)_?0*([1-9]|1[0-9]|2[01])$")


def normalize_column(name: str) -> str:
    key = re.sub(r"[\s\-\.]+", "_", str(name).strip().lower())
    if _UNIT.match(key):
        return "unit"
    if _CYCLE.match(key):
        return "cycle"
    m = _OP.match(key)
    if m:
        return f"op{m.group(2)}"
    m = _SENSOR.match(key)
    if m:
        return f"s{int(m.group(2))}"
    return key


def _decode(raw: bytes) -> str:
    for enc in ("utf-8-sig", "utf-16"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ValidationFailure(["The file is not valid text. Upload a CSV or whitespace-separated .txt file."])


def _split(line: str, delim: str) -> list[str]:
    return line.strip().split() if delim == r"\s+" else [t.strip() for t in line.strip().split(delim)]


def _is_number(tok: str) -> bool:
    try:
        float(tok)
        return True
    except ValueError:
        return False


def read_upload(raw: bytes, filename: str, max_rows: int) -> ParsedUpload:
    """Parse CSV / TSV / whitespace-separated text. Accepts the original headerless C-MAPSS layout."""
    name = (filename or "").lower()
    if not name.endswith(ACCEPTED_EXTENSIONS):
        raise ValidationFailure([f"Unsupported file type. Upload one of: {', '.join(ACCEPTED_EXTENSIONS)}."])
    if not raw.strip():
        raise ValidationFailure(["The file is empty."])

    text = _decode(raw)
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if len(lines) < 2:
        raise ValidationFailure(["The file needs at least one row of sensor readings."])

    first = lines[0]
    delim = "," if "," in first else ";" if ";" in first else "\t" if "\t" in first else r"\s+"
    tokens = _split(first, delim)
    header_detected = not all(_is_number(t) for t in tokens if t != "")
    warnings: list[str] = []

    try:
        df = pd.read_csv(
            io.StringIO(text),
            sep=delim,
            engine="python" if delim == r"\s+" else "c",
            header=0 if header_detected else None,
            skipinitialspace=True,
            skip_blank_lines=True,
        )
    except Exception as exc:  # pandas raises many error types for malformed input
        raise ValidationFailure([f"The file could not be parsed as tabular data ({type(exc).__name__}). Check the delimiter and row lengths."]) from exc

    df = df.dropna(axis=1, how="all")  # trailing delimiters in the original C-MAPSS .txt files

    if header_detected:
        df.columns = [normalize_column(c) for c in df.columns]
        dupes = sorted({c for c in df.columns if list(df.columns).count(c) > 1})
        if dupes:
            raise ValidationFailure([f"Duplicate columns after normalisation: {', '.join(dupes)}."])
    else:
        if df.shape[1] != len(CMAPSS_COLUMNS):
            raise ValidationFailure([
                f"No header row found, so the file must use the original C-MAPSS layout with {len(CMAPSS_COLUMNS)} columns "
                f"(unit, cycle, 3 operational settings, 21 sensors). Found {df.shape[1]} columns. "
                "Add a header row with column names instead."
            ])
        df.columns = CMAPSS_COLUMNS
        warnings.append("No header row detected; columns were assigned using the NASA C-MAPSS layout.")

    if len(df) > max_rows:
        raise ValidationFailure([f"The file has {len(df):,} rows; the limit is {max_rows:,}."])
    return ParsedUpload(df=df, header_detected=header_detected, delimiter="whitespace" if delim == r"\s+" else repr(delim), warnings=warnings)


def validate_frame(parsed: ParsedUpload, features: list[str], max_units: int) -> pd.DataFrame:
    """Return a cleaned frame with numeric unit/cycle and all required features, or raise ValidationFailure."""
    df = parsed.df.copy()
    errors: list[str] = []

    missing = [c for c in features if c not in df.columns]
    if missing:
        errors.append(f"Missing required column(s): {', '.join(missing)}.")

    if "unit" not in df.columns:
        df["unit"] = 1
        parsed.warnings.append("No 'unit' column found; all rows were treated as a single engine (unit 1).")
    if "cycle" not in df.columns:
        df["cycle"] = df.groupby("unit").cumcount() + 1
        parsed.warnings.append("No 'cycle' column found; cycles were numbered from row order within each unit.")

    for col in ["unit", "cycle", *[c for c in features if c in df.columns]]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        bad = df[col].isna() | ~np.isfinite(df[col].to_numpy(dtype=float, na_value=np.nan))
        if bad.any():
            first_rows = ", ".join(str(i + 1 + (1 if parsed.header_detected else 0)) for i in df.index[bad][:5])
            errors.append(f"Column '{col}' has {int(bad.sum())} empty or non-numeric value(s) (first at file line {first_rows}).")

    if errors:
        raise ValidationFailure(errors)

    df["unit"] = df["unit"].astype(int)
    df["cycle"] = df["cycle"].astype(int)
    if df["unit"].nunique() > max_units:
        raise ValidationFailure([f"The file contains {df['unit'].nunique():,} engines; the limit is {max_units:,}."])
    if df.duplicated(["unit", "cycle"]).any():
        raise ValidationFailure(["Some (unit, cycle) pairs appear more than once. Each engine needs one row per cycle."])
    return df.sort_values(["unit", "cycle"]).reset_index(drop=True)
