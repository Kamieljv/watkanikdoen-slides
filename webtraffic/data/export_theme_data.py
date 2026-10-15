import json
import os

import pandas as pd

DATA_DIR = os.path.dirname(os.path.abspath(__file__))

INPUT_FILE = os.path.join(DATA_DIR, "stats.xlsx")
SEARCH_FILE = os.path.join(DATA_DIR, "search.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "theme_data.json")

SHEET_NAME = "Visitors"


def normalize_url(url):
    """Normalize action URLs so analytics and search data match."""

    if not isinstance(url, str):
        return None

    url = url.strip()

    for prefix in [
        "https://watkanikdoen.nl",
        "http://watkanikdoen.nl",
    ]:
        if url.startswith(prefix):
            url = url[len(prefix):]

    if url.startswith("/acties/"):
        url = "/actie/" + url[len("/acties/"):]

    return url.rstrip("/")


def load_themes():
    """Load the action URL -> theme names mapping."""

    with open(SEARCH_FILE, "r", encoding="utf-8") as f:
        data = json.load(f).get("acties", [])

    action_themes = {}

    for action in data:
        url = action.get("link")

        if not url:
            continue

        themes = [
            theme["name"]
            for theme in (action.get("themes") or [])
            if theme.get("name")
        ]

        action_themes[normalize_url(url)] = themes

    return action_themes


def load_visitors():
    """Load visitor data from the Excel workbook."""

    df = pd.read_excel(
        INPUT_FILE,
        sheet_name=SHEET_NAME,
    )

    if df.empty:
        return df

    df["URL"] = df["URL"].astype(str)

    # Only keep action URLs.
    df = df[
        df["URL"].str.startswith("/actie/")
    ].copy()

    return df


def aggregate_by_theme(visitors, action_themes):
    """Aggregate visitor counts by theme and date."""

    rows = []

    date_columns = [
        column
        for column in visitors.columns
        if column != "URL"
    ]

    n = len(visitors)
    for i, row in visitors.iterrows():
        if i % 10 == 0:
            print(f'row {i} out of {n}')
        
        analytics_url = normalize_url(row["URL"])

        themes = action_themes.get(analytics_url, [])

        if not themes:
            continue

        for theme in themes:
            for date in date_columns:
                count = pd.to_numeric(
                    row[date],
                    errors="coerce",
                )

                if pd.isna(count):
                    count = 0

                rows.append({
                    "theme": theme,
                    "date": pd.to_datetime(date),
                    "visitors": count,
                })

    if not rows:
        return pd.DataFrame(
            columns=["theme", "date", "visitors"]
        )

    result = pd.DataFrame(rows)

    result = (
        result.groupby(
            ["theme", "date"],
            as_index=False,
        )["visitors"]
        .sum()
    )

    return result


def export_theme_data(theme_data):
    """Export aggregated data as JSON for the interactive charts."""

    if theme_data.empty:
        print("No theme data found. Nothing to export.")
        return

    export_data = theme_data.copy()

    export_data["date"] = pd.to_datetime(
        export_data["date"]
        .dt.to_period("W")
        .dt.to_timestamp()
    )

    export_data = (
        export_data
        .groupby(["theme", "date"], as_index=False)["visitors"]
        .sum()
    )

    export_data.to_json(
        OUTPUT_FILE,
        orient="records",
        force_ascii=False,
    )

    print(f"Exported {len(export_data)} records.")
    print(f"Output: {OUTPUT_FILE}")
    print(f"Themes: {export_data['theme'].nunique()}")


def main():
    print("Loading themes...")
    action_themes = load_themes()

    print(f"Found {len(action_themes)} actions.")

    print("Loading visitor data...")
    visitors = load_visitors()

    if visitors.empty:
        print("No action visitor data found.")
        return

    print("Aggregating visitor counts...")
    theme_data = aggregate_by_theme(
        visitors,
        action_themes,
    )

    if theme_data.empty:
        print("No matching themes found.")
        return

    export_theme_data(theme_data)


if __name__ == "__main__":
    main()