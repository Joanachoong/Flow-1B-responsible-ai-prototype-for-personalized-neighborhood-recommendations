# A desctiprion of data that we are expanding 


Resource we are using 

1. Miani
https://gis-mdc.opendata.arcgis.com/datasets/MDC::property-point-view/explore?location=25.727426%2C-80.236112%2C10
Why?


## Curent limitation

1. Your rental values are not always comparable to actual apartment prices
The current rent data is an aggregate ZIP-level estimate. It does not distinguish:

Studio, one-bedroom, or two-bedroom units
Furnished versus unfurnished
Apartment versus single-family rental
Parking or utility fees
Deposits and application fees
Current availability


## Expansion order ( this are most important )

### Phase 1: Improve the existing features first DONE
Before adding many new domains, replace weak proxies with measurable variables.
https://mdc.maps.arcgis.com/home/item.html?id=ba2e2044d5894e44a8c5fa69b04377d5#overview 

Transit
Field	Information
Dataset	Miami-Dade Transit Static GTFS
Publisher	Miami-Dade County
Official documentation	Miami-Dade General Transit Feed Specification
agency_id,agency_name,agency_url,agency_timezone,agency_lang,agency_phone,agency_fare_url
DTPW305,Miami-Dade Transit,http://www.miamidade.gov/transit,America/New_York,en,,

Do not use only one opaque transit score. Store both raw measurements and a normalized score:

transit_stop_count
transit_stop_density
transit_routes_count
distance_to_nearest_transit_miles
distance_to_nearest_rail_station_miles
transit_score_0_1

For example:

transit_score_0_1 = normalized combination of:
- stop density
- rail proximity
- route count
- service frequency

transit_score_0_1 = normalized combination of:
- stop density
- rail proximity
- route count
- service frequency


### Phase 2: Add rent structure and affordability DONE
Add a separate table rather than placing every rent measurement into area_features_cleaned.csv.

Source 
	1. Zillow ZORI	
  - Source : based on suggested rsource from RESOURCED.md 
  - ( already avalibale ZORI — Zillow Observed Rent Index as /Users/joanachoong/Flow-1B-responsible-ai-prototype-for-personalized-neighborhood-recommendations/data/raw/Zip_zori_uc_sfrcondomfr_sm_month.csv)
  - cleaned data is named as ' Miami_rental_values.csv '
  2. HUD SAFMR	
  - Source : https://www.huduser.gov/datasets/fmr/fmr2027/summary?reporttype=county&year=2027&counties=1208699999&states=12&q=Miami-Dade%20County%2C%20FL&mode=safmr 
  - Name of and path data source : /data/raw/HUD-SAFMR.csv
  3. ACS B25031	


Suggested file:
rental_market.csv

zip
observation_month
unit_type
bedrooms
property_type
median_rent_usd
rent_p25_usd
rent_p75_usd
listing_count
source
source_date

This enables better output:

Typical studio rent
Typical one-bedroom rent
Estimated rent difference from budget
Rent percentile
Number of available listings, if real listing data is eventually added
For the initial project, I would implement:


rent_difference_usd = median_rent_usd - budget_max
budget_fit = budget_max / median_rent_usd

### Phase 3: Add rent trends (`rent-trends.csv`) DONE 
The Zillow extraction already contains monthly columns in the notebook workflow. Instead of dropping all historical columns, create derived trend features:

Source 
	1. Zillow ZORI	
  - Source : based on suggested rsource from RESOURCED.md 
  - Historical source: `data/raw/Zip_zori_uc_sfrcondomfr_sm_month.csv`
  - Long-format history: `data/cleaned/zori_history.csv`
  - Derived feature table: `data/cleaned/rent-trends.csv`

rent_3_month_change_pct
rent_12_month_change_pct
rent_24_month_change_pct
rent_volatility
rent_direction

example 

rent_12_month_change_pct =
    (latest_rent - rent_12_months_ago) / rent_12_months_ago

    This would support explanations such as:

“Estimated rent has increased 4.2% over the last 12 months.”

Keep the source date visible because these are historical estimates, not live market prices.

`rent_volatility` is the standard deviation of the latest 12 monthly percentage
changes. `rent_direction` uses a project-defined ±1% threshold on the
three-month change: values above 1% are `increasing`, values below -1% are
`decreasing`, and values in between are `stable`.


### Phase 4: Add flood-risk data ( )
Flood risk is especially relevant for Miami, but it should be presented as safety and planning information—not as a hidden tenant-screening variable.


flood_risk_by_area.csv

Possible fields:

zip
flood_zone
flood_zone_source
flood_zone_date
fema_special_flood_hazard_area_pct
elevation_median_ft
storm_surge_risk
flood_risk_label

For ZIP-level data, preserve the underlying percentages instead of converting everything immediately to one score. A ZIP can contain multiple flood zones.

Recommended UI output:

### Phase 5: Add commute and accessibility

commute_estimates.csv

origin_zip
destination_type
destination_id
mode
time_minutes
distance_miles
estimated_at

Possible destinations:

Downtown Miami
Brickell
Miami International Airport
Major transit hubs
User-provided workplace
The input contract would eventually need an optional field such 

{
  "destination": {
    "latitude": 25.76,
    "longitude": -80.19
  },
  "commute_mode": "transit"
}

Without a destination, show only general transit accessibility—not an “estimated commute.”

### Phase 6: Add daily-life amenities
This would improve personalization more safely than adding sensitive demographic variables.

amenities_by_zip.csv


grocery_store_count
pharmacy_count
healthcare_count
park_count
restaurant_count
childcare_count
dog_park_count
amenity_density_per_sq_mile
distance_to_nearest_grocery


These support preferences such as:

“I want grocery stores nearby”
“I have a dog”
“I want parks”
“I do not have a car”
“I need access to healthcare”
Use counts and distances rather than describing an area through demographic assumptions.

### Future expandsion 
- add more columns

## Expansion roadmap checklist

- [DONE] **Phase 1:** Measured transit features
- [DONE] **Phase 2:** Unit-level rent structure and affordability
- [DONE] **Phase 3:** Rent trends
- [HOLD] **Phase 4:** Flood-risk information
- [ ] **Phase 5:** Destination-based commute estimates
- [ ] **Phase 6:** Daily-life amenities
- [ ] **Phase 7:** Provenance and data freshness
- [ ] **Phase 8:** Confidence and uncertainty
- [ ] **Phase 9:** Ranking robustness and sensitivity
- [ ] **Phase 10:** Scenario and time-based evaluation
- [ ] **Phase 11:** User feedback loop
- [ ] **Phase 12:** Fairness and proxy audit