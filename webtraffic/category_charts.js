(() => {
    const timelineElement = document.getElementById("category-timeline");
    const pieElement = document.getElementById("category-pie");
    const errorElement = document.getElementById("category-error");

    const numberFormat = new Intl.NumberFormat("nl-NL", {
        maximumFractionDigits: 0,
    });

    let categories = [];
    let dates = [];
    let categoryValues = {};
    let categoryTotals = {};
    let timelineTraces = [];
    let chartsRendered = false;
    let currentCategory = null;

    function showError(message) {
        errorElement.textContent = message;
        errorElement.hidden = false;
    }

    function getCurrentCategory() {
        return currentCategory || categories[0] || null;
    }

    function getPieColors(selectedCategory) {
        return categories.map((category) =>
            category === selectedCategory ? "#FDD10D" : "#ffffffb0"
        );
    }

    function updateSelection(selectedCategory = currentCategory) {
        currentCategory = selectedCategory;

        const traceIndices = categories.map((_, index) => index);

        // Highlight the selected category's timeline.
        const lineColors = categories.map((category) =>
            category === currentCategory
                ? "#FDD10D"
                : "rgba(255,255,255,0.22)"
        );

        const lineWidths = categories.map((category) =>
            category === currentCategory ? 3.5 : 1.2
        );

        if (!chartsRendered) {
            return;
        }

        Plotly.restyle(
            timelineElement,
            {
                "line.color": lineColors,
                "line.width": lineWidths,
            },
            traceIndices
        );

        // Highlight the selected pie slice.
        Plotly.restyle(pieElement, {
            "marker.colors": [getPieColors(currentCategory)],
            "textfont.color": [
                categories.map((category) =>
                    category === currentCategory ? "#4B1740" : "#F30060"
                ),
            ],
        });
    }

    async function renderCharts() {
        if (chartsRendered || !categories.length) {
            return;
        }

        try {
            const selectedCategory = getCurrentCategory();

            timelineTraces = categories.map((category) => ({
                x: dates,
                y: dates.map((date) => {
                    const firstDate = categoryValues[category].firstDate;

                    // Hide the line before the category's first interaction.
                    if (date < firstDate) {
                        return null;
                    }

                    return categoryValues[category].values[date] ?? 0;
                }),
                type: "scatter",
                mode: "lines",
                name: category,
                connectgaps: false,
                line: {
                    color:
                        category === selectedCategory
                            ? "#FDD10D"
                            : "rgba(255,255,255,0.22)",
                    width: category === selectedCategory ? 3.5 : 1.2,
                },
                hovertemplate:
                    "<b>" + category + "</b><br>" +
                    "Datum: %{x|%d-%m-%Y}<br>" +
                    "Interacties: %{y:,.0f}" +
                    "<extra></extra>",
            }));

            const timelineLayout = {
                autosize: true,
                margin: { l: 75, r: 50, t: 35, b: 105 },
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
                font: {
                    family: "Ubuntu, sans-serif",
                    color: "#FFFFFF",
                    size: 12,
                },
                showlegend: false,
                hovermode: "closest",
                xaxis: {
                    title: {
                        text: "Datum",
                        standoff: 12,
                    },
                    type: "date",
                    tickformat: "%b %Y",
                    gridcolor: "rgba(255,255,255,0.12)",
                    linecolor: "rgba(255,255,255,0.3)",
                    tickfont: {
                        color: "rgba(255,255,255,0.8)",
                    },
                    zeroline: false,
                },
                yaxis: {
                    title: {
                        text: "Interacties",
                    },
                    rangemode: "tozero",
                    gridcolor: "rgba(255,255,255,0.15)",
                    tickfont: {
                        color: "rgba(255,255,255,0.8)",
                    },
                    zeroline: false,
                },
            };

            const pieTrace = {
                type: "pie",
                labels: categories,
                values: categories.map(
                    (category) => categoryTotals[category]
                ),
                sort: false,
                direction: "clockwise",
                hole: 0.35,
                textinfo: "percent",
                textposition: "inside",
                textfont: {
                    color: categories.map((category) =>
                        category === selectedCategory ? "#4B1740" : "#F30060"
                    ),
                    size: 12,
                },
                marker: {
                    colors: getPieColors(selectedCategory),
                    line: {
                        color: "#F30060",
                        width: 2,
                    },
                },
                hovertemplate:
                    "<b>%{label}</b><br>" +
                    "Interacties: %{value:,.0f}<br>" +
                    "Aandeel: %{percent}" +
                    "<extra></extra>",
            };

            const pieLayout = {
                autosize: true,
                height: 340,
                margin: { l: 5, r: 5, t: 10, b: 10 },
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
                font: {
                    family: "Ubuntu, sans-serif",
                    color: "#FFFFFF",
                    size: 12,
                },
                showlegend: false,
            };

            const config = {
                responsive: true,
                displaylogo: false,
                scrollZoom: true,
                modeBarButtonsToRemove: ["lasso2d", "select2d"],
            };

            await Promise.all([
                Plotly.newPlot(
                    timelineElement,
                    timelineTraces,
                    timelineLayout,
                    config
                ),
                Plotly.newPlot(
                    pieElement,
                    [pieTrace],
                    pieLayout,
                    config
                ),
            ]);

            chartsRendered = true;

            // Clicking a pie slice selects its category.
            pieElement.on("plotly_click", (event) => {
                if (!event.points || !event.points.length) {
                    return;
                }

                const clickedCategory = event.points[0].label;

                updateSelection(clickedCategory);
            });

            updateSelection();
        } catch (error) {
            console.error("Could not render category charts:", error);
            showError("De categoriegrafieken konden niet worden weergegeven.");
        }
    }

    async function loadData() {
        try {
            const response = await fetch(
                "webtraffic/data/category_data.daily.json"
            );

            if (!response.ok) {
                throw new Error("HTTP " + response.status);
            }

            const rows = await response.json();

            if (!Array.isArray(rows) || rows.length === 0) {
                throw new Error("Het databestand is leeg.");
            }

            // Parse dates consistently and sort chronologically.
            dates = [
            ...new Set(
                rows.map((row) => {
                const parsedDate = new Date(row.date);

                if (Number.isNaN(parsedDate.getTime())) {
                    throw new Error("Ongeldige datum: " + row.date);
                }

                return parsedDate.toISOString().slice(0, 10);
                })
            ),
            ].sort();

            categories = [
                ...new Set(rows.map((row) => row.category).filter(Boolean)),
            ].sort((a, b) => a.localeCompare(b, "nl"));

            if (!categories.length || !dates.length) {
                throw new Error("Geen categorieën of datums gevonden.");
            }

            categoryValues = {};
            categoryTotals = {};

            for (const category of categories) {
                categoryValues[category] = {
                    values: {},
                    firstDate: null,
                };

                categoryTotals[category] = 0;
            }

            for (const row of rows) {
                const category = row.category;

                if (!category || !categoryValues[category]) {
                    continue;
                }

                const date = new Date(row.date)
                    .toISOString()
                    .slice(0, 10);

                const visitors = Number(row.visitors) || 0;

                categoryValues[category].values[date] =
                    (categoryValues[category].values[date] || 0) + visitors;

                categoryTotals[category] += visitors;

                if (
                    visitors > 0 &&
                    (
                    categoryValues[category].firstDate === null ||
                    date < categoryValues[category].firstDate
                    )
                ) {
                    categoryValues[category].firstDate = date;
                }
            }

            // Keep categories with at least one positive count.
            categories = categories.filter(
            (category) =>
                categoryValues[category].firstDate !== null
            );

            if (!categories.length) {
            console.error(
                "Category totals:",
                categoryTotals
            );

            console.error(
                "Category values:",
                categoryValues
            );

            throw new Error(
                "Geen interacties voor de gevonden categorieën."
            );
            }

            if (!currentCategory || !categories.includes(currentCategory)) {
            currentCategory = categories[0];
            }

            console.log("Loaded categories:", categories.length);
            console.log("Category totals:", categoryTotals);

            if (Reveal.getCurrentSlide()?.id === "category-slide") {
            await renderCharts();
            }

        } catch (error) {
            console.error("Could not load category data:", error);

            showError(
            "De data kon niet worden geladen. " +
            "Controleer of category_data.daily.json bestaat " +
            "en de presentatie via Live Server wordt geopend."
            );
        }
    }

    // Load the category data.
    loadData();

    // Render charts when the presentation becomes ready.
    Reveal.on("ready", (event) => {
        if (event.currentSlide?.id === "category-slide") {
            renderCharts();
        }
    });

    // Render charts when navigating to the category slide.
    Reveal.on("slidechanged", (event) => {
        if (event.currentSlide?.id === "category-slide") {
            renderCharts();
        }
    });

    // Keep the charts responsive when the browser resizes.
    window.addEventListener("resize", () => {
        if (chartsRendered) {
            Plotly.Plots.resize(timelineElement);
            Plotly.Plots.resize(pieElement);
        }
    });

    // Expose functions for debugging in the browser console.
    window.loadCategoryData = loadData;
    window.renderCategoryCharts = renderCharts;
    window.updateCategorySelection = updateSelection;
})();