# Climate-Vegetation Dynamics in Tiaret Province, Algeria (2002–2025)

This repository contains the processing scripts and analytical workflows used to study the relationship between seasonal rainfall and Spring NDVI greenness in Tiaret Province, semi-arid Algeria.

## 📌 Research Overview
- **Study Area:** Tiaret Province, Algeria
- **Timeframe:** 2002–2025
- **Data Sources:** 
  - CHIRPS Precipitation (Daily aggregated to seasonal totals)
  - MODIS Terra MOD13Q1 Collection 6.1 (Spring NDVI Composites, 250m)
- **Key Findings:** Strong linear association ($R^2 = 0.73, p < 0.001$) between seasonal rainfall and spring vegetation greenness.

## 📂 Repository Structure
- `gee_extraction_script.js`: Google Earth Engine script for regional NDVI and precipitation extraction.
- `python_analysis_script.py`: Python script for statistical correlation, anomaly detection, and regression plot generation.

## 🛠️ Technical Stack
- **Google Earth Engine (GEE)**
- **Python** (Pandas, Matplotlib, Seaborn, Scipy)
- **QGIS** (Cartographic map rendering)
