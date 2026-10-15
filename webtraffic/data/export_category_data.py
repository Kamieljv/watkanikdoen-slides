import json
import os

import pandas as pd

DATA_DIR = os.path.dirname(os.path.abspath(__file__))

INPUT_FILE = os.path.join(DATA_DIR, "stats.xlsx")
SEARCH_FILE = os.path.join(DATA_DIR, "search.json")
OUTPUT_FILE = os.path.join(DATA_DIR, "category_data.json")

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


def load_categories():
    """Load the action URL -> category names mapping."""

    with open(SEARCH_FILE, "r", encoding="utf-8") as f:
        data = json.load(f).get("acties", [])

    action_categories = {}

    for action in data:
        url = action.get("link")

        if not url:
            continue

        categories = [
            category["name"]
            for category in (action.get("categories") or [])
            if category.get("name")
        ]

        action_categories[normalize_url(url)] = categories

    return action_categories


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


def aggregate_by_category(visitors, action_categories):
    """Aggregate visitor counts by category and date."""

    rows = []

    date_columns = [
        column
        for column in visitors.columns
        if column != "URL"
    ]

    n = len(visitors)

    for i, (_, row) in enumerate(visitors.iterrows()):
        if i % 10 == 0:
            print(f"Row {i} out of {n}")

        analytics_url = normalize_url(row["URL"])

        categories = action_categories.get(
            analytics_url,
            [],
        )

        if not categories:
            continue

        for category in categories:
            for date in date_columns:
                count = pd.to_numeric(
                    row[date],
                    errors="coerce",
                )

                if pd.isna(count):
                    count = 0

                rows.append({
                    "category": category,
                    "date": pd.to_datetime(date),
                    "visitors": count,
                })

    if not rows:
        return pd.DataFrame(
            columns=["category", "date", "visitors"]
        )

    result = pd.DataFrame(rows)

    # Sum visitor counts across actions belonging to each category.
    result = (
        result.groupby(
            ["category", "date"],
            as_index=False,
        )["visitors"]
        .sum()
    )

    return result


def export_category_data(category_data):
    """Export weekly aggregated data as JSON for interactive charts."""

    if category_data.empty:
        print("No category data found. Nothing to export.")
        return

    export_data = category_data.copy()

    # Aggregate daily counts into weeks to keep charts responsive.
    export_data["date"] = (
        pd.to_datetime(export_data["date"])
        .dt.to_period("W")
        .dt.start_time
    )

    export_data = (
        export_data
        .groupby(
            ["category", "date"],
            as_index=False,
        )["visitors"]
        .sum()
    )

    export_data.to_json(
        OUTPUT_FILE,
        orient="records",
        force_ascii=False,
        date_format="iso",
    )

    print(f"Exported {len(export_data)} records.")
    print(f"Output: {OUTPUT_FILE}")
    print(f"Categories: {export_data['category'].nunique()}")


def main():
    print("Loading categories...")
    action_categories = load_categories()

    print(f"Found categories for {len(action_categories)} actions.")

    print("Loading visitor data...")
    visitors = load_visitors()

    if visitors.empty:
        print("No action visitor data found.")
        return

    print("Aggregating visitor counts by category...")

    category_data = aggregate_by_category(
        visitors,
        action_categories,
    )

    if category_data.empty:
        print("No matching categories found.")
        return

    export_category_data(category_data)


if __name__ == "__main__":
    main()