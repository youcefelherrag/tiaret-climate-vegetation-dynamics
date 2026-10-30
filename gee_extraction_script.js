// ===============================================================
// DATA-DRIVEN RAINFALL-NDVI ANALYSIS (TIARET, ALGERIA)
// Automatically detects the wettest season and links to spring NDVI
// ===============================================================

// ---------------------------------------------------------------
// 1. Study Area Definition
// ---------------------------------------------------------------
var aoi = ee.FeatureCollection("FAO/GAUL/2015/level1")
  .filter(ee.Filter.eq('ADM0_NAME', 'Algeria'))
  .filter(ee.Filter.eq('ADM1_NAME', 'Tiaret'));

Map.centerObject(aoi, 8);
Map.addLayer(aoi, {color: 'red'}, 'Tiaret Boundary', false);

// ---------------------------------------------------------------
// 2. CHIRPS Seasonal Rainfall Analysis (Sept - May)
// ---------------------------------------------------------------
var startYear = 2002;
var endYear = 2024;
var years = ee.List.sequence(startYear, endYear);

var chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY").filterBounds(aoi);

// Calculate total seasonal rainfall for each season
var rainfallFC = ee.FeatureCollection(years.map(function(y) {
  var year = ee.Number(y);
  var startDate = ee.Date.fromYMD(year, 9, 1);
  var endDate = ee.Date.fromYMD(year.add(1), 6, 1); // Includes May 31
  
  var seasonSum = chirps.filterDate(startDate, endDate)
    .select('precipitation')
    .sum()
    .reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: aoi.geometry(),
      scale: 5566,
      maxPixels: 1e9
    }).get('precipitation');
    
  return ee.Feature(null, {
    'Season': ee.String(year.format('%d')).cat('-').cat(year.add(1).format('%d')),
    'Start_Year': year,
    'End_Year': year.add(1),
    'Rainfall_mm': seasonSum,
    // The corresponding spring year is always the end year
    'Spring_Year': year.add(1) 
  });
}));

// Calculate Historical Mean and Standard Deviation
var rainStats = rainfallFC.reduceColumns({
  reducer: ee.Reducer.mean().combine({reducer2: ee.Reducer.stdDev(), sharedInputs: true}),
  selectors: ['Rainfall_mm']
});
var meanRain = ee.Number(rainStats.get('mean'));
var stdRain = ee.Number(rainStats.get('stdDev'));

// Add Z-Score to each season
var rainfallFC_Z = rainfallFC.map(function(f) {
  var r = ee.Number(f.get('Rainfall_mm'));
  var z = r.subtract(meanRain).divide(stdRain);
  return f.set('Z_Score', z);
});

// AUTOMATIC TARGET DETECTION: Sort descending by rainfall, pick the wettest
var wettestFeature = rainfallFC_Z.sort('Rainfall_mm', false).first();
var wettestSpringYear = ee.Number(wettestFeature.get('Spring_Year'));

// ---------------------------------------------------------------
// 3. MODIS Spring NDVI Analysis (April - June)
// ---------------------------------------------------------------
var modis = ee.ImageCollection("MODIS/061/MOD13Q1").filterBounds(aoi);

function maskQuality(image) {
  var qa = image.select('SummaryQA');
  var mask = qa.eq(0); // Strict 'Good Data' only
  return image.updateMask(mask)
              .select('NDVI')
              .multiply(0.0001)
              .copyProperties(image, ['system:time_start']); 
}

var ndviYears = ee.List.sequence(2002, 2025);
var springNdviCollection = ee.ImageCollection(ndviYears.map(function(y) {
  var year = ee.Number(y);
  var startDate = ee.Date.fromYMD(year, 4, 1);
  var endDate = ee.Date.fromYMD(year, 7, 1); // Includes June 30
  
  var springMedian = modis.filterDate(startDate, endDate)
                          .map(maskQuality)
                          .median()
                          .clip(aoi);
                          
  return springMedian.set('Spring_Year', year).set('system:time_start', startDate.millis());
}));

// Extract NDVI means for the time series table
var ndviFC = ee.FeatureCollection(springNdviCollection.map(function(img) {
  var year = img.get('Spring_Year');
  var meanNdvi = img.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: aoi.geometry(),
    scale: 250,
    maxPixels: 1e9
  }).get('NDVI');
                        
  return ee.Feature(null, {
    'Spring_Year': year,
    'Spring_NDVI': meanNdvi
  });
}));

// ---------------------------------------------------------------
// 4. Target NDVI Maps
// ---------------------------------------------------------------
var targetNdvi = springNdviCollection.filter(ee.Filter.eq('Spring_Year', wettestSpringYear)).first();
var baselineNdvi = springNdviCollection.filter(ee.Filter.neq('Spring_Year', wettestSpringYear)).median();
var anomalyNdvi = targetNdvi.subtract(baselineNdvi);

// ---------------------------------------------------------------
// 5. Statistical Analysis using JOIN (replaces dictionary lookup)
// ---------------------------------------------------------------
// Join the two FeatureCollections on the 'Spring_Year' property
var join = ee.Join.inner();
var filter = ee.Filter.equals({
  leftField: 'Spring_Year',
  rightField: 'Spring_Year'
});

var joinedFC = ee.FeatureCollection(join.apply(rainfallFC_Z, ndviFC, filter));

// Flatten the joined collection to bring NDVI into the rainfall feature
var combinedFC = joinedFC.map(function(f) {
  var rainFeat = ee.Feature(f.get('primary'));
  var ndviFeat = ee.Feature(f.get('secondary'));
  
  return rainFeat.set({
    'Spring_NDVI': ndviFeat.get('Spring_NDVI')
  });
});

// Remove any features where NDVI is null (safety check)
var finalFC = combinedFC.filter(ee.Filter.notNull(['Spring_NDVI']));

var n = finalFC.size();

// Calculate Correlations and Regression
var pearson = finalFC.reduceColumns({
  reducer: ee.Reducer.pearsonsCorrelation(),
  selectors: ['Rainfall_mm', 'Spring_NDVI']
});

var spearman = finalFC.reduceColumns({
  reducer: ee.Reducer.spearmansCorrelation(),
  selectors: ['Rainfall_mm', 'Spring_NDVI']
});

var regression = finalFC.reduceColumns({
  reducer: ee.Reducer.linearRegression(1, 1),
  selectors: ['Rainfall_mm', 'Spring_NDVI']
});

var coeffs = ee.Array(regression.get('coefficients')).project([0]);
var slope = coeffs.get([0]);
var intercept = coeffs.get([1]);
var r = ee.Number(pearson.get('correlation'));
var r2 = ee.Number(pearson.get('r2'));

// ---------------------------------------------------------------
// 6. Dynamic Visualization Settings
// ---------------------------------------------------------------
var rawStats = baselineNdvi.add(targetNdvi).divide(2).reduceRegion({
  reducer: ee.Reducer.percentile([2, 98]),
  geometry: aoi.geometry(),
  scale: 250,
  maxPixels: 1e9
});

var anomStats = anomalyNdvi.reduceRegion({
  reducer: ee.Reducer.percentile([2, 98]),
  geometry: aoi.geometry(),
  scale: 250,
  maxPixels: 1e9
});

rawStats.evaluate(function(stats) {
  var p2 = stats.NDVI_p2 !== null ? stats.NDVI_p2 : 0.0;
  var p98 = stats.NDVI_p98 !== null ? stats.NDVI_p98 : 0.7;
  var vis = {min: p2, max: p98, palette: ['f7fcb9', 'addd8e', '78c679', '31a354', '006837']};
  
  Map.addLayer(baselineNdvi, vis, 'Map A - Historical Spring NDVI Baseline');
  Map.addLayer(targetNdvi, vis, 'Map B - Spring NDVI During Wettest Season');
});

anomStats.evaluate(function(stats) {
  var p2 = stats.NDVI_p2 !== null ? stats.NDVI_p2 : -0.2;
  var p98 = stats.NDVI_p98 !== null ? stats.NDVI_p98 : 0.2;
  var maxAbs = Math.max(Math.abs(p2), Math.abs(p98));
  var vis = {min: -maxAbs, max: maxAbs, palette: ['8c2d04', 'd95f0e', 'fee8c8', 'ffffff', 'd9f0d3', '78c679', '238443']};
  
  Map.addLayer(anomalyNdvi, vis, 'Map C - Spring NDVI Anomaly');
});

// ---------------------------------------------------------------
// 7. Exports
// ---------------------------------------------------------------
// Export Rainfall Table
Export.table.toDrive({
  collection: rainfallFC_Z,
  description: 'CHIRPS_Seasonal_Rainfall_Tiaret',
  folder: 'GEE_Exports',
  fileFormat: 'CSV',
  selectors: ['Season', 'Start_Year', 'End_Year', 'Spring_Year', 'Rainfall_mm', 'Z_Score']
});

// Export NDVI Table
Export.table.toDrive({
  collection: ndviFC,
  description: 'MODIS_Spring_NDVI_Tiaret',
  folder: 'GEE_Exports',
  fileFormat: 'CSV',
  selectors: ['Spring_Year', 'Spring_NDVI']
});

// Export Combined Table for Statistical software
Export.table.toDrive({
  collection: finalFC,
  description: 'Combined_Rainfall_NDVI_Tiaret',
  folder: 'GEE_Exports',
  fileFormat: 'CSV',
  selectors: ['Season', 'Start_Year', 'Spring_Year', 'Rainfall_mm', 'Spring_NDVI', 'Z_Score']
});

// Export Maps (Using UTM Zone 31N for Tiaret)
var exportParams = {
  scale: 250,
  region: aoi.geometry(),
  fileFormat: 'GeoTIFF',
  maxPixels: 1e9,
  crs: 'EPSG:32631',
  folder: 'GEE_Exports'
};

Export.image.toDrive(Object.assign({}, exportParams, {
  image: baselineNdvi,
  description: 'Tiaret_Baseline_NDVI_Historical'
}));

Export.image.toDrive(Object.assign({}, exportParams, {
  image: targetNdvi,
  description: 'Tiaret_Wettest_Season_NDVI'
}));

Export.image.toDrive(Object.assign({}, exportParams, {
  image: anomalyNdvi,
  description: 'Tiaret_NDVI_Anomaly'
}));

// ---------------------------------------------------------------
// 8. Automated Summary Print
// ---------------------------------------------------------------
var targetNdviVal = targetNdvi.reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi.geometry(), scale: 250, maxPixels: 1e9}).get('NDVI');
var baselineNdviVal = baselineNdvi.reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi.geometry(), scale: 250, maxPixels: 1e9}).get('NDVI');
var anomalyNdviVal = anomalyNdvi.reduceRegion({reducer: ee.Reducer.mean(), geometry: aoi.geometry(), scale: 250, maxPixels: 1e9}).get('NDVI');

var summaryDict = ee.Dictionary({
  'Wettest Season': wettestFeature.get('Season'),
  'Wettest Season Rainfall (mm)': wettestFeature.get('Rainfall_mm'),
  'Wettest Season Z-score': wettestFeature.get('Z_Score'),
  'Corresponding Spring Year': wettestSpringYear,
  'Spring NDVI (Mean)': targetNdviVal,
  'Historical Baseline NDVI (Mean)': baselineNdviVal,
  'NDVI Anomaly (Mean)': anomalyNdviVal,
  'Pearson r': r,
  'Spearman rho': spearman.get('correlation'),
  'R-squared': r2,
  'Regression Slope': slope,
  'Regression Intercept': intercept,
  'Sample Size (n)': n
});

print('===================================================');
print('AUTOMATED RAINFALL-NDVI ANALYSIS SUMMARY');
print('===================================================');
print(summaryDict);
print('Note: For n~20, a t-statistic > 2.1 generally indicates p < 0.05.');
print('===================================================');
