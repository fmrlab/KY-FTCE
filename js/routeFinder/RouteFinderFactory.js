app.factory('RouteFinderFactory', ['MarkerFactory','Location','Mills','Cost', function (MarkerFactory, Location, Mills, Cost) {
	var gNumberOfPoints = 6,
		theClosestMill,
		gDirectionsRenderer,
		gDirectionsRenderer2 = null;

	var openAfterReverse = function (renderer, map) {
		Location.updateText(renderer);
		Location.addRouteChangeListener(renderer, map);
		renderer.infoWindow.open(map);
		renderer.setMap(map);
		renderer.setPanel( document.getElementById('opt-directions-list') );
	};

	var showCostInfo = function (directionsRenderer) {
		var tripDurationHrs = directionsRenderer.directions.routes[0].legs[0].duration.value/3600;
		var costPerHour = Cost.getTotal();
		if(costPerHour) {
			var totalCost = +costPerHour * tripDurationHrs;
			document.getElementById("opt-total-cost").innerHTML = "<p>One-way cost of trip is <b>$" + totalCost.toFixed(2) + "</b></p> <hr>";
		}
	};

	return {
		calcMillRoute: function(marker, map) {
			var gLatlngbounds = new google.maps.LatLngBounds();
			
			MarkerFactory.fixPosition(marker, map);

			var userMarkerPos = marker.getPosition();
			// add user marker to bounds object
			gLatlngbounds.extend(userMarkerPos);

			var gClosestMills = Location.radiallyClosest(userMarkerPos, gNumberOfPoints, Mills);
			
			Location.calcShortestTravel(userMarkerPos, gClosestMills)
			.then(function (closestMill) {
				theClosestMill = closestMill;
				return Location.calcRoute(userMarkerPos, closestMill.latLng)
			})
			.then(function (millRoute) {
				return Location.displayRoute(millRoute, map, gLatlngbounds);
			})
			.then(function (directionsRenderer) {
				gDirectionsRenderer = directionsRenderer;
				showCostInfo(directionsRenderer);

				// Set google directions panel
				directionsRenderer.setPanel( document.getElementById('opt-directions-list') );
			})
			.then(null, function(err) {
				console.error(err);
			});

			// If enabled, disable the "Calculate routes" button
			if(!document.getElementById('opt-calcRoute-button').disabled) {
				document.getElementById('opt-calcRoute-button').disabled = true;
			}

		},
		reverseDirections: function (marker, map) {
			var rendererToRemove, rendererToDisplay;
			var endPoint = marker.getPosition(); //user marker is now the end point

			if(document.getElementById("opt-toFrom-txt").innerHTML == "to") {
				document.getElementById("opt-toFrom-txt").innerHTML = "from";
				rendererToDisplay = gDirectionsRenderer2;
				rendererToRemove = gDirectionsRenderer;
			}
			else {
				document.getElementById("opt-toFrom-txt").innerHTML = "to";
				rendererToDisplay = gDirectionsRenderer;
				rendererToRemove = gDirectionsRenderer2;
			}

			rendererToRemove.setMap(null);
			rendererToRemove.setPanel(null);
			rendererToRemove.infoWindow.close();

			if(!gDirectionsRenderer2) {
				Location.calcRoute(theClosestMill.latLng, endPoint)
				.then(function (millRoute) {
					return Location.displayRoute(millRoute, map, null);
				})
				.then(function (directionsRenderer) {
					gDirectionsRenderer2 = directionsRenderer;
					showCostInfo(directionsRenderer);
					openAfterReverse(gDirectionsRenderer2, map);
				})
				.then(null, function (err) {
					console.error(err);
				});	
			} else {
				showCostInfo(rendererToDisplay);
				openAfterReverse(rendererToDisplay, map);
			}
		},
		showLegend: function (map) {
			// Create legend
			var legend = document.createElement('div');
			legend.className = 'legend';
			legend.innerHTML = '<h5>Legend</h5>';

			var table = document.createElement('table');
			table.className = 'legendBody';
			legend.appendChild(table);

			// Add content to legend
			// content[i][0] is the marker color. content[i][1] is the label
			var content = [['blue', 'Mill'], ['red', 'Logging Site'], ['green', 'Access Point']];
			for (var i = 0; i < content.length; i++) {
				var tr = document.createElement('tr');
				tr.className = 'legendContent';
		        tr.innerHTML = '<td class="legendIcon"><img src="https://maps.google.com/mapfiles/ms/icons/' + content[i][0] + '-dot.png"></td>' + 
		        				'<td class="legendLabel">'+ content[i][1] + '</td>';
		        table.appendChild(tr);
			}
			// Place legend on google map
			map.controls[google.maps.ControlPosition.RIGHT_TOP].push(legend);
		},
		clearDirectionsAndCost: function () {
			if(gDirectionsRenderer) {
				gDirectionsRenderer.setPanel(null);
				gDirectionsRenderer = null;
			} 
			if(gDirectionsRenderer2) {
				gDirectionsRenderer2.setPanel(null);
				gDirectionsRenderer2 = null;
			}

			document.getElementById("opt-total-cost").innerHTML = "";
		}

	};
}]);
