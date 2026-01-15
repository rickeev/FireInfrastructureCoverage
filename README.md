# Sacramento County Fire Infrastructure Coverage Analysis

An interactive web application for analyzing fire hydrant coverage and fire station accessibility across Sacramento County, California. This tool helps identify areas with adequate fire protection infrastructure and highlights potential coverage gaps.

![Fire Infrastructure Analysis](https://img.shields.io/badge/React-18.x-blue) ![Leaflet](https://img.shields.io/badge/Leaflet-Maps-green) ![Python](https://img.shields.io/badge/Python-3.x-yellow)

## Live Demo

[View Live Application](https://rickeev.github.io/FireInfrastructureCoverage/)

## Features

- **Interactive Map Visualization**: Explore fire hydrants, stations, and addresses across Sacramento County
- **ZIP Code Analysis**: Click any ZIP code to view detailed coverage statistics
- **Coverage Metrics**: Calculate hydrant-to-station ratios, average distances, and coverage ratings
- **Layer Controls**: Toggle visibility of hydrants, stations, addresses, ZIP codes, and county boundary
- **Real-time Statistics**: View live counts and analysis as you explore the map
- **Responsive Design**: Works on desktop and mobile devices

---

## How to Reproduce This Project

This section walks you through all the steps to recreate this project from scratch.

### Prerequisites

- Python 3.8+
- Node.js 18+
- npm or yarn
- A Mapillary API token (free at [mapillary.com](https://www.mapillary.com/))

### Step 1: Download Base Data

Download the following datasets from Sacramento County GIS Open Data:

1. **County Boundary**
   - Source: [Sacramento County GIS - County Boundary](https://data-sacramentocounty.opendata.arcgis.com/datasets/sacramentocounty::county-boundary/explore)
   - Download as GeoJSON
   - Save to: `sacramento_county_boundary/`

2. **Fire Stations**
   - Source: [Sacramento County GIS - Fire Stations](https://data-sacramentocounty.opendata.arcgis.com/datasets/sacramentocounty::fire-stations/explore)
   - Download as GeoJSON
   - Save to: `sacramento_fire_stations/`

3. **Address Points**
   - Source: [Sacramento County GIS - Address Points](https://data-sacramentocounty.opendata.arcgis.com/)
   - Download as CSV (this will be ~500,000+ records)
   - Save to: `addresses/`

4. **ZIP Code Boundaries**
   - Source: Sacramento County GIS or Census Bureau
   - Download as GeoJSON
   - Save to: `zip_codes/`

### Step 2: Extract County Boundary Coordinates

Convert the county boundary GeoJSON to a simple CSV format for the Python scripts:

```python
import json

with open('sacramento_county_boundary/CountyBoundary.geojson', 'r') as f:
    data = json.load(f)

coords = data['features'][0]['geometry']['coordinates'][0]

with open('sacramento_county_boundary.csv', 'w') as f:
    for lon, lat in coords:
        f.write(f"{lat},{lon}\n")
```

### Step 3: Detect Fire Hydrants Using Mapillary

The `scripts/fire_hydrant_detector.py` script queries Mapillary's computer vision API to detect fire hydrants from street-level imagery.

```bash
cd scripts

# Install dependencies
pip install requests

# Run the hydrant detector (takes 15-30 minutes)
python fire_hydrant_detector.py --boundary ../sacramento_county_boundary.csv
```

**What this script does:**
1. Loads the Sacramento County boundary polygon
2. Divides the county into a grid of small cells
3. Queries Mapillary API for detected fire hydrants in each cell
4. Filters results to only include hydrants inside the county boundary
5. Exports results to GeoJSON and CSV formats

**Output:** `hydrant_export/sacramento_hydrants.geojson`

### Step 4: Clean Address Data

The raw address data may contain points outside Sacramento County. Use the cleaning script to filter:

```bash
python clean_addresses.py \
    --input ../addresses/raw_addresses.csv \
    --boundary ../sacramento_county_boundary.csv \
    --output ../addresses/addresses_cleaned.csv
```

**What this script does:**
1. Loads the county boundary polygon
2. Reads each address record
3. Uses ray-casting algorithm to check if coordinates are inside the county
4. Outputs only addresses within Sacramento County

**Output:** `addresses/addresses_cleaned.csv` (~190MB, ~500,000 addresses)

### Step 5: Run Coverage Analysis

Analyze the spatial relationship between fire stations, hydrants, and addresses:

```bash
python fire_coverage_analysis.py \
    --stations ../sacramento_fire_stations/FireStations.geojson \
    --hydrants ../hydrant_export/sacramento_hydrants.geojson \
    --addresses ../addresses/addresses_cleaned.csv
```

**What this script does:**
1. Calculates distance from each fire station to nearest hydrants
2. Counts hydrants within 500ft, 1000ft, and quarter-mile of each station
3. Assigns coverage ratings (Excellent, Good, Needs Attention)
4. Aggregates statistics by agency and jurisdiction
5. Identifies underserved addresses (>500ft from nearest hydrant)

**Outputs:**
- `fire_coverage_analysis/coverage_analysis.geojson` - Station-to-hydrant connection lines
- `fire_coverage_analysis/station_coverage.csv` - Per-station metrics
- `fire_coverage_analysis/agency_stats.csv` - Per-agency aggregations

### Step 6: Set Up the React Application

```bash
cd react-app

# Install dependencies
npm install

# Copy data files to public folder
cp ../sacramento_fire_hydrants/*.geojson public/data/
cp ../sacramento_fire_stations/*.geojson public/data/
cp ../fire_coverage_analysis/*.csv public/
cp ../fire_coverage_analysis/*.geojson public/
cp ../sacramento_county_boundary/*.geojson public/
cp ../zip_codes/*.geojson public/
```

### Step 7: Run the Development Server

```bash
npm run dev
```

Open http://localhost:5173 to view the application.

### Step 8: Build for Production

```bash
npm run build
```

The built files will be in `react-app/dist/`.

### Step 9: Deploy to GitHub Pages

1. Create a GitHub repository
2. Push your code
3. Create a GitHub Actions workflow (`.github/workflows/deploy.yml`):

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install and Build
        run: |
          cd react-app
          npm ci
          npm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./react-app/dist
```

4. Enable GitHub Pages in repository settings (use `gh-pages` branch)

---

## Handling the Large Address File

The `addresses_cleaned.csv` file is ~190MB and exceeds GitHub's 100MB file limit. Here's how this project handles it:

1. **Not included in repository**: The file is added to `.gitignore`
2. **Hosted via GitHub Releases**: Upload the file as a release asset
3. **Dynamic loading**: The app detects production vs development environment and loads from the appropriate source

To set this up for your own deployment:

1. Create a GitHub Release (e.g., `v1.0.0`)
2. Upload `addresses_cleaned.csv` as a release asset
3. Update `useMapData.js` with your release URL:

```javascript
const addressUrl = isProduction
  ? 'https://github.com/YOUR_USERNAME/YOUR_REPO/releases/download/v1.0.0/addresses_cleaned.csv'
  : '/data/addresses_cleaned.csv'
```

---

## Data Sources

| Dataset | Source | Format | Size |
|---------|--------|--------|------|
| County Boundary | [Sacramento County GIS](https://data-sacramentocounty.opendata.arcgis.com/) | GeoJSON | ~50KB |
| Fire Stations | [Sacramento County GIS](https://data-sacramentocounty.opendata.arcgis.com/) | GeoJSON | ~100KB |
| Fire Hydrants | [Mapillary API](https://www.mapillary.com/) (computer vision detection) | GeoJSON | ~2MB |
| Address Points | [Sacramento County GIS](https://data-sacramentocounty.opendata.arcgis.com/) | CSV | ~190MB |
| ZIP Codes | Sacramento County GIS | GeoJSON | ~500KB |

---

## Technical Stack

- **Frontend**: React 18 with Vite
- **Mapping**: Leaflet.js with marker clustering
- **Data Processing**: Python 3 scripts
- **Styling**: Custom CSS with dark theme
- **Deployment**: GitHub Pages with GitHub Actions

---

## Coverage Analysis Metrics

| Metric | Description |
|--------|-------------|
| **Hydrant Count** | Total fire hydrants in area |
| **Station Count** | Number of fire stations |
| **H/S Ratio** | Hydrants per fire station |
| **Addresses Covered** | Properties within 500ft of a hydrant |
| **Coverage Rating** | Excellent (<200ft) / Good (<500ft) / Needs Attention (>500ft) |

---

## Project Structure

```
FireInfraCoverage/
├── addresses/                      # Address data (cleaned CSV)
├── fire_coverage_analysis/         # Analysis outputs
├── sacramento_county_boundary/     # County boundary GeoJSON
├── sacramento_fire_hydrants/       # Hydrant data
├── sacramento_fire_stations/       # Station data
├── scripts/
│   ├── fire_hydrant_detector.py   # Mapillary API hydrant detection
│   ├── clean_addresses.py         # Address data filtering
│   └── fire_coverage_analysis.py  # Coverage metrics calculation
├── zip_codes/                      # ZIP code boundaries
└── react-app/
    ├── public/                     # Static data files
    ├── src/
    │   ├── components/            # React components
    │   ├── hooks/                 # Data loading hooks
    │   └── workers/               # Web Workers
    └── vite.config.js
```

---

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Sacramento County GIS for open data access
- Mapillary for street-level imagery and object detection API
- OpenStreetMap contributors for base map data
