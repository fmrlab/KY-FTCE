app.factory('RouteSelectorFactory', ['Location','MarkerFactory','Cost', function (Location, MarkerFactory, Cost) {
	var gDirectionsRenderer,
		gDirectionsRenderer2 = null;

	var openAfterReverse = function (renderer, map) {
		Location.updateText(renderer);
		Location.addRouteChangeListener(renderer, map);
		renderer.infoWindow.open(map);
		renderer.setMap(map);
		renderer.setPanel( document.getElementById('sel-directions-list') );
	};

	var showCostInfo = function (directionsRenderer) {
		var tripDurationHrs = directionsRenderer.directions.routes[0].legs[0].duration.value/3600;
		var costPerHour = Cost.getTotal();
		if(costPerHour) {
			var totalCost = +costPerHour * tripDurationHrs;
			document.getElementById("sel-total-cost").innerHTML = "<p>One-way cost of trip is <b>$" + totalCost.toFixed(2) + "</b></p> <hr>";
		}
	};

	var RouteSelectorFactory = {
		getDirections: function (marker1, marker2, map) {
			var gLatlngbounds = new google.maps.LatLngBounds();
			gLatlngbounds.extend(marker1.getPosition());

			// start: marker1 (Logging Site), end: marker2 (Mill)
			Location.calcRoute(marker1.getPosition(), marker2.getPosition())
			.then(function (route) {
				return Location.displayRoute(route, map, gLatlngbounds);
			})
			.then(function (directionsRenderer) {
				gDirectionsRenderer = directionsRenderer;
				showCostInfo(directionsRenderer);

				// Set google directions panel
				directionsRenderer.setPanel( document.getElementById('sel-directions-list') );
			})
			.then(null, function (err) {
				console.error(err);
			});

			// If enabled, disable the "Calculate routes" button
			if(!document.getElementById('sel-calcRoute-button').disabled) {
				document.getElementById('sel-calcRoute-button').disabled = true;
			}
		},
		reverseDirections: function (marker1, marker2, map) {
			var rendererToRemove, rendererToDisplay;
			var startPoint = marker2.getPosition(); // start: Mill
			var endPoint = marker1.getPosition(); // end: Logging Site

			if(document.getElementById("sel-toFrom-txt").innerHTML == "to") {
				document.getElementById("sel-toFrom-txt").innerHTML = "from";
				rendererToDisplay = gDirectionsRenderer2;
				rendererToRemove = gDirectionsRenderer;
			}
			else {
				document.getElementById("sel-toFrom-txt").innerHTML = "to";
				rendererToDisplay = gDirectionsRenderer;
				rendererToRemove = gDirectionsRenderer2;
			}

			rendererToRemove.setMap(null);
			rendererToRemove.setPanel(null);
			rendererToRemove.infoWindow.close();

			if(!gDirectionsRenderer2) {
				Location.calcRoute(startPoint, endPoint)
				.then(function (route) {
					return Location.displayRoute(route, map, null);
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
			legend.id = 'routeSelector-legend';
			legend.className = 'legend';
			legend.innerHTML = '<h5>Legend</h5>';

			var table = document.createElement('table');
			table.className = 'legendBody';
			legend.appendChild(table);

			// Add content to legend
			var content = [
				{ url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png", label: "Mill"},
				{ url: "https://maps.google.com/mapfiles/markerL.png", label: "Logging Site"},
				{ url: "https://maps.google.com/mapfiles/markerD.png", label: "Destination"}
			];

			for (var i = 0; i < content.length; i++) {
				var tr = document.createElement('tr');
				tr.className = 'legendContent';
		        tr.innerHTML = '<td class="legendIcon"><img src=' + content[i].url + '></td>' + 
		        				'<td class="legendLabel">'+ content[i].label + '</td>';
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

			document.getElementById("sel-total-cost").innerHTML = "";
		}
	};

	return RouteSelectorFactory;
}]);