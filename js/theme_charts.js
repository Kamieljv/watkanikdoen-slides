(() => {
  const timelineElement = document.getElementById("theme-timeline");
  const pieElement = document.getElementById("theme-pie");
  const errorElement = document.getElementById("theme-error");

  const numberFormat = new Intl.NumberFormat("nl-NL", {
    maximumFractionDigits: 0,
  });

  const themeColors = {
    Klimaat: "#61BB0C",
    "Anti-racisme": "#F30060",
    Dierenrechten: "#709e16",
    Vrouwenrechten: "#ff00dd",
    Migratie: "#f57900",
    "LGBTQIA+ rechten": "#9141ac",
    Leefomgeving: "#046f00",
    "Bezetting en kolonialisme": "#5e5c64",
    "Zorg en welzijn": "#62a0ea",
    Democratie: "#6312de",
    "Anti-fascisme": "#f90606",
    Mensenrechten: "#f5c211",
    Inclusiviteit: "#dc8add",
    Onderwijs: "#ff7800",
    "Economie en ongelijkheid": "#ff0000",
    "Anti-validisme": "#813d9c",
    Militarisme: "#001eff",
  };

  const fallbackColor = "#F30060";

  function colorOf(theme) {
    return themeColors[theme] || fallbackColor;
  }

  // Readable label colour (dark or white) on a slice colour.
  function labelColorOn(hex) {
    const n = parseInt(hex.slice(1, 7), 16);
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255];
    return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1f1f1f" : "#ffffff";
  }

  // Pie order: largest to smallest.
  function pieOrder() {
    return [...themes].sort((a, b) => themeTotals[b] - themeTotals[a]);
  }

  let themes = [];
  let dates = [];
  let themeValues = {};
  let themeTotals = {};
  let timelineTraces = [];
  let chartsRendered = false;
  let currentTheme = null;

  function showError(message) {
    errorElement.textContent = message;
    errorElement.hidden = false;
  }

  function getCurrentTheme() {
    return currentTheme || themes[0] || null;
  }

  function getPieColors(selectedTheme) {
    // Every slice keeps its theme colour; others are dimmed.
    return pieOrder().map((theme) =>
      theme === selectedTheme ? colorOf(theme) : colorOf(theme) + "99",
    );
  }

  function getPieLabelColors() {
    return pieOrder().map((theme) => labelColorOn(colorOf(theme)));
  }

  function getPiePull(selectedTheme) {
    return pieOrder().map((theme) => (theme === selectedTheme ? 0.08 : 0));
  }

  function updateSelection(selectedTheme = currentTheme) {
    currentTheme = selectedTheme;

    const traceIndices = themes.map((_, index) => index);

    // Highlight the selected theme's line in its own colour.
    const lineColors = themes.map((theme) =>
      theme === currentTheme ? colorOf(theme) : colorOf(theme) + "40",
    );

    const lineWidths = themes.map((theme) =>
      theme === currentTheme ? 4 : 1.4,
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
      traceIndices,
    );

    // Highlight the selected pie slice.
    Plotly.restyle(pieElement, {
      "marker.colors": [getPieColors(currentTheme)],
      pull: [getPiePull(currentTheme)],
    });
  }

  async function renderCharts() {
    if (chartsRendered || !themes.length) {
      return;
    }

    try {
      const selectedTheme = getCurrentTheme();

      timelineTraces = themes.map((theme) => ({
        x: dates,
        y: dates.map((date) => {
          const firstDate = themeValues[theme].firstDate;

          // Keep the line invisible before the theme's
          // first recorded visitors.
          if (date < firstDate) {
            return null;
          }

          return themeValues[theme].values[date] ?? 0;
        }),
        type: "scatter",
        mode: "lines",
        name: theme,
        connectgaps: false,
        line: {
          color:
            theme === selectedTheme ? colorOf(theme) : colorOf(theme) + "40",
          width: theme === selectedTheme ? 4 : 1.4,
        },
        hovertemplate:
          "<b>" +
          theme +
          "</b><br>" +
          "Datum: %{x|%d-%m-%Y}<br>" +
          "Bezoekers: %{y:,.0f}" +
          "<extra></extra>",
      }));

      const timelineLayout = {
        autosize: true,
        margin: { l: 75, r: 50, t: 35, b: 105 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: {
          family: "Ubuntu, sans-serif",
          color: "#1f1f1f",
          size: 12,
        },
        showlegend: false,
        hovermode: "closest",
        xaxis: {
          title: { text: "Datum", standoff: 12 },
          type: "date",
          tickformat: "%b %Y",
          gridcolor: "rgba(0,0,0,0.07)",
          linecolor: "rgba(0,0,0,0.3)",
          tickfont: { color: "rgba(0,0,0,0.75)" },
          zeroline: false,
        },
        yaxis: {
          title: { text: "Bezoekers" },
          rangemode: "tozero",
          gridcolor: "rgba(0,0,0,0.08)",
          tickfont: { color: "rgba(0,0,0,0.75)" },
          zeroline: false,
        },
      };

      const pieColors = getPieColors(selectedTheme);

      const orderedThemes = pieOrder();

      const pieTrace = {
        type: "pie",
        labels: orderedThemes,
        values: orderedThemes.map((theme) => themeTotals[theme]),
        pull: getPiePull(selectedTheme),
        sort: false,
        direction: "clockwise",
        hole: 0.35,
        textinfo: "percent",
        textposition: "inside",
        textfont: {
          color: getPieLabelColors(),
          size: 12,
        },
        marker: {
          colors: pieColors,
          line: {
            color: "#FFFFFF",
            width: 2,
          },
        },
        hovertemplate:
          "<b>%{label}</b><br>" +
          "Bezoeken: %{value:,.0f}<br>" +
          "Aandeel: %{percent}" +
          "<extra></extra>",
      };

      const pieLayout = {
        autosize: true,
        margin: { l: 5, r: 5, t: 10, b: 10 },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",
        font: {
          family: "Ubuntu, sans-serif",
          color: "#1f1f1f",
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
        Plotly.newPlot(timelineElement, timelineTraces, timelineLayout, config),
        Plotly.newPlot(pieElement, [pieTrace], pieLayout, config),
      ]);

      chartsRendered = true;

      // Clicking a pie slice selects its theme.
      pieElement.on("plotly_click", (event) => {
        if (!event.points || !event.points.length) {
          return;
        }

        const clickedTheme = event.points[0].label;

        updateSelection(clickedTheme);
      });

      // Update the selected theme whenever the dropdown changes.
      updateSelection();
    } catch (error) {
      console.error("Could not render the charts:", error);
      showError("De grafieken konden niet worden weergegeven.");
    }
  }

  async function loadData() {
    try {
      const response = await fetch("data/theme_data.daily.json");

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const rows = await response.json();

      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("Het databestand is leeg.");
      }

      dates = [...new Set(rows.map((row) => row.date))].sort();

      themes = [...new Set(rows.map((row) => row.theme))].sort((a, b) =>
        a.localeCompare(b, "nl"),
      );

      if (!themes.length || !dates.length) {
        throw new Error("Geen thema's of datums gevonden.");
      }

      themeValues = {};
      themeTotals = {};

      for (const theme of themes) {
        themeValues[theme] = {
          values: {},
          firstDate: null,
        };

        themeTotals[theme] = 0;
      }

      for (const row of rows) {
        const theme = row.theme;
        const date = row.date;
        const visitors = Number(row.visitors) || 0;

        themeValues[theme].values[date] = visitors;
        themeTotals[theme] += visitors;

        if (
          visitors > 0 &&
          (themeValues[theme].firstDate === null ||
            date < themeValues[theme].firstDate)
        ) {
          themeValues[theme].firstDate = date;
        }
      }

      // Exclude themes that never recorded visitors.
      themes = themes.filter((theme) => themeValues[theme].firstDate !== null);

      if (!themes.length) {
        throw new Error("Geen bezoekers voor de gevonden thema's.");
      }

      if (!currentTheme || !themes.includes(currentTheme)) {
        currentTheme = themes[0];
      }

      // If this slide is already active, render immediately.
      if (Reveal.getCurrentSlide()?.id === "theme-slide") {
        await renderCharts();
      }
    } catch (error) {
      console.error("Could not load theme data:", error);

      showError(
        "De data kon niet worden geladen. " +
          "Controleer of theme_data.json bestaat en " +
          "de presentatie via Live Server wordt geopend.",
      );
    }
  }

  // Reveal.js may initially hide slides. Render when this
  // slide becomes visible so Plotly can calculate its size.
  // Load data when the script starts.
  loadData();

  // Render charts when the presentation becomes ready.
  Reveal.on("ready", (event) => {
    if (event.currentSlide?.id === "theme-slide") {
      renderCharts();
    }
  });

  // Render charts when navigating to the slide.
  Reveal.on("slidechanged", (event) => {
    if (event.currentSlide?.id === "theme-slide") {
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
  window.loadThemeData = loadData;
  window.renderThemeCharts = renderCharts;
  window.updateThemeSelection = updateSelection;
})();
