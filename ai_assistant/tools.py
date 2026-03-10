import os
import re
import json
from typing import Any
from pathlib import Path

import pandas as pd


PLOT_REQUEST_BLOCK_RE = re.compile(r"```plot-request\s*(\{.*?\})\s*```", re.IGNORECASE | re.DOTALL)


def normalize_plot_payload(payload: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(payload, dict):
        return None

    rows = payload.get("rows")
    x_column = str(payload.get("x_column") or "").strip()
    series_columns = payload.get("series_columns")

    if not isinstance(rows, list) or not rows:
        return None
    if not x_column:
        return None
    if not isinstance(series_columns, list) or not series_columns:
        return None

    normalized_series = [str(col).strip() for col in series_columns if str(col).strip()]
    if not normalized_series:
        return None

    normalized_rows: list[dict[str, Any]] = []
    for item in rows:
        if not isinstance(item, dict):
            return None
        if x_column not in item:
            return None
        for col in normalized_series:
            if col not in item:
                return None
        normalized_rows.append(item)

    title = str(payload.get("title") or "Assistant Plot").strip() or "Assistant Plot"
    source_file = str(payload.get("source_file") or "").strip() or None

    return {
        "type": "timeseries",
        "title": title,
        "source_file": source_file,
        "rows": normalized_rows,
        "x_column": x_column,
        "series_columns": normalized_series,
    }


def resolve_current_input_dir(work_dir: str) -> Path:
    root = Path(work_dir).resolve()
    current_input_dir = (root / "current_input").resolve()
    if not current_input_dir.exists() or not current_input_dir.is_dir():
        raise FileNotFoundError(f"current_input directory not found under work directory: {root}")
    return current_input_dir


def get_file_path(base_dir: Path, filename: str) -> Path:
    safe_path = (base_dir / filename).resolve()
    safe_path.relative_to(base_dir.resolve())
    return safe_path


def read_current_input_summary(current_input_dir: Path) -> str:
    summary = []
    for root, _, files in os.walk(current_input_dir):
        for file in files:
            if file.endswith((".xlsx", ".csv")):
                rel_path = Path(root).relative_to(current_input_dir) / file
                summary.append(str(rel_path))

    if not summary:
        return "No .xlsx or .csv input files found in current_input."

    summary.sort()
    return "Available input files in current_input:\n" + "\n".join(summary)


def _is_plot_request(text: str) -> bool:
    q = (text or "").lower()
    return any(word in q for word in ["plot", "chart", "visual", "visualize", "visualization", "show"])


def _detect_demand_file(text: str) -> str | None:
    q = (text or "").lower()
    if any(k in q for k in ["cooldemand", "cool demand", "cooling demand", "cool"]):
        return "demand/tscr_cooldemand.csv"
    if any(k in q for k in ["heatdemand", "heat demand", "heating demand", "heat"]):
        return "demand/tscr_heatdemand.csv"
    if any(k in q for k in ["elecdemand", "electric demand", "electricity demand", "power demand", "elec"]):
        return "demand/tscr_elecdemand.csv"
    return None


def _find_csv_by_basename(current_input_dir: Path, basename: str) -> str | None:
    matches = sorted(current_input_dir.rglob(basename))
    if not matches:
        return None
    rel = matches[0].resolve().relative_to(current_input_dir.resolve())
    return str(rel).replace("\\", "/")


def _detect_csv_file_from_text(current_input_dir: Path, text: str) -> str | None:
    q = (text or "").strip()
    if not q:
        return None

    predefined = _detect_demand_file(q)
    if predefined:
        return predefined

    matches = re.findall(r"([A-Za-z0-9_./\\-]+\.csv)", q)
    if not matches:
        return None

    for candidate in reversed(matches):
        normalized = candidate.strip("`\"' ").replace("\\", "/")
        if not normalized:
            continue

        try:
            candidate_path = get_file_path(current_input_dir, normalized)
            if candidate_path.exists() and candidate_path.is_file():
                return normalized
        except Exception:
            pass

        basename = Path(normalized).name
        found = _find_csv_by_basename(current_input_dir, basename)
        if found:
            return found

    return None


def _extract_year(text: str) -> int | None:
    if not text:
        return None
    match = re.search(r"\b(20\d{2})\b", text)
    if not match:
        return None
    return int(match.group(1))


def _find_datetime_column(df: pd.DataFrame) -> str | None:
    candidate_names = [
        "time",
        "timestamp",
        "datetime",
        "date",
        "t",
    ]
    lowered = {str(c).strip().lower(): c for c in df.columns}
    for cand in candidate_names:
        if cand in lowered:
            return lowered[cand]

    for col in df.columns:
        parsed = pd.to_datetime(df[col], errors="coerce")
        if parsed.notna().mean() > 0.8:
            return str(col)
    return None


def _find_value_column(df: pd.DataFrame, time_col: str) -> str | None:
    for col in df.columns:
        if str(col) == str(time_col):
            continue
        parsed = pd.to_numeric(df[col], errors="coerce")
        if parsed.notna().mean() > 0.8:
            return str(col)
    return None


def extract_plot_request_block(assistant_message: str) -> tuple[str, dict | None]:
    text = str(assistant_message or "")
    match = PLOT_REQUEST_BLOCK_RE.search(text)
    if not match:
        return text, None

    payload_raw = match.group(1).strip()
    cleaned_text = (text[:match.start()] + text[match.end():]).strip()
    try:
        payload = json.loads(payload_raw)
        if not isinstance(payload, dict):
            return cleaned_text, None
        return cleaned_text, payload
    except Exception:
        return cleaned_text, None


def build_plot_payload_from_request(current_input_dir: Path, request: dict) -> dict | None:
    source_file = str((request or {}).get("source_file") or "").strip()
    if not source_file:
        return None

    csv_path = get_file_path(current_input_dir, source_file)
    if not csv_path.exists() or not csv_path.is_file():
        return {"error": f"Requested source_file not found in current_input: {source_file}"}

    df = pd.read_csv(csv_path)
    if df.empty:
        return {"error": f"File is empty: {source_file}"}

    time_col = _find_datetime_column(df)
    if not time_col:
        return {"error": f"Could not detect a datetime column in {source_file}"}

    value_col = str((request or {}).get("value_column") or "").strip()
    if value_col and value_col not in df.columns:
        value_col = ""
    if not value_col:
        value_col = _find_value_column(df, time_col=time_col)
    if not value_col:
        return {"error": f"Could not detect a numeric value column in {source_file}"}

    frame = df[[time_col, value_col]].copy()
    frame[time_col] = pd.to_datetime(frame[time_col], errors="coerce")
    frame[value_col] = pd.to_numeric(frame[value_col], errors="coerce")
    frame = frame.dropna(subset=[time_col, value_col])
    if frame.empty:
        return {"error": f"No valid time/value rows in {source_file}"}

    year = (request or {}).get("year")
    if year is not None:
        try:
            year = int(year)
            frame = frame[frame[time_col].dt.year == year]
        except Exception:
            year = None
    if frame.empty:
        return {"error": f"No rows found for requested year in {source_file}"}

    aggregation = str((request or {}).get("aggregation") or "monthly_sum").strip().lower()
    if aggregation in {"monthly_avg", "monthly_average", "monthly_mean"}:
        monthly = frame.set_index(time_col)[value_col].resample("MS").mean().reset_index()
    else:
        monthly = frame.set_index(time_col)[value_col].resample("MS").sum().reset_index()

    if monthly.empty:
        return {"error": f"No monthly values could be generated for {source_file}"}

    rows = [
        {
            "date": ts.strftime("%Y-%m-%d"),
            "demand": float(val),
        }
        for ts, val in zip(monthly[time_col], monthly[value_col])
    ]

    title = str((request or {}).get("title") or "").strip()
    if not title:
        title = f"Monthly demand from {Path(source_file).name}"

    return {
        "type": "timeseries",
        "title": title,
        "source_file": source_file,
        "rows": rows,
        "x_column": "date",
        "series_columns": ["demand"],
    }


def maybe_build_plot_payload(
    current_input_dir: Path,
    user_message: str,
    history: list[dict[str, str]] | None = None,
) -> dict | None:
    history_text = "\n".join((item.get("content") or "") for item in (history or [])[-8:])
    combined_text = f"{history_text}\n{user_message}".strip()

    if not _is_plot_request(combined_text):
        return None

    demand_rel_path = _detect_csv_file_from_text(current_input_dir, combined_text)
    if not demand_rel_path:
        return None

    year = _extract_year(combined_text)

    csv_path = get_file_path(current_input_dir, demand_rel_path)
    if not csv_path.exists():
        return {
            "error": f"Demand file not found in current_input: {demand_rel_path}",
        }

    df = pd.read_csv(csv_path)
    if df.empty:
        return {"error": f"File is empty: {demand_rel_path}"}

    time_col = _find_datetime_column(df)
    if not time_col:
        return {"error": f"Could not detect a datetime column in {demand_rel_path}"}

    value_col = _find_value_column(df, time_col=time_col)
    if not value_col:
        return {"error": f"Could not detect a numeric demand column in {demand_rel_path}"}

    frame = df[[time_col, value_col]].copy()
    frame[time_col] = pd.to_datetime(frame[time_col], errors="coerce")
    frame[value_col] = pd.to_numeric(frame[value_col], errors="coerce")
    frame = frame.dropna(subset=[time_col, value_col])
    if frame.empty:
        return {"error": f"No valid time/value rows in {demand_rel_path}"}

    if year is not None:
        frame = frame[frame[time_col].dt.year == year]
        if frame.empty:
            return {"error": f"No rows found for year {year} in {demand_rel_path}"}

    wants_monthly = "month" in combined_text.lower() or "monthly" in combined_text.lower()
    wants_average = "average" in combined_text.lower() or "avg" in combined_text.lower() or "mean" in combined_text.lower()

    if wants_monthly:
        agg = "mean" if wants_average else "sum"
        monthly = frame.set_index(time_col)[value_col].resample("MS").agg(agg).reset_index()
    else:
        monthly = frame.set_index(time_col)[value_col].resample("MS").sum().reset_index()
    if monthly.empty:
        return {"error": f"No monthly values could be generated for {demand_rel_path}"}

    rows = [
        {
            "date": ts.strftime("%Y-%m-%d"),
            "demand": float(val),
        }
        for ts, val in zip(monthly[time_col], monthly[value_col])
    ]

    year_label = f"{year}" if year is not None else "all years"
    title = f"Monthly demand from {Path(demand_rel_path).name} ({year_label})"
    return {
        "type": "timeseries",
        "title": title,
        "source_file": demand_rel_path,
        "rows": rows,
        "x_column": "date",
        "series_columns": ["demand"],
    }
