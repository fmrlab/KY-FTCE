app.factory('HeatmapFactory', function () {
	var heatmapLayers = [], mapInit = true;
	var heatmapType;

	var showLegend = function (map) {
		var ranges;
		var legend = document.createElement('div');
		legend.className = 'legend';
		legend.innerHTML = '<h5>Legend</h5>';

		// These are the legend ranges
		if(heatmapType === 'time') {
			ranges = ['<5 min', '5-10 min', '10-15 min', '15-25 min', '25-35 min', '35-45 min', '>45 min'];
		} else {
			ranges = ['<5 mi', '5-10 mi', '10-15 mi', '15-20 mi', '20-25 mi', '25-30 mi', '>30 mi'];
		}

		// Create legend
		for (var i = 0; i < ranges.length; i++) {
			var div = document.createElement('div');
			div.className = 'legendContent';
	        div.innerHTML = '<div id="legendBlock' + i + '" class="legendBlock"></div> ' + ranges[i];
	        legend.appendChild(div);
		}
		// Place legend on google map
		map.controls[google.maps.ControlPosition.RIGHT_TOP].push(legend);
	};

	// Removes old legend. Used when switch heatmap type
	var removeOldLegend = function (map) {
		map.controls[google.maps.ControlPosition.RIGHT_TOP].clear();
	};

	var removeHeatmapLayer = function () {
		for(var i = 0; i < heatmapLayers.length; i++) {
			heatmapLayers[i].setMap(null);
		}
		heatmapLayers.length = 0;
	};

	var HeatmapFactory = {
		setHeatmapType: function (type, map) {
			heatmapType = type;
			if(!mapInit) {
				this.displayHeatmapLayer(map);
				removeOldLegend(map);
			}
			showLegend(map);
		},
		displayHeatmapLayer: function (map) {
			if(!mapInit) {
				removeHeatmapLayer();
			}

			var heatmapLayer;

			// Id of folder where KML is temporarily stored
			var folderId = heatmapType === 'time' ? '0B5jpfgQG9ByFSUdzSDk4ZzcxcVE':'0B5jpfgQG9ByFRVhSeEZfNjFxdnM';
			for(var i = 0; i < 2; i++) {

				heatmapLayer = new google.maps.KmlLayer({
					url: 'https://www.googledrive.com/host/' + folderId + '/millHeatmap' + i + '.zip', 
					preserveViewport: true,
					suppressInfoWindows: true,
					map: map
				});

				// Suppress default kml info window and create custom info window to be able to style it with css
				var infoWindow = new google.maps.InfoWindow({pixelOffset: new google.maps.Size(0, -32)});
				var div = document.createElement('div');
				google.maps.event.addListener(heatmapLayer, 'click', function(kmlEvent) {
					var title = kmlEvent.featureData.name;
					var body = kmlEvent.featureData.description;
					div.innerHTML = '<h5>' + title + '</h5>' + body;
					div.className = 'heatmap-infoWindow';
					infoWindow.setPosition(kmlEvent.latLng);
					infoWindow.setContent(div);
					infoWindow.open(map);
				});
				
				// Store layer in array so we can remove it later to display other heatmaps
				heatmapLayers.push(heatmapLayer);
			}

			mapInit = false;
		}
	};

	return HeatmapFactory;
});