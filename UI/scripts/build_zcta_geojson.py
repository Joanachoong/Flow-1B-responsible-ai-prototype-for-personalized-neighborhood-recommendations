"""One-time build: Census ZCTA shapefile -> simplified Miami-Dade GeoJSON for the map.

Not part of the deployed app. Run it only when the boundaries need regenerating.

    pip install pyshp shapely
    # download + unzip https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_us_zcta520_500k.zip
    python UI/scripts/build_zcta_geojson.py \
        --shp /path/to/cb_2020_us_zcta520_500k.shp \
        --zips data/raw/miami_dade_zctas.txt \
        --names data/cleaned/new/area-name-cleaned.csv \
        --out UI/public/geo/miami-zctas.geojson

Each feature carries: zip (5-char string), name (primary area name), centroid [lat, lng].
"""

import argparse
import csv
import json
from pathlib import Path

import shapefile  # pyshp
from shapely.geometry import mapping, shape

SIMPLIFY_TOLERANCE = 0.0006  # degrees (~60 m) keeps the file small but shapes recognisable
PRECISION = 5


def round_coords(obj):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(v, PRECISION) for v in obj]
        return [round_coords(v) for v in obj]
    return obj


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--shp", required=True)
    parser.add_argument("--zips", required=True)
    parser.add_argument("--names", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    wanted = {line.strip() for line in Path(args.zips).read_text().splitlines() if line.strip()}
    with open(args.names, encoding="utf-8-sig", newline="") as source:
        names = {row["zip_code"].zfill(5): row["primary_area_name"] for row in csv.DictReader(source)}

    reader = shapefile.Reader(args.shp)
    field_names = [f[0] for f in reader.fields[1:]]
    zip_field = "ZCTA5CE20" if "ZCTA5CE20" in field_names else "ZCTA5CE10"

    features = []
    for record in reader.iterShapeRecords():
        zip_code = str(record.record[zip_field]).zfill(5)
        if zip_code not in wanted:
            continue
        geom = shape(record.shape.__geo_interface__)
        simplified = geom.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
        point = geom.representative_point()
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "zip": zip_code,
                    "name": names.get(zip_code, zip_code),
                    "centroid": [round(point.y, PRECISION), round(point.x, PRECISION)],
                },
                "geometry": {
                    "type": mapping(simplified)["type"],
                    "coordinates": round_coords(mapping(simplified)["coordinates"]),
                },
            }
        )

    features.sort(key=lambda f: f["properties"]["zip"])
    missing = sorted(wanted - {f["properties"]["zip"] for f in features})
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")))
    print(f"wrote {len(features)} features to {out} ({out.stat().st_size // 1024} KB)")
    if missing:
        print(f"no boundary in shapefile for (PO-box / point ZIPs): {', '.join(missing)}")


if __name__ == "__main__":
    main()
