'use strict';

window.app = angular.module('LoggingPlanner', ['ui.router', 'ui.bootstrap']);

app.config(['$urlRouterProvider', '$locationProvider', function ($urlRouterProvider, $locationProvider) {
	// This turns off hashbang urls (/#about) and changes it to something normal (/about)
	$locationProvider.html5Mode(true);

	// If we go to a URL that ui-router doesn't have registered, go to the "/" url.
	$urlRouterProvider.otherwise('/heatmap');
}]);

app.factory('HeatmapFactory', function () {
	var heatmapLayers = [],
		mapInit = true;
	var heatmapType;

	var showLegend = function (map) {
		var ranges;
		var legend = document.createElement('div');
		legend.className = 'legend';
		legend.innerHTML = '<h5>Legend</h5>';

		// These are the legend ranges
		if (heatmapType === 'time') {
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
		for (var i = 0; i < heatmapLayers.length; i++) {
			heatmapLayers[i].setMap(null);
		}
		heatmapLayers.length = 0;
	};

	var HeatmapFactory = {
		setHeatmapType: function (type, map) {
			heatmapType = type;
			if (!mapInit) {
				this.displayHeatmapLayer(map);
				removeOldLegend(map);
			}
			showLegend(map);
		},
		displayHeatmapLayer: function (map) {
			if (!mapInit) {
				removeHeatmapLayer();
			}

			var heatmapLayer;
			for (var i = 0; i < 12; i++) {
				heatmapLayer = new google.maps.KmlLayer({
					url: 'http://www2.ca.uky.edu/forestry/KY-FTCE/assets/test_kml_1/' + heatmapType + '/millHeatmap' + i + '.zip', //<---- need to update
					preserveViewport: true,
					suppressInfoWindows: true,
					map: map
				});

				// Suppress default kml info window and create custom info window to be able to style it with css
				var infoWindow = new google.maps.InfoWindow({ pixelOffset: new google.maps.Size(0, -32) });
				var div = document.createElement('div');
				google.maps.event.addListener(heatmapLayer, 'click', function (kmlEvent) {
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
app.controller('HeatmapCtrl', ['$scope', 'GoogleMaps', 'MarkerFactory', '$rootScope', 'HeatmapFactory', 'Kml', function ($scope, GoogleMaps, MarkerFactory, $rootScope, HeatmapFactory, Kml) {
	var gMap;

	GoogleMaps.loadAPI.then(function () {
		initMap();
	});

	function initMap() {
		var mapCenterPoint = new google.maps.LatLng(37.791322359780914, -85.01533446044925);
		gMap = new google.maps.Map(document.getElementById('hm-map'), {
			zoom: 7,
			center: mapCenterPoint,
			mapTypeId: google.maps.MapTypeId.ROADMAP
		});

		Kml.addKYBoundaryLayer(gMap);
		HeatmapFactory.setHeatmapType('time', gMap);
		HeatmapFactory.displayHeatmapLayer(gMap);
	}

	var heatmapTypeListener = $rootScope.$on('setHeatmapType', function (event, type) {
		HeatmapFactory.setHeatmapType(type, gMap);
	});
	$scope.$on('$destroy', heatmapTypeListener);

	var checkBoxListener = $rootScope.$on('toggleHeatmapMarkers', function () {
		MarkerFactory.toggleMarkers(gMap);
	});
	// Unbind from the checkboxListener when scope is destroyed (i.e. when go to another state) to avoid memory leaks
	$scope.$on('$destroy', checkBoxListener);

	$scope.$on('$destroy', function () {
		MarkerFactory.deleteMarkerArr();
	});
}]);
app.config(['$stateProvider', function ($stateProvider) {
	$stateProvider.state('heatmap', {
		url: '/heatmap',
		template: '<div id="hm-map"></div>',
		controller: 'HeatmapCtrl'
	});
}]);
app.factory('RouteFinderFactory', ['MarkerFactory', 'Location', 'Mills', 'Cost', function (MarkerFactory, Location, Mills, Cost) {
	var gNumberOfPoints = 6,
		theClosestMill,
		gDirectionsRenderer,
		gDirectionsRenderer2 = null;

	var openAfterReverse = function (renderer, map) {
		Location.updateText(renderer);
		Location.addRouteChangeListener(renderer, map);
		renderer.infoWindow.open(map);
		renderer.setMap(map);
		renderer.setPanel(document.getElementById('opt-directions-list'));
	};

	var showCostInfo = function (directionsRenderer) {
		var tripDurationHrs = directionsRenderer.directions.routes[0].legs[0].duration.value / 3600;
		var costPerHour = Cost.getTotal();
		if (costPerHour) {
			var totalCost = +costPerHour * tripDurationHrs;
			document.getElementById("opt-total-cost").innerHTML = "<p>One-way cost of trip is <b>$" + totalCost.toFixed(2) + "</b></p> <hr>";
		}
	};

	return {
		calcMillRoute: function (marker, map) {
			var gLatlngbounds = new google.maps.LatLngBounds();

			MarkerFactory.fixPosition(marker, map);

			var userMarkerPos = marker.getPosition();
			// add user marker to bounds object
			gLatlngbounds.extend(userMarkerPos);

			var gClosestMills = Location.radiallyClosest(userMarkerPos, gNumberOfPoints, Mills);

			Location.calcShortestTravel(userMarkerPos, gClosestMills).then(function (closestMill) {
				theClosestMill = closestMill;
				return Location.calcRoute(userMarkerPos, closestMill.latLng);
			}).then(function (millRoute) {
				return Location.displayRoute(millRoute, map, gLatlngbounds);
			}).then(function (directionsRenderer) {
				gDirectionsRenderer = directionsRenderer;
				gDirectionsRenderer2 = null;
				showCostInfo(directionsRenderer);

				// Set google directions panel
				directionsRenderer.setPanel(document.getElementById('opt-directions-list'));
			}).then(null, function (err) {
				console.error(err);
			});

			// If enabled, disable the "Calculate routes" button
			if (!document.getElementById('opt-calcRoute-button').disabled) {
				document.getElementById('opt-calcRoute-button').disabled = true;
			}
		},
		removeCurrentRoute: function () {
			var rendererToRemove;

			if (document.getElementById("opt-toFrom-txt").innerHTML == "to") {
				rendererToRemove = gDirectionsRenderer;
			}
			else {
				rendererToRemove = gDirectionsRenderer2;
			}

			rendererToRemove.setMap(null);
			rendererToRemove.setPanel(null);
			rendererToRemove.infoWindow.close();
		},
		reverseDirections: function (marker, map) {
			var rendererToDisplay;
			var endPoint = marker.getPosition(); //user marker is now the end point

			this.removeCurrentRoute();

			if (document.getElementById("opt-toFrom-txt").innerHTML == "to") {
				document.getElementById("opt-toFrom-txt").innerHTML = "from";
				rendererToDisplay = gDirectionsRenderer2;
			}
			else {
				document.getElementById("opt-toFrom-txt").innerHTML = "to";
				rendererToDisplay = gDirectionsRenderer;
			}

			if (!gDirectionsRenderer2) {
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
				tr.innerHTML = '<td class="legendIcon"><img src="https://maps.google.com/mapfiles/ms/icons/' + content[i][0] + '-dot.png"></td>' + '<td class="legendLabel">' + content[i][1] + '</td>';
				table.appendChild(tr);
			}
			// Place legend on google map
			map.controls[google.maps.ControlPosition.RIGHT_TOP].push(legend);
		},
		clearDirectionsAndCost: function () {
			if (gDirectionsRenderer) {
				gDirectionsRenderer.setPanel(null);
				gDirectionsRenderer = null;
			}
			if (gDirectionsRenderer2) {
				gDirectionsRenderer2.setPanel(null);
				gDirectionsRenderer2 = null;
			}

			document.getElementById("opt-total-cost").innerHTML = "";
		}

	};
}]);

app.factory('SharedVariableFactory', function () {
	var gZoom = 7;
	var gCenterPoint = { lat: 37.791322359780914, lng: -85.01533446044925 };
	return {
		getZoom: function () {
			return gZoom;
		},
		setZoom: function (zoom) {
			gZoom = zoom;
		},
		getMapCenterPoint: function () {
			return gCenterPoint;
		},
		setMapCenterPoint: function (latitude, longitude) {
			gCenterPoint = { lat: latitude, lng: longitude };
		}
	};

});

app.controller('RouteFinderCtrl', ['$scope', '$rootScope', '$state', 'GoogleMaps', 'MarkerFactory', 'RouteFinderFactory', 'Kml', 'SharedVariableFactory', function ($scope, $rootScope, $state, GoogleMaps, MarkerFactory, RouteFinderFactory, Kml, SharedVariableFactory) {
	var gMap, gUserMarker, gMeasureTool, gDistanceMeasureMode;

	GoogleMaps.loadAPI.then(function () {
		initMap();
	});

	function initMap() {
		gDistanceMeasureMode = 0;
		var zoomLevel = SharedVariableFactory.getZoom();
		var centerPointLatLng = SharedVariableFactory.getMapCenterPoint();
		var mapCenterPoint = new google.maps.LatLng(centerPointLatLng.lat, centerPointLatLng.lng);

		gMap = new google.maps.Map(document.getElementById('opt-map'), {
			zoom: zoomLevel,
			center: mapCenterPoint,
			disableDoubleClickZoom: true,
			mapTypeId: google.maps.MapTypeId.ROADMAP
		});

		Kml.addKYBoundaryLayer(gMap);
		MarkerFactory.displayMarkers(gMap);

		RouteFinderFactory.showLegend(gMap);
		google.maps.event.addListener(gMap, 'zoom_changed', function () {
			SharedVariableFactory.setZoom(gMap.getZoom());
		});

		google.maps.event.addListener(gMap, 'center_changed', function () {
			var centerPoint = gMap.getCenter();
			SharedVariableFactory.setMapCenterPoint(centerPoint.lat(), centerPoint.lng());
		});


		// add click event to place a marker on the map
		google.maps.event.addListener(gMap, 'click', function (event) {
			if (gDistanceMeasureMode == 0) {
				gUserMarker = MarkerFactory.placeOnMap(event.latLng, gUserMarker, gMap);
				// enable the "Calculate routes" button
				if (document.getElementById('opt-calcRoute-button').disabled) {
					document.getElementById('opt-calcRoute-button').disabled = false;
				}
			}

		});

		gMeasureTool = new MeasureTool(gMap, {
			showSegmentLength: false,
			unit: MeasureTool.UnitTypeId.IMPERIAL
		});

		gMeasureTool.addListener('measure_start', function () {
			gDistanceMeasureMode = 1;
		});
		gMeasureTool.addListener('measure_end', function () {
			gDistanceMeasureMode = 0;
		});

	}

	// When the calcMillRoute button is clicked, calculate and display route
	var calcOptimalRouteListener = $rootScope.$on('calcOptimalRoute', function () {
		RouteFinderFactory.calcMillRoute(gUserMarker, gMap);
	});
	// Unbind from the calcMillRouteListener when scope is destroyed (i.e. when go to another state) to avoid memory leaks
	$scope.$on('$destroy', calcOptimalRouteListener);

	var calcOptimalRouteFromAccessPointListener = $rootScope.$on('accessPointDragend', function () {
		var accessPointMarker = MarkerFactory.getAccessPointMarker();
		RouteFinderFactory.removeCurrentRoute();
		RouteFinderFactory.calcMillRoute(accessPointMarker, gMap);
	});

	// When the reverse button is clicked, calculate and display reversed route
	var reverseOptimalRouteListener = $rootScope.$on('reverseOptimalDirections', function () {
		var userMarker;
		var accessPointMarker = MarkerFactory.getAccessPointMarker();
		if (accessPointMarker == null || typeof accessPointMarker == 'undefined') {
			userMarker = gUserMarker;
		} else {
			userMarker = accessPointMarker;
		}
		RouteFinderFactory.reverseDirections(userMarker, gMap);
	});
	// Unbind from the reverseRouteListener when scope is destroyed (i.e. when go to another state) to avoid memory leaks
	$scope.$on('$destroy', reverseOptimalRouteListener);

	// When the clear button is clicked, reload state
	var clearRouteMapListener = $rootScope.$on('clearOptimalRouteMap', function () {
		$state.reload();
	});
	// Unbind from the clearRouteMapListener when scope is destroyed (i.e. when go to another state) to avoid memory leaks
	$scope.$on('$destroy', clearRouteMapListener);

	$scope.$on('$destroy', function () {
		MarkerFactory.deleteMarkerArr();
		RouteFinderFactory.clearDirectionsAndCost();
	});
}]);
app.config(['$stateProvider', function ($stateProvider) {
	$stateProvider.state('routeFinder', {
		url: '/routeFinder',
		template: '<div id="opt-map"></div>',
		controller: 'RouteFinderCtrl'
	});
}]);
app.factory('RouteSelectorFactory', ['Location', 'MarkerFactory', 'Cost', function (Location, MarkerFactory, Cost) {
	var gDirectionsRenderer,
		gDirectionsRenderer2 = null;

	var openAfterReverse = function (renderer, map) {
		Location.updateText(renderer);
		Location.addRouteChangeListener(renderer, map);
		renderer.infoWindow.open(map);
		renderer.setMap(map);
		renderer.setPanel(document.getElementById('sel-directions-list'));
	};

	var showCostInfo = function (directionsRenderer) {
		var tripDurationHrs = directionsRenderer.directions.routes[0].legs[0].duration.value / 3600;
		var costPerHour = Cost.getTotal();
		if (costPerHour) {
			var totalCost = +costPerHour * tripDurationHrs;
			document.getElementById("sel-total-cost").innerHTML = "<p>One-way cost of trip is <b>$" + totalCost.toFixed(2) + "</b></p> <hr>";
		}
	};

	var RouteSelectorFactory = {
		getDirections: function (marker1, marker2, map) {
			var gLatlngbounds = new google.maps.LatLngBounds();
			gLatlngbounds.extend(marker1.getPosition());

			// start: marker1 (Logging Site), end: marker2 (Mill)
			Location.calcRoute(marker1.getPosition(), marker2.getPosition()).then(function (route) {
				return Location.displayRoute(route, map, gLatlngbounds);
			}).then(function (directionsRenderer) {
				gDirectionsRenderer = directionsRenderer;
				showCostInfo(directionsRenderer);

				// Set google directions panel
				directionsRenderer.setPanel(document.getElementById('sel-directions-list'));
			}).then(null, function (err) {
				console.error(err);
			});

			// If enabled, disable the "Calculate routes" button
			if (!document.getElementById('sel-calcRoute-button').disabled) {
				document.getElementById('sel-calcRoute-button').disabled = true;
			}
		},
		removeCurrentRoute:function(){
			var rendererToRemove;

			if(document.getElementById("opt-toFrom-txt").innerHTML == "to") {
				rendererToRemove = gDirectionsRenderer;
			}
			else {
				rendererToRemove = gDirectionsRenderer2;
			}

			rendererToRemove.setMap(null);
			rendererToRemove.setPanel(null);
			rendererToRemove.infoWindow.close();
		},
		reverseDirections: function (marker1, marker2, map) {
			var rendererToDisplay;
			var startPoint = marker2.getPosition(); // start: Mill
			var endPoint = marker1.getPosition(); // end: Logging Site
			this.removeCurrentRoute();

			if(document.getElementById("sel-toFrom-txt").innerHTML == "to") {
				document.getElementById("sel-toFrom-txt").innerHTML = "from";
				rendererToDisplay = gDirectionsRenderer2;
			}
			else {
				document.getElementById("sel-toFrom-txt").innerHTML = "to";
				rendererToDisplay = gDirectionsRenderer;
			}

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
			var content = [{ url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png", label: "Mill" }, { url: "https://maps.google.com/mapfiles/markerL.png", label: "Logging Site" }, { url: "https://maps.google.com/mapfiles/markerD.png", label: "Destination" }];

			for (var i = 0; i < content.length; i++) {
				var tr = document.createElement('tr');
				tr.className = 'legendContent';
				tr.innerHTML = '<td class="legendIcon"><img src=' + content[i].url + '></td>' + '<td class="legendLabel">' + content[i].label + '</td>';
				table.appendChild(tr);
			}
			// Place legend on google map
			map.controls[google.maps.ControlPosition.RIGHT_TOP].push(legend);
		},
		clearDirectionsAndCost: function () {
			if (gDirectionsRenderer) {
				gDirectionsRenderer.setPanel(null);
				gDirectionsRenderer = null;
			}
			if (gDirectionsRenderer2) {
				gDirectionsRenderer2.setPanel(null);
				gDirectionsRenderer2 = null;
			}

			document.getElementById("sel-total-cost").innerHTML = "";
		}
	};

	return RouteSelectorFactory;
}]);
app.controller('RouteSelectorCtrl', ['$scope', '$rootScope', '$state', 'GoogleMaps', 'RouteSelectorFactory', 'MarkerFactory', 'Kml', function ($scope, $rootScope, $state, GoogleMaps, RouteSelectorFactory, MarkerFactory, Kml) {
	var gMap, calcRouteClicked,
		markers = [];

	GoogleMaps.loadAPI.then(function () {
		initMap();
	});

	function initMap() {
		var mapCenterPoint = new google.maps.LatLng(37.791322359780914, -85.01533446044925);
		gMap = new google.maps.Map(document.getElementById('sel-map'), {
			zoom: 7,
			center: mapCenterPoint,
			mapTypeId: google.maps.MapTypeId.ROADMAP
		});

		calcRouteClicked = false;
		Kml.addKYBoundaryLayer(gMap);
		MarkerFactory.displayMarkers(gMap);
		RouteSelectorFactory.showLegend(gMap);

		google.maps.event.addListener(gMap, 'click', function (event) {
			var numOfMarkers = markers.length;
			var labels = "LD";

			if (numOfMarkers < 2) {
				var label = labels[numOfMarkers];
				if (numOfMarkers === 1) {
					if (document.getElementById('sel-calcRoute-button').disabled) {
						document.getElementById('sel-calcRoute-button').disabled = false;
					}
				}
				// MarkerFactory.placeOnMap returns a reference to the marker that was placed on the map
				markers.push(MarkerFactory.placeOnMap(event.latLng, null, gMap, label));
			}
		});
	}

	var selectedRouteListener = $rootScope.$on('calcSelectedRoute', function () {
		RouteSelectorFactory.getDirections(markers[0], markers[1], gMap);
		calcRouteClicked = true;
	});
	// Unbind from the selectedRouteListener when scope is destroyed (i.e. when go to another state) to avoid memory leaks
	$scope.$on('$destroy', selectedRouteListener);

	var userMarkerDragEndListener = $rootScope.$on('userMarkerDragend', function (){
		if (markers.length == 2 && calcRouteClicked == true){
			RouteSelectorFactory.removeCurrentRoute();
			RouteSelectorFactory.getDirections(markers[0], markers[1], gMap);
		}
	});

	$scope.$on('$destroy', userMarkerDragEndListener);

	var revSelectedRouteListener = $rootScope.$on('reverseSelectedDirections', function () {
		RouteSelectorFactory.reverseDirections(markers[0], markers[1], gMap);
	});
	// Unbind from the revSelectedRouteListener when scope is destroyed (i.e. when go to another state) to avoid memory leaks
	$scope.$on('$destroy', revSelectedRouteListener);

	// When the clear button is clicked, reload state
	var clearRouteMapListener = $rootScope.$on('clearSelectedRouteMap', function () {
		$state.reload();
	});
	// Unbind from the clearRouteMapListener when scope is destroyed (i.e. when go to another state) to avoid memory leaks
	$scope.$on('$destroy', clearRouteMapListener);

	$scope.$on('$destroy', function () {
		RouteSelectorFactory.clearDirectionsAndCost();
	});
}]);
app.config(['$stateProvider', function ($stateProvider) {
	$stateProvider.state('routeSelector', {
		url: '/routeSelector',
		template: '<div id="sel-map"></div>',
		controller: 'RouteSelectorCtrl'
	});
}]);
app.factory('Cost', function () {
	var total = null;
	var Cost = {
		getTotal: function () {
			return total;
		},
		setTotal: function (totalCost) {
			total = totalCost;
		}
	};
	return Cost;
});
/*
* Code adapted from: http://stackoverflow.com/questions/24246403/angularjs-load-google-map-script-async-in-directive-for-multiple-maps?rq=1
*/
app.factory('GoogleMaps', ['$window', '$q', function ($window, $q) {

	function loadScript() {
		var gMapKey = 'AIzaSyBQzpglO-65VjZnsPSac1-rZ1JIduXdtZo';//'AIzaSyCN9k-zbh2NrAynay5Tgz0400K1JsJpiJ4';
		var script = document.createElement('script');
		script.src = 'https://maps.googleapis.com/maps/api/js?key=' + gMapKey + '&callback=apiLoaded';
		document.body.appendChild(script);
	}

	var deferred = $q.defer();
	//Callback function - resolving promise after api has successfully loaded
	$window.apiLoaded = deferred.resolve;
	if ($window.attachEvent) {
		$window.attachEvent('onload', loadScript);
	} else {
		$window.addEventListener('load', loadScript, false);
	}

	var GoogleMaps = {
		loadAPI: deferred.promise
	};

	return GoogleMaps;
}]);

app.factory('Kml', function () {
	var KML = {
		addKYBoundaryLayer: function (map) {
			// Add Kentucky state KML layer
			var kyKML = new google.maps.KmlLayer({
				url: 'http://www2.ca.uky.edu/forestry/KY-FTCE/assets/kml-data/ky_state_boundary.zip', // <----- need to update
				clickable: false,
				suppressInfoWindows: true,
				preserveViewport: true,
				map: map
			});
		}
	};

	return KML;
});
app.factory('Location', ['UnitConvert', 'MarkerFactory', 'Cost', function (UnitConvert, MarkerFactory, Cost) {

	/**
 * Sort by last element in array
 */
	var _sortByLastElement = function (a, b) {
		if (a[a.length - 1] > b[b.length - 1]) {
			return 1;
		}
		if (a[a.length - 1] < b[b.length - 1]) {
			return -1;
		}
		// a must be equal to b
		return 0;
	};

	var gCalcDuration = function (origin, destinations) {
		var request = {
			origins: origin,
			destinations: destinations,
			travelMode: google.maps.TravelMode.DRIVING
		};

		return new Promise(function (resolve, reject) {
			var service = new google.maps.DistanceMatrixService();
			service.getDistanceMatrix(request, function (response, status) {
				if (status === google.maps.DistanceMatrixStatus.OK) {
					resolve(response);
				} else {
					reject(status);
				}
			});
		});
	};

	var gCalcRoute = function (origin, destination) {
		// create a request object for the directions service call
		var request = {
			origin: origin,
			destination: destination,
			travelMode: google.maps.TravelMode.DRIVING
		};

		return new Promise(function (resolve, reject) {
			var gDirectionsService = new google.maps.DirectionsService();
			gDirectionsService.route(request, function (response, status) {
				if (status === google.maps.DistanceMatrixStatus.OK) {
					resolve(response);
				} else {
					reject(status);
				}
			});
		});
	};

	var displayRouteInfoWindow = function (directionsRenderer, map) {
		// create infowindow for route
		directionsRenderer.infoWindow = new InfoBubble({
			maxWidth: 250,
			maxHeight: 100,
			content: null,
			position: new google.maps.LatLng(0, 0),
			shadowStyle: 1,
			padding: 0,
			backgroundColor: 'rgb(57,57,57)',
			borderRadius: 4,
			arrowSize: 10,
			borderWidth: 1,
			borderColor: '#2c2c2c',
			disableAutoPan: true,
			arrowPosition: 30,
			arrowStyle: 2
		});

		Location.updateText(directionsRenderer);
		// open route infowindow
		directionsRenderer.infoWindow.open(map);
	};

	var Location = {
		radiallyClosest: function (origin, numOfDestinations, destinations) {
			var lat = origin.lat(); // origin latitude
			var lng = origin.lng(); // origin longitude
			var R = 6371; // radius of earth in km
			var destinationList = angular.copy(destinations); //need to deep copy the destinations array to avoid modifying it when sorting

			for (var i = 0; i < destinationList.length; i++) {
				var mlat = destinationList[i][7]; // get possible destination latitude
				var mlng = destinationList[i][8]; // get possible destination longitude
				var dLat = UnitConvert.toRad(mlat - lat);
				var dLong = UnitConvert.toRad(mlng - lng);

				// calculate distance between 2 points using haversine formula
				var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(UnitConvert.toRad(lat)) * Math.cos(UnitConvert.toRad(lat)) * Math.sin(dLong / 2) * Math.sin(dLong / 2);
				var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
				var d = R * c;

				destinationList[i].push(d); //Push distance into destinationList array
			}

			// Sort from closest to farthest destination
			destinationList.sort(_sortByLastElement);

			// Return closest routes
			return destinationList.splice(0, numOfDestinations);
		},
		calcShortestTravel: function (origin, destinations) {

			var destCoordinates = [],
				durations = [];

			for (var i = 0; i < destinations.length; i++) {
				destCoordinates[i] = new google.maps.LatLng(destinations[i][7], destinations[i][8]);
			}

			//Calculate driving time from origin to a list of destinations
			return gCalcDuration([origin], destCoordinates).then(function (response) {
				var results = response.rows[0].elements;

				for (var j = 0; j < results.length; j++) {
					// duration (driving time) is in seconds
					// distance is in meters
					durations.push([j, results[j].duration.value]);
				}

				// Sort from shortest to longest travel time
				durations.sort(_sortByLastElement);

				// Select shortest driving time
				var shortest = durations[0];
				var shortestIndex = shortest[0];

				// Return destination with shortest driving time
				return {
					latLng: destCoordinates[shortestIndex]
				};
			});
		},
		calcRoute: function (origin, destination) {
			return gCalcRoute(origin, destination);
		},
		displayRoute: function (route, map, boundsObj) {
			var directionsRenderer = new google.maps.DirectionsRenderer({
				directions: route,
				preserveViewport: true, // don't change the view
				suppressMarkers: true, // don't add markers at the start and end
				draggable: true
			});

			displayRouteInfoWindow(directionsRenderer, map);

			this.addRouteChangeListener(directionsRenderer, map);

			// set the route on the map
			directionsRenderer.setMap(map);
			directionsRenderer.setDirections(route);

			if (boundsObj) {
				// display access point marker
				MarkerFactory.displayAccessPoint(directionsRenderer, map);
				// Add destination marker to bounds object
				boundsObj.extend(directionsRenderer.directions.routes[0].legs[0].end_location);
				// zoom to include all points in bounds object
				map.fitBounds(boundsObj);

				// Since the fitBounds function zooms in too much, we zoom out a little
				var zoomChangeBoundsListener = google.maps.event.addListenerOnce(map, 'bounds_changed', function (event) {
					var currentZoom = this.getZoom();
					if (currentZoom) {
						this.setZoom(currentZoom - 1);
					}
				});
				setTimeout(function () {
					google.maps.event.removeListener(zoomChangeBoundsListener);
				}, 2000);
			}

			return directionsRenderer;
		},
		updateText: function (directionsRenderer) {
			// get trip distance
			var tripDistance = directionsRenderer.directions.routes[0].legs[0].distance.text.toString();
			// get trip duration
			var tripDuration = directionsRenderer.directions.routes[0].legs[0].duration.text.toString();
			var durationHrs = directionsRenderer.directions.routes[0].legs[0].duration.value / 3600;

			var tripInfo;
			var costPerHour = Cost.getTotal();

			// create string to be used in route infowindow
			if (costPerHour) {
				var totalCost = +costPerHour * durationHrs;
				tripInfo = '<div class="routelabel">' + 'Mill: ' + tripDistance + ' - ' + tripDuration + ' - $' + totalCost.toFixed(2) + '</div>';
			} else {
				tripInfo = '<div class="routelabel">' + 'Mill: ' + tripDistance + ' - ' + tripDuration + '</div>';
			}

			directionsRenderer.points = directionsRenderer.directions.routes[0].overview_path;

			console.log('point length', directionsRenderer.points.length);
			// calculate approximate halfway point of route
			var halfWayPoint = directionsRenderer.points[Math.ceil(directionsRenderer.points.length / 2)];
			console.log('halfWayPoint', halfWayPoint);

			directionsRenderer.infoWindow.content = tripInfo;
			directionsRenderer.infoWindow.position = halfWayPoint;
		},
		addRouteChangeListener: function (directionsRenderer, map) {
			var self = this;
			google.maps.event.addListener(directionsRenderer, 'directions_changed', function (event) {
				self.updateText(directionsRenderer);

				// open route infowindow
				directionsRenderer.infoWindow.open(map);
			});
		}
	};

	return Location;
}]);
app.factory('MarkerFactory', ['Mills', '$rootScope', function (Mills, $rootScope) {
	var gMillMarkers = [];
	var mills = Mills;
	var gAccessPointMarker;

	var updateInfoWindow = function (map, marker, contentString) {
		// change the content of the infowindow
		marker.infoWindow.setContent(contentString);
		// open the infowindow with the updated information
		marker.infoWindow.open(map, marker);
	};

	var geocodePosition = function (marker, pos, map, label) {
		var positionString, title;
		var geocoder = new google.maps.Geocoder();

		geocoder.geocode({ latLng: pos }, function (results, status) {
			if (status == google.maps.GeocoderStatus.OK) {
				if (label === "D") title = "Destination"; else title = "Logging Site";
				// update the marker's infowindow information with the formatted address
				updateInfoWindow(map, marker, title + "<br>" + results[0].formatted_address.slice(0, results[0].formatted_address.length - 5) + "<br> Lat: " + pos.lat().toFixed(4) + " Lng: " + pos.lng().toFixed(4));
			} else {
				// there was an error decoding the address
				alert('Cannot determine address at this location:' + status);
			}
		});
	};

	var MarkerFactory = {
		displayMarkers: function (map) {
			var millInfoWindow = new google.maps.InfoWindow();
			if (!gMillMarkers.length) {
				//For loop to create a marker with an infowindow for each mill
				for (var i = 0; i < mills.length; i++) {

					var name = mills[i][1],
						address = mills[i][2],
						city = mills[i][3],
						state = mills[i][4],
						zip = mills[i][5],
						county = mills[i][6],
						lat = +mills[i][7],
						lng = +mills[i][8],
						itype = mills[i][9],
						latLngSet = new google.maps.LatLng(lat, lng);

					var millContent = '<div class="map-content">' + 'Company name: ' + '<b>' + name + '</b>' + '<br />' + 'Industry type: ' + itype + '<br />' + 'Address: ' + address + '<br />' + 'City: ' + city + '<br />' + 'State: ' + state + '<br />' + 'Zip code: ' + zip + '<br />' + 'County: ' + county + '</div>';

					gMillMarkers[i] = new google.maps.Marker({
						map: map,
						title: name,
						position: latLngSet,
						icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
					});

					google.maps.event.addListener(gMillMarkers[i], 'click', function (marker, content) {
						return function () {
							millInfoWindow.setContent(content);
							millInfoWindow.open(map, marker);
						};
					}(gMillMarkers[i], millContent));
				}
			} else {
				for (var i = 0; i < gMillMarkers.length; i++) {
					gMillMarkers[i].setMap(map);
				}
			}
		},
		toggleMarkers: function (map) {
			if (document.getElementById('checkbox-showLoc').checked) {
				this.displayMarkers(map);
			} else {
				this.clearAllMarkers();
			}
		},
		clearAllMarkers: function () {
			for (var i = 0; i < gMillMarkers.length; i++) {
				gMillMarkers[i].setMap(null);
			}
		},
		deleteMarkerArr: function () {
			gMillMarkers.length = 0;
		},
		placeOnMap: function (location, userMarker, map, label) {
			if (!userMarker) {
				// if there's no user marker on the map, create one
				userMarker = new google.maps.Marker({
					draggable: true,
					position: location,
					map: map,
					label: label
				});

				// create an infowindow to display the address of the marker
				userMarker.infoWindow = new google.maps.InfoWindow();
			} else {
				// else, just change the location
				userMarker.setPosition(location);
				userMarker.infoWindow.close();
			}

			geocodePosition(userMarker, location, map, label);

			// add drag event to update infowindow information
			google.maps.event.addListener(userMarker, 'dragend', function () {
				userMarker.infoWindow.close();
				geocodePosition(userMarker, userMarker.getPosition(), map, label);
				$rootScope.$emit('userMarkerDragend');
			});

			// add click event to open infowindow when marker is clicked
			google.maps.event.addListener(userMarker, 'click', function (event) {
				userMarker.infoWindow.open(map, userMarker);
			});

			return userMarker;
		},
		fixPosition: function (marker, map) {
			// set marker not draggable once the routes calculation starts
			marker.draggable = false;

			// clear click event listeners on map so the marker doesn't change position anymore
			google.maps.event.clearListeners(map, 'click');
		},
		displayAccessPoint: function (directionsRenderer, map) {
			var start = directionsRenderer.directions.routes[0].legs[0].start_location;
			var end = directionsRenderer.directions.routes[0].legs[0].end_location;

			if (Math.abs(end.lat() - start.lat()) > 0.001 || Math.abs(end.lng() - start.lng()) > 0.001) {
				// create an infowindow to display the address of the marker
				var infoWindow = new google.maps.InfoWindow({
					content: '<div style="width: 180px">Access Point<br />Lat: ' + start.lat().toFixed(4) + ' Lng: ' + start.lng().toFixed(4) + '</div>'
				});
				if (gAccessPointMarker == null || typeof gAccessPointMarker == 'undefined') {
					gAccessPointMarker = new google.maps.Marker({
						draggable: true,
						position: start,
						map: map,
						zIndex: Date.now(),
						icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
					});
					// add click event to open infowindow when marker is clicked
					google.maps.event.addListener(gAccessPointMarker, 'click', function (event) {
						infoWindow.open(map, gAccessPointMarker);
					});
					google.maps.event.addListener(gAccessPointMarker, 'dragend', function () {
						$rootScope.$emit('accessPointDragend');
					});
				} else {
					gAccessPointMarker.draggable = true;
					gAccessPointMarker.setPosition(start);
				}

			}
		},
		getAccessPointMarker: function () {
			return gAccessPointMarker;
		},
		setAccessPointMarker: function (accessPointMarker) {
			gAccessPointMarker = accessPointMarker;
		}
	};

	return MarkerFactory;
}]);
app.factory('Mills', function () {
	return [["Loc1", "3C Lumber Company", "9872 Elkhorn Creek Rd.", "Ashcamp", "KY", "41512", "Pike", "37.25634", "-82.47847", "Primary"], ["Loc2", "A & A Sawmill", "4321 Mill Creek Road", "Tompkinsville", "KY", "42167", "Monroe", "36.6411", "-85.67879", "Primary"], ["Loc3", "A & C Wood Products LLC", "4137 Hwy 7", "Southshore", "KY", "41175", "Greenup", "38.6839099999999", "-82.91947", "Primary"], ["Loc4", "Abney Premium Hardwoods", "2600 Hwy. 146 East", "LaGrange", "KY", "40031", "Oldham", "38.41783", "-85.3493299999999", "Primary"], ["Loc5", "Ameridapt Lumber Co.", "Miller Branch Rd.", "Bimble", "KY", "40915", "Knox", "36.90178", "-83.8341999999999", "Primary"], ["Loc6", "Anderson's Sawmill", "5220 Sheperdsville Rd.", "Samuels", "KY", "40013", "Nelson", "37.87384", "-85.5323999999999", "Primary"], ["Loc7", "B & F Woodwork Co., Inc.", "8783 West Hwy. 90", "Monticello", "KY", "42633", "Wayne", "36.7680999999999", "-84.9641199999999", "Primary"], ["Loc8", "Beaver Wood Products", "Box 9885 St. Rt. 7, Greenup, KY", "Beaver", "OH", "45613", "Greenup", "38.61937", "-82.9301799999999", "Primary"], ["Loc9", "Bertram Lumber Co.", "East Hwy. 90, Monticello", "Alpha", "KY", "42603", "Wayne", "36.7636699999999", "-84.9833799999999", "Primary"], ["Loc10", "Beshear Sawmill, Inc.", "1977 Dawson Rd.", "Princeton", "KY", "42445", "Caldwell", "37.12172", "-87.8486599999999", "Primary"], ["Loc11", "Bluegrass Fence Manufacturing", "1700 US 41 South", "Sebree", "KY", "42455", "Webster", "37.58278", "-87.52319", "Primary"], ["Loc12", "Blufftop Custom Sawing", "1925 E. Gap Hill Rd.", "Cub Run", "KY", "42729", "Hart", "37.2895499999999", "-86.0829899999999", "Primary"], ["Loc13", "BPM Lumber, LLC", "Hwy 421, N. Hwy. 80 W.", "Hyden", "KY", "41749", "Leslie", "37.14818", "-83.4048999999999", "Primary"], ["Loc14", "BPM Lumber, LLC", " ", "Whitesburg", "KY", "41858", "Letcher", "37.1282", "-82.8405099999999", "Primary"], ["Loc15", "BPM Lumber, LLC", "250 Adams Rd., Pikeville", "Whitesburg", "KY", "41858", "Pike", "37.485235", "-82.54514", "Primary"], ["Loc16", "BPM Lumber, LLC", "1101 Armory Dr.", "Jackson", "KY", "41339", "Breathitt", "37.1479799999999", "-83.40446", "Primary"], ["Loc17", "Breck County Hardwoods", "10172 W. Dixie Hwy.", "Hardinsburg", "KY", "40143", "Breckinridge", "37.8330199999999", "-86.5978199999999", "Primary"], ["Loc18", "Buddy Schindler & Sons", "Porter Schoolhouse Rd., Calhoun", "Livermore", "KY", "42352", "McLean", "37.60605", "-87.35062", "Primary"], ["Loc19", "C & E Rayburn Lumber Co., Inc.", "19329 W. US Hwy. 60", "Olive Hill", "KY", "41164", "Carter", "38.2867099999999", "-83.23753", "Primary"], ["Loc20", "C & W Lumber", "10132 Cub Run Hwy.", "Munfordville", "KY", "42765", "Hart", "37.29025", "-86.02343", "Primary"], ["Loc21", "C. A. Mac LLC", "929 State Route 493", "Clay", "KY", "42404", "Webster", "37.47178", "-87.8527399999999", "Primary"], ["Loc22", "C. Miller Logging & Lumber Co.", "1695 S. Dixie Hwy.", "Munfordville", "KY", "42765", "Hart", "37.25197", "-85.8915599999999", "Primary"], ["Loc23", "Carter Sawmill, Inc.", "2995 N. Hwy. 333", "Webster", "KY", "40176", "Breckinridge", "37.88667", "-86.3403899999999", "Primary"], ["Loc24", "Cedarville Lumber LLC", "495 Sawmill Road", "Bethleham", "KY", "40007", "Henry", "38.44236", "-85.0015899999999", "Primary"], ["Loc25", "Childress Sawmill", "2814 Lilac Road", "Leitchfield", "KY", "42754", "Grayson", "37.5180599999999", "-86.32823", "Primary"], ["Loc26", "Clay Sawmill", "1470 Barlow Road", "Wickliffe", "KY", "42087", "Ballard", "37.05516", "-89.0492399999999", "Primary"], ["Loc27", "Coalfield Lumber Co., Inc.", "1 Red Oak Dr.", "Inez", "KY", "41224", "Martin", "37.8996799999999", "-82.5702799999999", "Primary"], ["Loc28", "Coles Bend Lumber", "2870  Coles Bend Rd.", "Smiths Grove", "KY", "42171", "Barren", "36.9457", "-86.1458599999999", "Primary"], ["Loc29", "Cox Dimensions", "1001 Columbia Rd.", "Campbellsville", "KY", "42718", "Taylor", "37.32255", "-85.35934", "Primary"], ["Loc30", "Crawford Tie & Lumber", "1571 Meadow Creek Rd.", "Woodbine", "KY", "40771", "Whitley", "36.8767599999999", "-84.06923", "Primary"], ["Loc31", "Crossroads Lumber Co.", "13957 E. Hwy. 70", "Yosemite", "KY", "42566", "Casey", "37.26245", "-84.78663", "Primary"], ["Loc32", "Cub Run Hardwoods", "12715 Priceville Rd.", "Cub Run", "KY", "42729", "Hart", "37.3157399999999", "-86.0588", "Primary"], ["Loc33", "Cumberland Ridge Forest Products", "1300 Old Railroad Lane", "Guthrie", "KY", "42234", "Todd", "36.76285", "-87.1595599999999", "Primary"], ["Loc34", "Curry Timber Products, Inc.", "1909 Hwy. 490", "East Bernstadt", "KY", "40729", "Laurel", "37.19865", "-84.1167099999999", "Primary"], ["Loc35", "D & C Lumber Sales, Inc.", "214 Easton Rd.", "Fordsville", "KY", "42343", "Ohio", "37.64811", "-86.72646", "Primary"], ["Loc36", "D & E Lumber", "2025 Richards Hollow Rd.", "Columbia", "KY", "42728", "Adair", "37.03425", "-85.42001", "Primary"], ["Loc37", "Davidson Sawmill", "2010 S. Maywood", "Stanford", "KY", "40484", "Lincoln", "37.4661499999999", "-84.62273", "Primary"], ["Loc38", "Double O Veneer", "Old 25 E.", "Gray", "KY", "40734", "Knox", "36.8604699999999", "-83.84583", "Primary"], ["Loc39", "Dunaway Timber Co., Inc.", "Jct. Hwy 185 & 70, Roundhill", "Fordsville", "KY", "42343", "Edmonson", "37.2371199999999", "-86.42793", "Primary"], ["Loc40", "Dunaway Timber Co., Inc.", "115 Ansel Horsley Ln., Garfield", "Fordsville", "KY", "42343", "Breckinridge", "37.7801499999999", "-86.35858", "Primary"], ["Loc41", "Dunaway Timber Co., Inc.", "214 Easton Rd.", "Fordsville", "KY", "42343", "Ohio", "37.64878", "-86.72535", "Primary"], ["Loc42", "Dunaway Timber Co., Inc.", "Flat Creek Rd., Madisonville", "Fordsville", "KY", "42343", "Hopkins", "37.24879", "-87.45779", "Primary"], ["Loc43", "E & E Hardwoods", "8274 Hwy. 221", "Stoney Fork", "KY", "40988", "Bell", "36.82421", "-83.5429599999999", "Primary"], ["Loc44", "East Anderson Hardwoods, LLC", "3851 Hodgenville Rd., Elizabethtown", "Eubank", "KY", "42567", "Hardin", "37.6280399999999", "-85.80499", "Primary"], ["Loc45", "ecoPower Generation", " ", "Hazard", "KY", "41702", "Perry", "37.24954", "-83.19323", "Primary"], ["Loc46", "Engle's Custom Sawing & Construction", "2517 Horse Fly Hollow Rd.", "Lebanon Junction", "KY", "40150", "Bullitt", "37.8988999999999", "-85.7274599999999", "Primary"], ["Loc47", "Environmental Wood Recycling", "2085 Barren River Rd.", "Bowling Green", "KY", "42101", "Warren", "36.9947299999999", "-86.48716", "Primary"], ["Loc48", "Ernest Isaccs Lumber", "Hwy. 52 Ravenna", "Ravenna", "KY", "40472", "Estill", "37.88342", "-83.95354", "Primary"], ["Loc49", "Eugene Rayburn Lumber, Inc.", "Fleming Fork", "Olive Hill", "KY", "41164", "Carter", "38.29533", "-83.29304", "Primary"], ["Loc50", "Evans Lumber", "2874 East KY 9", "Vanceburg", "KY", "41179", "Lewis", "38.57415", "-83.28073", "Primary"], ["Loc51", "Fairview Forest Products LLC", "4438 US Hwy 68", "Ewing", "KY", "41039", "Fleming", "38.4559", "-83.96738", "Primary"], ["Loc52", "Fannin's Sawmill, Inc.", "Hwy. 172  at Elk Fork", "West Liberty", "KY", "41472", "Morgan", "37.9556299999999", "-83.14673", "Primary"], ["Loc53", "Ferrell's Logging & Lumber, Inc.", "2349 Indian Creek Rd.", "Frenchburg", "KY", "40322", "Menifee", "37.9290499999999", "-83.6683299999999", "Primary"], ["Loc54", "Forest Products, Inc.", "Happy Hollow Rd., Williamsburg", "Corbin", "KY", "40702", "Whitley", "36.63078", "-84.43554", "Primary"], ["Loc55", "Forest Products, Inc.", "Hwy. 11, Manchester", "Corbin", "KY", "40702", "Clay", "37.1031199999999", "-83.75458", "Primary"], ["Loc56", "Forest Products, Inc.", "Happy Hollow Rd., Williamsburg", "Corbin", "KY", "40702", "Whitley", "36.63078", "-84.43554", "Primary"], ["Loc57", "Forest Products, Inc.", "7152 Hwy. 38", "Evarts", "KY", "40828", "Harlan", "36.8546139999999", "-83.217612", "Primary"], ["Loc58", "Foster Lumber Co.", "Hwy. 92 E.", "Monticello", "KY", "42633", "Wayne", "36.75254", "-84.7137599999999", "Primary"], ["Loc59", "Frederick & May Lumber Co., Inc.", "273 Hwy 364, Cottle, KY", "West Liberty", "KY", "41472", "Morgan", "37.87735", "-83.18607", "Primary"], ["Loc60", "Frye Lumber Co.", "354 Comer Rd.", "Burnside", "KY", "42519", "Pulaski", "36.9675999999999", "-84.5896699999999", "Primary"], ["Loc61", "Fulkerson Timber Co.", "878 Rockchester Rd.", "Beaver Dam", "KY", "42320", "Ohio", "37.3811", "-86.87838", "Primary"], ["Loc62", "Fultz, Lowell", " ", "Beattyville", "KY", "41311", "Lee", "37.5006399999999", "-83.7898399999999", "Primary"], ["Loc63", "Gay Brothers Logging & Lumber", "3222 Hwy 1482", "Oneida", "KY", "40972", "Clay", "37.25533", "-83.62157", "Primary"], ["Loc64", "Gay's Mill", "704 Gay's Mill Loop", "Buckhorn", "KY", "41721", "Perry", "37.28482", "-83.5425599999999", "Primary"], ["Loc65", "Geary Brothers, Inc.", "12230 Hwy 431 N., Central City", "Livermore", "KY", "42352", "Muhlenberg", "37.5049199999999", "-87.02852", "Primary"], ["Loc66", "Geary Brothers, Inc.", "16860 SR 136 E.", "Livermore", "KY", "42352", "Ohio", "37.5049199999999", "-87.02852", "Primary"], ["Loc67", "Gilbert Sawmill", "Sawmill Rd.", "Campton", "KY", "41301", "Wolfe", "37.70586", "-83.5896699999999", "Primary"], ["Loc68", "Gingerich, Amos", "1221 Amish Rd.", "Sonora", "KY", "42776", "Hardin", "37.53656", "-85.9644399999999", "Primary"], ["Loc69", "Glasscock Log & Lumber, Inc.", "2870 Springfield Rd.", "Bloomfield", "KY", "40008", "Nelson", "37.8747499999999", "-85.30106", "Primary"], ["Loc70", "Glasscock Sawmill, Inc.", "3085 W. River Rd.", "Taylorsville", "KY", "40071", "Spencer", "38.0079399999999", "-85.3749499999999", "Primary"], ["Loc71", "Glisson Lumber Co., Inc.", "739 St. Rt. 339 W.", "Mayfield", "KY", "42066", "Graves", "36.64143", "-88.64533", "Primary"], ["Loc72", "Goodwin Lumber Co., Inc.", "727 Clarksburg Rd.", "Vanceburg", "KY", "41179", "Lewis", "38.60072", "-83.33736", "Primary"], ["Loc73", "Graf Brothers Flooring & Lumber, Inc.", "Rt. 10 (Old US 23), Vanceburg", "South Shore", "KY", "41175", "Lewis", "38.5929", "-83.3480799999999", "Primary"], ["Loc74", "Greentree Forest Products, Inc.", "746 Muses Mill Rd.", "Wallingford", "KY", "41093", "Fleming", "38.3121799999999", "-83.55637", "Primary"], ["Loc75", "H & S Lumber, Inc.", "1250 Lofty Heigths Rd.", "Clay City", "KY", "40312", "Powell", "37.8747899999999", "-83.9480099999999", "Primary"], ["Loc76", "Hardy Valley Lumber", "5250 S. Dixie Hwy.", "Horse Cave", "KY", "42749", "Hart", "37.2084699999999", "-85.87305", "Primary"], ["Loc77", "Hart County Hardwoods LLC", "Cedar Lane", "Munfordville", "KY", "42765", "Hart", "37.29211", "-86.02713", "Primary"], ["Loc78", "Harvey, Steve", "170 Bliss Road", "Columbia", "KY", "42728", "Adair", "37.07623", "-85.3651399999999", "Primary"], ["Loc79", "Heartland Timber Company", " ", "Benton", "KY", "42025", "Marshall", "36.85728", "-88.3503099999999", "Primary"], ["Loc80", "High Country Lumber", "2579 Kefuauver Rd.", "Millwood", "KY", "42762", "Grayson", "37.4766899999999", "-86.37202", "Primary"], ["Loc81", "Hinton Sawmill", "261 Morton Brown Rd.", "Hardinsburg", "KY", "40143", "Breckinridge", "37.64555", "-86.45478", "Primary"], ["Loc82", "Holmes Hardwood", "298 Almon Wolford Rd.", "Columbia", "KY", "42728", "Adair", "37.15896", "-85.1083399999999", "Primary"], ["Loc83", "Holt Sawmill, Inc.", "3313 Old Olive Road", "Benton", "KY", "42025", "Marshall", "36.8095399999999", "-88.2598799999999", "Primary"], ["Loc84", "Hostetler, Andy", "1470 Howser Road", "Smiths Grove", "KY", "42171", "Barren", "37.0055899999999", "-86.1212699999999", "Primary"], ["Loc85", "Hostetler, Joe", "676 Caney Creek Rd.", "Caneyville", "KY", "42721", "Grayson", "37.4108099999999", "-86.38015", "Primary"], ["Loc86", "Isaacs Lumber Company", "Hwy 52", "Irvine", "KY", "40472", "Estill", "37.7006379999999", "-83.973813", "Primary"], ["Loc87", "J & C Lumber", "262 Possum Pocket Rd.", "Nortonville", "KY", "42442", "Hopkins", "37.12543", "-87.49357", "Primary"], ["Loc88", "J & J Lumber LLC", "2/10 mi jct hwy 84 & 920 on hwy 920", "Eastview", "KY", "42732", "Hardin", "37.6236499999999", "-86.1895899999999", "Primary"], ["Loc89", "J & L Lumber, Inc.", "321 Silver Beech Rd.", "Hartford", "KY", "42347", "Ohio", "37.4874", "-86.92484", "Primary"], ["Loc90", "J. Downey & Son Lumber Co.", "1301 Greensburg Rd.", "Columbia", "KY", "42728", "Adair", "37.09986", "-85.33663", "Primary"], ["Loc91", "J. R. Smith, Inc.", " ", "Flat Lick", "KY", "40935", "Knox", "36.91527", "-83.73865", "Primary"], ["Loc92", "James Ritter Lumber Co., Inc.", "212 Little Barren Rd.", "Greensburg", "KY", "42743", "Green", "37.11328", "-85.58203", "Primary"], ["Loc93", "James Ritter Lumber Co., Inc.", "125 Hubgroce Rd., Burksville", "Summer Shade", "KY", "42166", "Cumberland", "36.6587699999999", "-85.37321", "Primary"], ["Loc94", "James Ritter Lumber Co., Inc.", "4796 Summer Shade Rd.", "Summer Shade", "KY", "42166", "Metcalfe", "36.8780799999999", "-85.66525", "Primary"], ["Loc95", "James Sharpe & Son Cedar Mill", "4357 Edmonton Rd.", "Greensburg", "KY", "42743", "Green", "37.19865", "-85.54094", "Primary"], ["Loc96", "Johny Rich Lumber Co.", "1046 Mud Camp Rd.", "Burkesville", "KY", "42717", "Cumberland", "36.8177", "-85.4704399999999", "Primary"], ["Loc97", "JW Perry Lumber, LLC", "4745 Macon-Kessinger Rd.", "Clarkson", "KY", "42726", "Grayson", "37.2215199999999", "-85.9600999999999", "Primary"], ["Loc98", "Kelly Mountain Lumber, Inc.", "50 Kelly Mountain Rd.", "Myra", "KY", "41549", "Pike", "37.21714", "-82.5366899999999", "Primary"], ["Loc99", "Kentucky Hardwood LLC", "17318 Dry Ridge Rd.", "Louisville", "KY", "40299", "Jefferson", "38.12729", "-85.4399899999999", "Primary"], ["Loc100", "Kentucky Hardwood Lumber Co., Inc.", "JCT Hwy. 27 & 1557, near Revelo", "Somerset", "KY", "42502", "McCreary", "36.69438", "-84.45699", "Primary"], ["Loc101", "Kentucky Hardwood Lumber Co., Inc.", "76 Sallys Branch Rd., London", "Somerset", "KY", "42502", "Laurel", "37.1190199999999", "-84.03685", "Primary"], ["Loc102", "Kentucky Hardwood Lumber Co., Inc.", "2805 Hwy. 2227", "Somerset", "KY", "42502", "Pulaski", "37.1336299999999", "-84.62894", "Primary"], ["Loc103", "Kentucky Timber Export", "8108 Bohannon Station Rd.", "Louisville", "KY", "40291", "Jefferson", "38.2301", "-85.78915", "Primary"], ["Loc104", "Keys Lumber Co.", "195 Jim Tom Strode Rd.", "Tompkinsville", "KY", "42167", "Monroe", "36.72504", "-85.7416099999999", "Primary"], ["Loc105", "Kirtley Sawmill", "4799 Jefferson School Rd.", "Scottsville", "KY", "42164", "Allen", "36.8500099999999", "-86.15841", "Primary"], ["Loc106", "Knox Hardwoods, LLC", "99 Goodin Branch Rd.", "Bimble", "KY", "40915", "Knox", "36.8707399999999", "-83.83083", "Primary"], ["Loc107", "Koppers Industries, Inc.", "East First St., Beaver Dam", "Olaton", "KY", "42361", "Ohio", "37.4024", "-86.87479", "Primary"], ["Loc108", "Koppers Industries, Inc.", "100 Blow Ave.", "Paducah", "KY", "42001", "McCracken", "37.0670199999999", "-88.60168", "Primary"], ["Loc109", "Lakeside Log and Lumber", "671 McAtee Rd.", "Cadiz", "KY", "42211", "Trigg", "36.78625", "-87.70739", "Primary"], ["Loc110", "Lanham Custom Sawing", "10040 Scythia Rd.", "Lewisport", "KY", "42351", "Daviess", "37.8163899999999", "-86.9168499999999", "Primary"], ["Loc111", "Larry Stalcup Lumber Co., Inc", "Albany Rd.", "Burkesville", "KY", "42717", "Cumberland", "36.76962", "-85.36323", "Primary"], ["Loc112", "Lawson's Sawmill", "249 Locust Dr.", "Pendelton", "KY", "40055", "Trimble", "38.51791", "-85.3063499999999", "Primary"], ["Loc113", "Lee County Wood Products", "103 Water Plant Rd.", "Beattyville", "KY", "41311", "Lee", "37.5285799999999", "-83.7276899999999", "Primary"], ["Loc114", "Leslie Hardwoods, Inc.", "3215 Pine Top Rd.", "London", "KY", "40743", "Laurel", "37.1109399999999", "-84.1511399999999", "Primary"], ["Loc115", "Logs to Lumber", "324 Apache Way", "Shepherdsville", "KY", "40165", "Bullitt", "37.94395", "-85.6679199999999", "Primary"], ["Loc116", "Logsdon Lumber & Farms LLC", "1035 Sand Hill Rd.", "Livermore", "KY", "42352", "Mclean", "37.5002199999999", "-87.1312099999999", "Primary"], ["Loc117", "Madden's Lumber LLC", "8403 KY W. 9, Charters, KY", "Vanceburg", "KY", "41179", "Lewis", "38.5742499999999", "-83.45259", "Primary"], ["Loc118", "Maggard Lumber", "590 Krypton Lick Branch Rd.", "Krypton", "KY", "41754", "Perry", "37.31226", "-83.3635199999999", "Primary"], ["Loc119", "Martin Brothers Logging", "3339 Ohio River Rd,", "Greenup", "KY", "41144", "Greenup", "38.6594399999999", "-82.8761499999999", "Primary"], ["Loc120", "Martin Lumber & Pallet", "1066 Meadow Grove Rd.", "Pine Knot", "KY", "42635", "McCreary", "36.69221", "-84.4244199999999", "Primary"], ["Loc121", "Mast, Abe", "11910 New Glendale Rd.", "Sonora", "KY", "42776", "Hardin", "37.5380899999999", "-85.94284", "Primary"], ["Loc122", "Masters Post & Sawmill, Inc.", "Old Hwy. 15, Pine Ridge", "Wellington", "KY", "40387", "Wolfe", "37.46088", "-83.3761599999999", "Primary"], ["Loc123", "Maxwell Brothers Lumber Co.", "4564 US Hwy. 60 W.", "Lewisport", "KY", "42351", "Hancock", "37.9281399999999", "-86.8282499999999", "Primary"], ["Loc124", "May Brothers Lumber Co.", "218 Sawmill Rd.", "Kimper", "KY", "41539", "Pike", "37.4861799999999", "-82.35423", "Primary"], ["Loc125", "McCafferty's Horse Logging", "8398 Owensboro Rd.", "Falls of Rough", "KY", "40119", "Grayson", "37.51429", "-86.43442", "Primary"], ["Loc126", "McCraw Lumber Co.", "173 McNickols Dr.", "Cadiz", "KY", "42211", "Trigg", "36.8724199999999", "-87.8264199999999", "Primary"], ["Loc127", "McCreary County Hardwood, Inc.", "741 Southern Hwy.", "Pine Knot", "KY", "42635", "McCreary", "36.64947", "-84.4380599999999", "Primary"], ["Loc128", "McCutchen Hardwoods", "Rt. 8, Box 5314", "Monticello", "KY", "42633", "Wayne", "36.8775199999999", "-84.8242099999999", "Primary"], ["Loc129", "McQueen Lumber", "5751 Hwy. 30 W.", "Annville", "KY", "40402", "Jackson", "37.5581022", "-83.3403453", "Primary"], ["Loc130", "Melvin Marks Sawmill", "Hwy 89 N., Sand Springs", "McKee", "KY", "40447", "Jackson", "37.4761999999999", "-83.9860199999999", "Primary"], ["Loc131", "Miller's Cedar Mill", "701 Falling Springs Hollow", "Horse Cave", "KY", "42749", "Hart", "37.2175999999999", "-85.9577299999999", "Primary"], ["Loc132", "Miller's Custom Sawing", "830 Martin Pierce Rd.", "Cub Run", "KY", "42729", "Edmonson", "37.29538", "-86.1208299999999", "Primary"], ["Loc133", "Miller's Sawmll", "2405 Quality Rd.", "Lewisburg", "KY", "42256", "Logan", "37.00126", "-86.91597", "Primary"], ["Loc134", "Moore, Brad", "1405 Hilltop Rd.", "Shepherdsville", "KY", "40165", "Bullitt", "38.0145399999999", "-85.8249", "Primary"], ["Loc135", "Morris Martin & Sons", "50 Rosel Rd.", "Juction City", "KY", "40440", "Boyle", "37.5445599999999", "-84.86497", "Primary"], ["Loc136", "National Lumber Co.", "807 W. Grandview", "Glassgow", "KY", "42141", "Barren", "36.9971499999999", "-85.93582", "Primary"], ["Loc137", "National Lumber Co.", "8757 Morgantown Rd.", "Russelville", "KY", "42276", "Logan", "36.94937", "-86.79477", "Primary"], ["Loc138", "Neal Lumber Co., Inc.", "1098 South Hwy. 127", "Albany", "KY", "42602", "Clinton", "36.6798199999999", "-85.12542", "Primary"], ["Loc139", "NEPCO", "S. Hwy 61 & Hughes Rd.", "Columbia", "KY", "42728", "Adair", "37.0472299999999", "-85.3600799999999", "Primary"], ["Loc140", "NewPage Corp.", "3412 US Hwy 62 E.", "Beaver Dam", "KY", "42320", "Ohio", "37.4254", "-86.81829", "Primary"], ["Loc141", "NewPage Corp.", "3748 US 62 East", "Eddyville", "KY", "42038", "Lyon", "37.10383", "-88.0236299999999", "Primary"], ["Loc142", "North 181 Lumber (a div. of Nelson Co.)", "12774 Greenvile Rd.", "Elkton", "KY", "42220", "Todd", "36.98413", "-87.1545299999999", "Primary"], ["Loc143", "North American Tie & Timber LLC", "Robinson St. & Cecil Ave., Cecilia, KY", "Oklahoma City", "OK", "42724", "Hardin", "37.6679999999999", "-85.9542799999999", "Primary"], ["Loc144", "Northland Trading LLC", "2600 Hwy 146 East", "LaGrange", "KY", "40031", "Oldham", "38.41783", "-85.3493299999999", "Primary"], ["Loc145", "Ohio Valley chipping", "Greenup, KY", "Piketon", "OH", "45661", "Greenup", "38.5823899999999", "-82.8418999999999", "Primary"], ["Loc146", "Owens Sawmill, Inc.", "1659 County Rd. 1201", "Arlington", "KY", "42021", "Carlisle", "36.81461", "-88.9883999999999", "Primary"], ["Loc147", "Paintsville Wood Products LLC", "170 State Rt. 201, Sitka, KY 41255", "Paintsville", "KY", "41240", "Johnson", "37.85495", "-82.82599", "Primary"], ["Loc148", "Parker Sawmill & Lumber", "131 Parker Lane", "Hickman", "KY", "42050", "Fulton", "36.5504499999999", "-89.24684", "Primary"], ["Loc149", "Parrett Lumber", "Owsley Fork Rd., Berea", "Richmond", "KY", "40475", "Madison", "37.55313", "-84.2060299999999", "Primary"], ["Loc150", "Patterson Chip Company", "99 Goodin Branch Rd.", "Barbourville", "KY", "40906", "Knox", "36.8705599999999", "-83.83114", "Primary"], ["Loc151", "Patterson Chip Company", "US Hwy. 25 S.,  Lily", "Barbourville", "KY", "40906", "Laurel", "37.0250199999999", "-84.06918", "Primary"], ["Loc152", "Peaceful Acres Farm", "3140 Flint Ridge Rd.", "Horse Cave", "KY", "42749", "Hart", "37.2192999999999", "-85.97056", "Primary"], ["Loc153", "Perry Hardwood Lumber,. Inc.", "205 West Dycus St.", "Fredonia", "KY", "42411", "Caldwell", "37.2016599999999", "-88.06622", "Primary"], ["Loc154", "Pine Knot Lumber, Inc.", "1088 Southern Hwy.", "Pine knot", "KY", "42635", "McCreary", "36.64466", "-84.4380699999999", "Primary"], ["Loc155", "Pisgah Hardwoods, Inc.", "Christian Mills Rd.", "Monticello", "KY", "42633", "Wayne", "36.829794", "-84.849113", "Primary"], ["Loc156", "Pittman Lumber Co.", "4365 Bradfordsville Rd.", "Lebanon", "KY", "40033", "Marion", "37.5257599999999", "-85.2117899999999", "Primary"], ["Loc157", "Precision Lumber", "3638 Kings Chapel Rd.", "Cadiz", "KY", "42211", "Trigg", "36.8319199999999", "-87.7378499999999", "Primary"], ["Loc158", "Premium Hardwoods, Inc.", "288 Premium Dr., S. Carrollton", "Bremen", "KY", "42325", "Muhlenburg", "37.32804", "-87.1416899999999", "Primary"], ["Loc159", "Pyles Lumber Co.", "Rt. 5, Box 557", "Albany", "KY", "42602", "Clinton", "36.73306", "-85.18984", "Primary"], ["Loc160", "Richard White Wood Products", "3222 Flemmingsburg Rd.", "Morehead", "KY", "40351", "Rowan", "38.2319", "-83.50394", "Primary"], ["Loc161", "Ridgetop Lumber Co.", "2888 Flint Ridge Rd.", "Horse Cave", "KY", "42749", "Hart", "37.2215199999999", "-85.9600999999999", "Primary"], ["Loc162", "River City Veneer Co.", "Hwy. 62, Lake City", "Paducah", "KY", "42001", "Livingston", "37.03063", "-88.27477", "Primary"], ["Loc163", "Roundtree Corporation", "1552 Winston Rd., Irvine, KY 40336", "Richmond", "KY", "40475", "Estill", "37.7015699999999", "-84.07231", "Primary"], ["Loc164", "S & S Enterprises", "850 Pecker Wood Ridge Rd.", "Summer Shade", "KY", "42166", "Metcalfe", "36.84176", "-85.63454", "Primary"], ["Loc165", "S & S Logging", "1802 Bucks Run Rd.", "Ghent", "KY", "41045", "Carroll", "38.7007199999999", "-85.0565799999999", "Primary"], ["Loc166", "S & S Lumber Co., Inc.", "575 Glen Carin Rd., Rodgers", "Pine Ridge", "KY", "41360", "Wolfe", "37.7440399999999", "-83.64494", "Primary"], ["Loc167", "S & S Stave Co., Inc.", "135 N. McDonald Rd.", "Leitchfield", "KY", "42754", "Grayson", "37.47014", "-86.32401", "Primary"], ["Loc168", "S & S Stave Co., Inc.", "1265 Trabue Rd.", "White Plains", "KY", "42464", "Hopkins", "37.2453", "-87.42059", "Primary"], ["Loc169", "Schwartz, Elmer", "Hwy 337", "Campbellsville", "KY", "42718", "Taylor", "37.38967", "-85.1863599999999", "Primary"], ["Loc170", "Sharpe & Sons", "736 Hodgenville Rd.", "Greensburg", "KY", "42743", "Green", "37.2753599999999", "-85.5086299999999", "Primary"], ["Loc171", "Smith Hardwood & Veneer, Inc", "Hwy 15 near Powell Valley", "Owingsville", "KY", "40360", "Powell", "37.8700699999999", "-83.94865", "Primary"], ["Loc172", "Southern KY Lumber Co.", "10084 Glasgow Rd. (Hwy. 90)", "Burkesville", "KY", "42717", "Cumberland", "36.83068", "-85.5118099999999", "Primary"], ["Loc173", "Specialty Wood Products, Inc.", "Hwy. 790", "Monticello", "KY", "42633", "Wayne", "36.83128", "-84.70686", "Primary"], ["Loc174", "Static Wood Products", "Hwy. 738", "Albany", "KY", "42602", "Clinton", "36.6609399999999", "-85.1652399999999", "Primary"], ["Loc175", "Static Wood Products", "Hwy. 738", "Albany", "KY", "42602", "Clinton", "36.62326", "-85.08516", "Primary"], ["Loc176", "Steve Clements Lumber", "268 Meshack Rd.", "Tompkinsville", "KY", "42167", "Monroe", "36.7453399999999", "-85.6398099999999", "Primary"], ["Loc177", "Stewart Lumber Co.", "Stoney Point", "Albany", "KY", "42602", "Clinton", "36.7517799999999", "-85.0830399999999", "Primary"], ["Loc178", "Stone Hill Hardwoods", "380 Stone Hill Rd.", "Vanceburg", "KY", "41179", "Lewis", "38.48019", "-83.2497599999999", "Primary"], ["Loc179", "Stonlzfus, Timothy", "700 Pruitt Lane", "Pembroke", "KY", "42266", "Christian", "36.7457399999999", "-87.39579", "Primary"], ["Loc180", "Strasburger, Donald", "2108 Windy Ridge Rd.", "Caneyville", "KY", "42721", "Grayson", "37.40719", "-86.5339699999999", "Primary"], ["Loc181", "Strong Forest Products", "5115 Hwy. 80 East", "Somerset", "KY", "24501", "Pulaski", "37.1300999999999", "-84.5491099999999", "Primary"], ["Loc182", "Superior Export Veneer, Inc.", "112 Nicholas Street, Elizabethtown", "Mt. Washington", "KY", "40047", "Hardin", "37.689", "-85.8572", "Primary"], ["Loc183", "Superior Export Veneer, Inc.", "120 Gaines Drive", "Campbellsville", "KY", "42718", "Taylor", "37.32258", "-85.35321", "Primary"], ["Loc184", "T & G Lumber", "1530 Red Cross Rd.", "Park City", "KY", "42160", "Barren", "36.9962", "-86.09753", "Primary"], ["Loc185", "Tarter Gate Wood Co.", "10739 S. Hwy 127", "Dunnville", "KY", "42528", "Casey", "37.19276", "-85.0124699999999", "Primary"], ["Loc186", "Thomas Brothers Sawmill, Inc.", "Hwy. 30 E.", "Booneville", "KY", "41314", "Owsley", "37.4891", "-83.62836", "Primary"], ["Loc187", "Thoroughbred Hardwoods", "Turner Rd.", "Monticello", "KY", "42633", "Wayne", "36.8144599999999", "-84.7981", "Primary"], ["Loc188", "Three Rivers Hardwood, Inc.", "140 Caudill Rd., Beattyville", "London", "KY", "40741", "Lee", "37.52064", "-83.7303399999999", "Primary"], ["Loc189", "Timber Services", "Hwy 11 S", "Flat Gap", "KY", "41219", "Lee", "37.69758", "-83.68568", "Primary"], ["Loc190", "Timbers, John", "2568 Middle Creek Rd.", "Elizabethtown", "KY", "42701", "Hardin", "37.6686899999999", "-85.77231", "Primary"], ["Loc191", "Triple K Post & Lumber Co.", "229 Hwy 976", "West Liberty", "KY", "41472", "Morgan", "37.9870799999999", "-83.25721", "Primary"], ["Loc192", "Triple R Lumber, Inc.", "749 Dry Hollow Rd.", "Garrison", "KY", "41141", "Lewis", "38.5998999999999", "-83.20394", "Primary"], ["Loc193", "Triple T Sawmill", "780 Galbriath Rd.", "Pleasureville", "KY", "40057", "Henry", "38.42678", "-85.1089199999999", "Primary"], ["Loc194", "Valley View Hardwoods, Inc.", "2041 Flemingsburg Rd.", "Morehead", "KY", "40351", "Rowan", "38.11809", "-83.4818499999999", "Primary"], ["Loc195", "Vaught Brothers", "13175 Hwy. 62 E.", "Central City", "KY", "42330", "Muhlenberg", "37.32197", "-87.0369599999999", "Primary"], ["Loc196", "Veneer Timber, Inc.", "340 S. Maple St. Expy.", "Winchester", "KY", "40391", "Clark", "38.00061", "-84.17641", "Primary"], ["Loc197", "W. K. Wedges & Boards", "555 Jarrels Creek Rd.", "Greenville", "KY", "42345", "Muhlenburg", "37.1449199999999", "-87.28127", "Primary"], ["Loc198", "Walton Hardwood Lumber", "706 Perkins Avenue", "Danville", "KY", "40422", "Boyle", "37.6244999999999", "-84.78188", "Primary"], ["Loc199", "Watkins' Lumber & Log Co. LLC", "1532 Red Cross Rd., Park City", "Glasgow", "KY", "42141", "Barren", "37.0135", "-85.8556899999999", "Primary"], ["Loc200", "Wayne Lumber Co., Inc.", "Hwy 90 W.", "Monticello", "KY", "42633", "Wayne", "36.77993", "-84.9502999999999", "Primary"], ["Loc201", "West Hardwoods", "4827 Bowling Green Rd.", "Morgantown", "KY", "42261", "Butler", "37.16926", "-86.68514", "Primary"], ["Loc202", "Whitley County Hardwoods, LLC", "3169 Hwy. 25 W., S. Williamsburg", "Emlyn", "KY", "40730", "Whitley", "36.7042199999999", "-84.1480899999999", "Primary"], ["Loc203", "Whitney & Whitney Lumber Co.", "333 Colinial Dr.", "Columbia", "KY", "42728", "Taylor", "37.2615399999999", "-85.36512", "Primary"], ["Loc204", "Windy Ridge Lumber", "821 I. Childress Rd.", "Munfordville", "KY", "42765", "Hart", "37.30474", "-85.93177", "Primary"], ["Loc205", "Wood Products of KY", "9655 KY Hwy 672", "Princeton", "KY", "42445", "Caldwell", "37.0476099999999", "-87.73917", "Primary"], ["Loc206", "Woodfield Hardwoods & Veneer", "U. S. 60 West", "Jackson", "OH", "45640", "Carter", "38.33263", "-82.96277", "Primary"], ["Loc207", "Woodstock Mills", "140 Cartertown Rd.", "Scottsville", "KY", "42164", "Allen", "36.7286", "-86.2222", "Primary"], ["Loc208", "Wright's Sawmill, Inc.", "1660 County Rd., 1201", "Arlington", "KY", "42021", "Carlisle", "36.8146199999999", "-88.9878499999999", "Primary"], ["Loc209", "Yoder, Dan M. R.", "325 Armes Lively Rd.", "Leitchfield", "KY", "42754", "Grayson", "37.4172999999999", "-86.3733699999999", "Primary"], ["Loc210", "Yoder's Sawmill", "7885 SR. 91 N.", "Marion", "KY", "42064", "Crittenden", "37.4236", "-88.1249799999999", "Primary"], ["Loc211", "Young Sawmill, Inc.", "449 Chick Rd.", "Beaver Dam", "KY", "42320", "Ohio", "37.39688", "-86.8652299999999", "Primary"], ["Loc212", "A.D.O.M.", "12031 Flemingsburd Rd.", "Morehead", "KY", "40351", "Bath", "38.1351299999999", "-85.57226", "Primary & Secondary"], ["Loc213", "Adkins Export Packing & Machinery Movers", "1301 Portland Ave.", "Louisville", "KY", "40203", "Jefferson", "38.26014", "-85.77114", "Primary & Secondary"], ["Loc214", "Allwood Manufacturing, Inc.", "101 N. Main Street", "Calvert City", "KY", "42029", "Marshall", "37.03266", "-88.34994", "Primary & Secondary"], ["Loc215", "American Wood Fibers", "390 Warehouse Road", "Lebanon", "KY", "40033", "Marion", "37.5647299999999", "-85.2733099999999", "Primary & Secondary"], ["Loc216", "American Woodmark", "Hwy 90 W.", "Monticello", "KY", "42633", "Wayne", "36.87033", "-84.8272199999999", "Primary & Secondary"], ["Loc217", "Ames True Temper", "991 Marion Rd, SR 91 N.", "Princeton", "KY", "42445", "Caldwell", "37.1308599999999", "-87.89725", "Primary & Secondary"], ["Loc218", "Anderson Forest Products, Inc.", "1267 Old Edmonton Rd.", "Tompkinsville", "KY", "42167", "Monroe", "36.75262", "-85.69262", "Primary & Secondary"], ["Loc219", "Anderson's Wood Products Co., Inc.", "1381 Beech Street", "Louisville", "KY", "40251", "Jefferson", "38.2345499999999", "-85.8045", "Primary & Secondary"], ["Loc220", "Armstrong Hardwoods", "620 KY Hwy 519", "Morehead", "KY", "40351", "Rowan", "38.1651799999999", "-83.4310499999999", "Primary & Secondary"], ["Loc221", "Associated Pallet, Inc.", "71 Premium Dr., South Carrollton", "Bremen", "KY", "42325", "Muhlenberg", "37.33117", "-87.1382499999999", "Primary & Secondary"], ["Loc222", "B & C Industries", "2434 Hwy 2227", "Somerset", "KY", "42503", "Pulaski", "37.13662", "-84.62685", "Primary & Secondary"], ["Loc223", "B & K Wood Products LLC", "830 Sawmill Road, Madisonville", "Earlington", "KY", "42410", "Hopkins", "37.2806", "-87.4634899999999", "Primary & Secondary"], ["Loc224", "B & K Wood Products, Firewood Div.", "Jct. 813 & Morton's Gap-White City Rd.", "Madisonville", "KY", "42431", "Hopkins", "37.2529299999999", "-87.4452", "Primary & Secondary"], ["Loc225", "B & R Lumber, Inc.", "6095 Rochester Road", "Morgantown", "KY", "42261", "Butler", "37.18213", "-86.7770199999999", "Primary & Secondary"], ["Loc226", "Baillie Lumber Co.", "279 Shaw Station Rd.", "Leitchfield", "KY", "42754", "Grayson", "37.4877499999999", "-86.2690699999999", "Primary & Secondary"], ["Loc227", "Ballard Lumber & Pallet Co.", "7945 Loretto Rd.", "Loretto", "KY", "40037", "Nelson", "37.7044599999999", "-85.4556599999999", "Primary & Secondary"], ["Loc228", "Barron Pallet Co. No.2", "Hwy. 1582", "Liberty", "KY", "42539", "Casey", "37.3789", "-84.8789", "Primary & Secondary"], ["Loc229", "Barron Pallets, Inc.", "170 Old Cuba Road", "Eubank", "KY", "42567", "Pulaski", "37.26494", "-84.6342099999999", "Primary & Secondary"], ["Loc230", "Baxter Logging", "Hwy. 339, Wingo, kY", "Union City", "TN", "38261", "Graves", "36.65549", "-88.76958", "Primary & Secondary"], ["Loc231", "Beachy Brothers Pallet & Lumber Co.", "95 Chestnut Rd.", "Guthrie", "KY", "42234", "Todd", "36.76594", "-87.1645699999999", "Primary & Secondary"], ["Loc232", "Best Made Pallets LLC", "1010 S. Preston Hwy.", "Shepherdsville", "KY", "40165", "Bullitt", "38.05823", "-85.71062", "Primary & Secondary"], ["Loc233", "Blakeman Hardwood Mouldings, Inc.", "972 Old US 68", "Campbellsville", "KY", "42718", "Taylor", "37.3181", "-85.415", "Primary & Secondary"], ["Loc234", "Bluegrass Pallet", "265 Harshfield Lane", "Shepherdsville", "KY", "40165", "Bullitt", "37.97399", "-85.7128699999999", "Primary & Secondary"], ["Loc235", "Bluegrass Shavings", "1291 KY 70 East", "Liberty", "KY", "42539", "Casey", "37.32001", "-84.9459999999999", "Primary & Secondary"], ["Loc236", "Bluegrass Treated Wood Div Carpenter Bro", "3015 Catnip Hill Road", "Nicholasville", "KY", "40356", "Jessamine", "37.9402699999999", "-84.57362", "Primary & Secondary"], ["Loc237", "Bobby Lykens Woodworking", "1729 Rick Road", "Park City", "KY", "42160", "Barren", "37.0037299999999", "-86.0788699999999", "Primary & Secondary"], ["Loc238", "BPM Lumber, LLC", "24 Seeley Road", "London", "KY", "40741", "Laurel", "37.14669", "-84.1535899999999", "Primary & Secondary"], ["Loc239", "Brewer & Reid Lumber, Inc.", "5465 Paradise Rd.", "Central City", "KY", "42330", "Muhlenberg", "37.2374", "-87.1212799999999", "Primary & Secondary"], ["Loc240", "Brown-Forman Cooperage Co., Inc.", "402 Maclean Ave", "Louisville", "KY", "40209", "Jefferson", "38.17544", "-85.7519499999999", "Primary & Secondary"], ["Loc241", "C & J Mulch Company, Inc.", "3100 Nashville Rd.", "Russellville", "KY", "42276", "Logan", "36.7978499999999", "-86.86074", "Primary & Secondary"], ["Loc242", "C. B. Goodman & Sons Lumber", "8574 St. Rt. 131, Kaler, KY", "Hickory", "KY", "42051", "Graves", "36.88224", "-88.55458", "Primary & Secondary"], ["Loc243", "C. J. Thomas & Son, Inc.", "7071 Holly Branch Rd.", "Vanceburg", "KY", "41179", "Lewis", "38.5092599999999", "-83.3600799999999", "Primary & Secondary"], ["Loc244", "Central Pallet Co.", "5745 Paradise Rd.", "Central City", "KY", "42330", "Muhlenberg", "37.2374", "-87.1212799999999", "Primary & Secondary"], ["Loc245", "Certified Pallet", "379 Old 68 Loop", "Auburn", "KY", "42206", "Logan", "36.86885", "-86.69315", "Primary & Secondary"], ["Loc246", "Chaney Lumber Co., Inc.", "4276 S. Laurel Rd.", "London", "KY", "40743-0909", "Laurel", "37.04853", "-84.0519199999999", "Primary & Secondary"], ["Loc247", "Cowboy Charcoal", "Hwy. 980, Rt. 1590", "Albany", "KY", "42602", "Clinton", "36.75817", "-85.1948699999999", "Primary & Secondary"], ["Loc248", "Cox Interior, Inc.", "1751 Old Columbia Road", "Campbellsville", "KY", "42718", "Taylor", "37.3203299999999", "-85.3581499999999", "Primary & Secondary"], ["Loc249", "Cox Shavings, Inc.", "1001 New Columbia Rd.", "Campbellsville", "KY", "42718", "Taylor", "37.3204599999999", "-85.3631599999999", "Primary & Secondary"], ["Loc250", "Cox Waste-to-Energy", "1001 New Columbia Rd.", "Campbellsville", "KY", "42718", "Taylor", "37.3207999999999", "-85.3610999999999", "Primary & Secondary"], ["Loc251", "CTI", "1560 Milam Clark Rd.", "Summer Shade", "KY", "42166", "Metcalfe", "36.8951599999999", "-85.7385699999999", "Primary & Secondary"], ["Loc252", "Cummins Lumber Mill", "KY By-Pass 461", "Mt. Vernon", "KY", "40456", "Rockcastle", "37.3525899999999", "-84.37057", "Primary & Secondary"], ["Loc253", "Daniel Boone Pallet LLC", "32 North Fleming Co.", "Morehead", "KY", "40351", "Rowan", "38.27416", "-83.5324099999999", "Primary & Secondary"], ["Loc254", "Dave's Woodworks", "535 Robert Taylor Lane", "New Haven", "KY", "40051", "Nelson", "37.73436", "-85.5143199999999", "Primary & Secondary"], ["Loc255", "Diamond Forest Resources", "150  Acorn Industrial Rd., Morehead", "Morehead", "KY", "40351", "Rowan", "38.1473999999999", "-83.51833", "Primary & Secondary"], ["Loc256", "Dickerson Lumber Co.", "11820 Burkesville Rd., Summer Shade", "Glasgow", "KY", "42141", "Barren", "36.89987", "-85.7474399999999", "Primary & Secondary"], ["Loc257", "DJINN Wood Products, LLC", "780 Trammel Rd.", "Bagdad", "KY", "40003", "Shelby", "38.2552499999999", "-85.11377", "Primary & Secondary"], ["Loc258", "East Anderson Hardwoods, LLC", "16105 S. Hwy. 27", "Eubank", "KY", "42567", "Pulaski", "37.3019099999999", "-84.6518599999999", "Primary & Secondary"], ["Loc259", "East Anderson Hardwoods, LLC", "16105 S. Hwy. 27", "Eubank", "KY", "42567", "Lincoln", "37.3019099999999", "-84.6518599999999", "Primary & Secondary"], ["Loc260", "East Laurel Furniture", "9241 E. Laurel Road", "London", "KY", "40741", "Laurel", "37.08493", "-83.9027099999999", "Primary & Secondary"], ["Loc261", "Easter Seals West Kentucky", "2229 Mildred St.", "Paducah", "KY", "42001", "McCracken", "37.09259", "-88.63222", "Primary & Secondary"], ["Loc262", "EB Cooperage", "1512 Hwy 3434", "East Bernstadt", "KY", "40729", "Laurel", "37.18854", "-84.10799", "Primary & Secondary"], ["Loc263", "Escue Wood Preserving, Inc.", "164 Post Millwood Rd.", "Millwood", "KY", "42762", "Grayson", "37.4511299999999", "-86.3943299999999", "Primary & Secondary"], ["Loc264", "Estill Wood Products, Inc.", "130 Cow Creek Rd.", "Ravenna", "KY", "40474", "Estill", "37.69932", "-83.9696799999999", "Primary & Secondary"], ["Loc265", "Eversole Mill & Lumber", "682 Marshalls Bottom Rd.", "Lockport", "KY", "40036", "Henry", "38.49965", "-85.0166499999999", "Primary & Secondary"], ["Loc266", "Fannin Industries, Inc.", "5835 Flemingsburg Rd.", "Morehead", "KY", "40351", "Rowan", "38.22157", "-83.48698", "Primary & Secondary"], ["Loc267", "Feldman Lumber Co., Inc.", "228 Buckeye Rd.", "Lancaster", "KY", "40444", "Garrard", "37.6263099999999", "-84.57049", "Primary & Secondary"], ["Loc268", "Felix Taylor Services", "953 Langdon Branch Rd.", "Annville", "KY", "40402", "Jackson", "37.27409", "-83.90421", "Primary & Secondary"], ["Loc269", "Ferrell Browders Pallet Service", "4693 Melton Ave.", "Louisville", "KY", "40214", "Jefferson", "38.13152", "-85.7524099999999", "Primary & Secondary"], ["Loc270", "Fordsville Forest Products", "214 Easton Rd.", "Fordsville", "KY", "42343", "Ohio", "37.64878", "-86.72535", "Primary & Secondary"], ["Loc271", "Forest Products, Inc.", "940 S. Ky 233, Gray, KY 40734", "Corbin", "KY", "40702", "Knox", "36.93428", "-83.9979799999999", "Primary & Secondary"], ["Loc272", "Gary Humphress & Sons, Inc.", "6446 Knifley Rd., Elkhorn", "Campbellsville", "KY", "42718", "Taylor", "37.26908", "-85.2170899999999", "Primary & Secondary"], ["Loc273", "Gingerich Lumber", "13234 Cub Run Hwy.", "Cub Run", "KY", "42729", "Hart", "37.30957", "-86.06707", "Primary & Secondary"], ["Loc274", "Goodrum Pallet", "505 W Madison", "Franklin", "KY", "42134", "Simpson", "36.7216299999999", "-86.58396", "Primary & Secondary"], ["Loc275", "Graber Pallet LLC", "2310 Old Railroad Lane", "Guthrie", "KY", "42234", "Todd", "36.74848", "-87.1624099999999", "Primary & Secondary"], ["Loc276", "Graf Brothers Flooring & Lumber, Inc.", "679 Johnson Lane", "South Shore", "KY", "41175", "Greenup", "38.73409", "-82.9132599999999", "Primary & Secondary"], ["Loc277", "Graham Pallet Co., Inc.", "3234 Celina Road", "Tompkinsville", "KY", "42167", "Monroe", "36.66772", "-85.65729", "Primary & Secondary"], ["Loc278", "Graves Lumber Yard", "1446 Delaplain Rd.", "Georgetown", "KY", "40324", "Scott", "38.26926", "-84.50338", "Primary & Secondary"], ["Loc279", "Green River Post LLC", "11029 Hwy. 132 E.", "Sebree", "KY", "42455", "Webster", "37.60038", "-87.5501299999999", "Primary & Secondary"], ["Loc280", "Harold White Lumber Co., Inc.", "3120 Flemingsburg Rd.", "Morehead", "KY", "40351", "Rowan", "38.2081273", "-83.4771637", "Primary & Secondary"], ["Loc281", "Harvest Garden Pro", "2764 Old Lexington Rd.", "Cave City", "KY", "42127", "Barren", "37.13644", "-85.9044999999999", "Primary & Secondary"], ["Loc282", "Heirloom Lumber Co.", "599 Calloway White Rd.", "Winchester", "KY", "40391", "Clark", "37.9654499999999", "-84.29756", "Primary & Secondary"], ["Loc283", "Hilltop Lumber", "6024 Macon-Kessinger Rd.", "Cub Run", "KY", "42729", "Hart", "37.3407399999999", "-86.0354899999999", "Primary & Secondary"], ["Loc284", "Homer Gregory Co. Inc.", "620 KY Hwy 519", "Morehead", "KY", "40351", "Rowan", "38.1651799999999", "-83.4310499999999", "Primary & Secondary"], ["Loc285", "Hughes Quality Furniture", "1408 Speck Ridge Road", "Elk Horn", "KY", "42733", "Taylor", "37.3168099999999", "-85.2340599999999", "Primary & Secondary"], ["Loc286", "Interstate Hardwoods", "3645 N. Dixie Hwy.", "Munfordville", "KY", "42765", "Hart", "37.3208399999999", "-85.90876", "Primary & Secondary"], ["Loc287", "James Ritter Lumber Co., Inc.", "4949 Summer Shade Rd.", "Summer Shade", "KY", "42166", "Metcalfe", "36.8757999999999", "-85.66048", "Primary & Secondary"], ["Loc288", "Johnson Brothers, Inc.", "5498 Wallingford Rd.", "Flemingsburg", "KY", "41041", "Fleming", "38.40675", "-83.6432899999999", "Primary & Secondary"], ["Loc289", "Keith's Pallet Mill", "1075 Estesburg Rd.", "Eubank", "KY", "42567", "Pulaski", "37.2469699999999", "-84.60899", "Primary & Secondary"], ["Loc290", "Kelvin Cooperage", "1103 Outer Loop", "Louisville", "KY", "40219", "Jefferson", "38.1281499999999", "-85.7442599999999", "Primary & Secondary"], ["Loc291", "Kentucky Cooperage, Inc.", "712 East Main Street", "Lebanon", "KY", "40033", "Marion", "37.57576", "-85.23174", "Primary & Secondary"], ["Loc292", "Kentucky Flooring Company, LLC", "5555 Rockwell Rd.", "Winchester", "KY", "40391", "Clark", "38.0247299999999", "-84.2355299999999", "Primary & Secondary"], ["Loc293", "Kentucky Forest Products, Inc.", "4859 N US Hwy 25", "East Bernstadt", "KY", "40729", "Laurel", "37.19395", "-84.1558399999999", "Primary & Secondary"], ["Loc294", "Kentucky Tie & Lumber Co.", "423 Sawmill Road", "Columbia", "KY", "42728", "Adair", "37.08402", "-85.2635599999999", "Primary & Secondary"], ["Loc295", "Kerr Forest Lumber Products, Inc.", "351 Scottys Way", "Bowling Green", "KY", "42102-6691", "Warren", "37.0281499999999", "-86.3376499999999", "Primary & Secondary"], ["Loc296", "Kingsford Manufacturing Co.", "5126 Summer Shade Rd.", "Summer Shade", "KY", "42166", "Metcalfe", "36.8771399999999", "-85.6586999999999", "Primary & Secondary"], ["Loc297", "Kingsford Manufacturing Co.", "9500 S. Hwy 27", "Burnside", "KY", "42519", "Pulaski", "36.94988", "-84.5761499999999", "Primary & Secondary"], ["Loc298", "Koppers, Inc.", "198 Fairgrounds Road", "Guthrie", "KY", "42234", "Todd", "36.6422499999999", "-87.1383699999999", "Primary & Secondary"], ["Loc299", "Lake Cumberland Farm Bedding, Inc.", "83 Snow Rd., Russel Springs", "Jamestown", "KY", "42629", "Russell", "37.04307", "-85.0999099999999", "Primary & Secondary"], ["Loc300", "Lake Cumberland Woodworks, Inc.", "Highway 90 Box 3101", "Bronston", "KY", "42518", "Pulaski", "36.7857199999999", "-84.6383199999999", "Primary & Secondary"], ["Loc301", "Larkins Pallet", "847 Hospital Rd", "Dawson Springs", "KY", "42408", "Christian", "37.0501399999999", "-87.54165", "Primary & Secondary"], ["Loc302", "Lashbrook Lumber Co., Inc.", "6245 US Hwy 231", "Utica", "KY", "42376", "Daviess", "37.6980999999999", "-87.06036", "Primary & Secondary"], ["Loc303", "Lawson Pallet & Skids, Inc.", "St. Rt. 1010", "Ezel", "KY", "41425", "Morgan", "37.8622", "-83.45377", "Primary & Secondary"], ["Loc304", "Lebanon Oak Flooring Co., LLC.", "215 Taylor Avenue", "Lebanon", "KY", "40033-0669", "Marion", "37.5751899999999", "-85.24454", "Primary & Secondary"], ["Loc305", "Liberty Hardware Co., Inc.", "930 Riffe Creek Rd.", "Dunnville", "KY", "42528", "Casey", "37.2126299999999", "-85.0150699999999", "Primary & Secondary"], ["Loc306", "Little River Dry Kiln", "141 Cerulean Rd.", "Cadiz", "KY", "42211", "Trigg", "36.8770099999999", "-87.83257", "Primary & Secondary"], ["Loc307", "LPH Manufacturing Co., Inc.", "9049 Edmonton Road", "Summer Shade", "KY", "42166", "Monroe", "36.8277199999999", "-85.6854", "Primary & Secondary"], ["Loc308", "Lumpkins Lumber & Post", "Hobbs Rd., off Hwy. 15", "Campton", "KY", "41301", "Wolfe", "37.7689499999999", "-83.6029699999999", "Primary & Secondary"], ["Loc309", "McCammish Manufacturing Co.", "132 Industrial Park Drive", "Columbia", "KY", "42728-0408", "Adair", "37.08514", "-85.29581", "Primary & Secondary"], ["Loc310", "McInturf Sawmill & Kiln", "1136 Ballard Rd.", "Lawrenceburg", "KY", "40342", "Anderson", "37.9128699999999", "-85.03802", "Primary & Secondary"], ["Loc311", "Middleground Golf & Bat Co. LLC", "2814 Lilac Road", "Leitchfield", "KY", "42755", "Grayson", "37.51764", "-86.32863", "Primary & Secondary"], ["Loc312", "Monroe Pallet Co.", "4370 Hwy 70 W.", "Eubank", "KY", "42567", "Lincoln", "37.25202", "-84.70689", "Primary & Secondary"], ["Loc313", "Monticello Flooring & Lumber Co., Inc.", "366 Hardwood Dr.", "Monticello", "KY", "42633", "Wayne", "36.85434", "-84.83884", "Primary & Secondary"], ["Loc314", "Moulding & Millwork Inc., Mfg.", "7755 Main Street", "Jeffersonville", "KY", "40337", "Montgomery", "37.9767099999999", "-83.85258", "Primary & Secondary"], ["Loc315", "Mr. Mulch", " ", "Hopkinsville", "KY", "42241", "Christian", "36.89893", "-87.4814099999999", "Primary & Secondary"], ["Loc316", "Mullins Pallet & Lumber", "6318 South State Hwy 1--Grayson, KY", "Hitchins", "KY", "41146", "Carter", "38.2424299999999", "-82.9124599999999", "Primary & Secondary"], ["Loc317", "Nelson Company of Kentucky", "630 North 3rd Street", "Lewisburg", "KY", "42256", "Logan", "36.99148", "-86.9504199999999", "Primary & Secondary"], ["Loc318", "New World Flooring, Inc.", "368 East Hwy 90", "Albany", "KY", "42602", "Clinton", "36.7546299999999", "-85.1370699999999", "Primary & Secondary"], ["Loc319", "NewPage Corp.", "1724 Fort Jefferson Hill Rd.", "Wickliffe", "KY", "42087", "Ballard", "36.9506599999999", "-88.06626", "Primary & Secondary"], ["Loc320", "Northern Kentucky Cedar", "7301 Mt. Gilead Rd.", "Maysville", "KY", "41056", "Mason", "38.5108099999999", "-83.70667", "Primary & Secondary"], ["Loc321", "Northland Corp.", "2600 E. Hwy 146", "LaGrange", "KY", "40031", "Oldham", "38.41783", "-85.3493299999999", "Primary & Secondary"], ["Loc322", "Odom Pallet Co.", "5116 Spurrier Rd.", "Big Clifty", "KY", "42712", "Grayson", "37.50784", "-86.0922599999999", "Primary & Secondary"], ["Loc323", "OFS Brands", "1010 Salt River Rd.", "Leitchfield", "KY", "42754", "Grayson", "37.49033", "-86.2801999999999", "Primary & Secondary"], ["Loc324", "Ohio River Pallet", "7377 SR 91 N.", "Marion", "KY", "42064", "Crittenden", "37.4275999999999", "-88.1244499999999", "Primary & Secondary"], ["Loc325", "Ohio River Shippers, Inc.", "14036 St. Rt. 1, Greenup", "Argillite", "KY", "41121", "Greenup", "38.4374299999999", "-82.9001399999999", "Primary & Secondary"], ["Loc326", "Olympia Lumber and Post", "539 Sour Springs Rd.", "Olympia", "KY", "40358", "Bath", "38.08935", "-83.69915", "Primary & Secondary"], ["Loc327", "Opportunity Center Workshop", "731 Jackson Street", "Owensboro", "KY", "42302", "Daviess", "37.7694199999999", "-87.09622", "Primary & Secondary"], ["Loc328", "P.J. Murphy Forest Products Corp.", "840 Woodford Avenue", "Monticello", "KY", "42633", "Wayne", "37.00132", "-86.45694", "Primary & Secondary"], ["Loc329", "Paradise Pallet, Inc.", "5745 Paradise Road", "Central City", "KY", "42330", "Muhlenberg", "37.2374", "-87.1212799999999", "Primary & Secondary"], ["Loc330", "Penchem Pallets", "8080 Guthrie Road", "Guthrie", "KY", "42234", "Todd", "36.7002499999999", "-87.19719", "Primary & Secondary"], ["Loc331", "Pendleton Custom Sawing", "2928 Hwy 330 W.", "Falmouth", "KY", "41040", "Pendleton", "38.6523499999999", "-84.38142", "Primary & Secondary"], ["Loc332", "Pennyrile Pallet Co.", "13860 Castleb.-Crofton Rd.", "Crofton", "KY", "42217", "Christian", "37.0606999999999", "-87.50565", "Primary & Secondary"], ["Loc333", "Peters, Aaron", "1201 Whalen Rd.", "Bowling Green", "KY", "42101", "Warren", "37.12998", "-86.5387599999999", "Primary & Secondary"], ["Loc334", "Planinview Pallet", "3404 Chandlers Road", "Auburn", "KY", "42206", "Logan", "36.90173", "-86.74603", "Primary & Secondary"], ["Loc335", "Quality Pallet Co., LLC", "2195 Gabe Rd.", "Greensburg", "KY", "42743", "Green", "37.31307", "-85.5647699999999", "Primary & Secondary"], ["Loc336", "R & S Pallets, Inc.", "AA Hwy at Tollesboro", "Tollesboro", "KY", "41189", "Lewis", "38.5555299999999", "-83.59076", "Primary & Secondary"], ["Loc337", "Red River Hardwoods, Inc.", "588 Lofty Heights Road", "Clay City", "KY", "40312", "Powell", "37.87445", "-83.94773", "Primary & Secondary"], ["Loc338", "Red River Ranch LLC", "1499 Maple St.", "Stanton", "KY", "40380", "Powell", "37.8595499999999", "-83.37581", "Primary & Secondary"], ["Loc339", "River Valley Mulch", "7769 Morehead Rd.", "Flemingsburg", "KY", "41041", "Fleming", "38.2535999999999", "-83.5236199999999", "Primary & Secondary"], ["Loc340", "Robinson Stave Co., Inc.", "1812 Highway 3434", "East Bernstadt", "KY", "40729", "Laurel", "37.18771", "-84.10791", "Primary & Secondary"], ["Loc341", "Roy Anderson Lumber Co., Inc", "366 Legion Lane", "Tompkinsville", "KY", "42167", "Monroe", "36.71764", "-85.6932099999999", "Primary & Secondary"], ["Loc342", "Roy Anderson Lumber Co., Inc.", "1115 Columbia Ave.", "Tompkinsville", "KY", "42167", "Monroe", "36.71764", "-85.6932099999999", "Primary & Secondary"], ["Loc343", "Sandusky Pallet, Inc.", "3013 W. Hwy. 80", "Russell Springs", "KY", "42642", "Russell", "37.0727499999999", "-85.11865", "Primary & Secondary"], ["Loc344", "Sawmill From Hale", "7288 Canton Rd.", "Cadiz", "KY", "42211", "Trigg", "36.8038799999999", "-87.9347999999999", "Primary & Secondary"], ["Loc345", "Sawyer & Sons", "186 London Dr.", "Bowling Green", "KY", "42101", "Warren", "36.8931699999999", "-86.50839", "Primary & Secondary"], ["Loc346", "Simply Mulch", "1900 Veterans Memorial Ln.", "Bowling Green", "KY", "42101", "Warren", "36.9947299999999", "-86.48716", "Primary & Secondary"], ["Loc347", "Somerset Wood Products, Inc.", "70 W. Racetrack Rd.", "Somerset", "KY", "42501", "Pulaski", "36.98843", "-84.5949399999999", "Primary & Secondary"], ["Loc348", "Southland Manufacturing, Inc.", "210 Tobacca Rd.", "Bowling Green", "KY", "42102", "Warren", "37.0079399999999", "-86.4249999999999", "Primary & Secondary"], ["Loc349", "Specialized Wood, Inc.", "9912 KY 303, Mayfield, KY 42066", "Murray", "KY", "42071", "Graves", "36.58545", "-88.63384", "Primary & Secondary"], ["Loc350", "Stella-Jones Corp.", "3855 Hwy. 51", "Fulton", "KY", "42041", "Hickman", "36.61227", "-88.9483599999999", "Primary & Secondary"], ["Loc351", "Superior Lumber LLC", "65 Deer Haven Dr.", "Leitchfield", "KY", "42754", "Grayson", "37.4562099999999", "-86.3084199999999", "Primary & Secondary"], ["Loc352", "T. W. Lumber Co. LLC", "1410 Long Ford Bridge Rd.", "Cadiz", "KY", "42211", "Trigg", "36.8031999999999", "-87.7356999999999", "Primary & Secondary"], ["Loc353", "Tamarlane Industries, Inc.", "846 S. Main Street", "Beaver Dam", "KY", "42320", "Ohio", "37.39021", "-86.8691299999999", "Primary & Secondary"], ["Loc354", "Taylor Crafted Woodworks", "1320 Stump Bluff Rd.", "Bowling Green", "KY", "42101", "Warren", "37.09109", "-86.55782", "Primary & Secondary"], ["Loc355", "The Freeman Corporation", "415 Magnolia St.", "Winchester", "KY", "40391", "Clark", "38.0078999999999", "-84.1839999999999", "Primary & Secondary"], ["Loc356", "The Nick Shelton Co., Inc.", "518 E. Old State Rd.", "Scottsville", "KY", "42164", "Allen", "36.7749999999999", "-86.24326", "Primary & Secondary"], ["Loc357", "The Woodworks", "340 New Porter Pike", "Bowling Green", "KY", "42103", "Warren", "37.00269", "-86.38411", "Primary & Secondary"], ["Loc358", "Thoroughbred Hardwoods", "120 Joe Hamilton Rd.", "Summer Shade", "KY", "42166", "Metcalfe", "36.8844199999999", "-85.70247", "Primary & Secondary"], ["Loc359", "Todd County Pallet LLC", "470 Old Railroad Lane", "Elkton", "KY", "42220", "Todd", "36.77505", "-87.15475", "Primary & Secondary"], ["Loc360", "Tom's Pallet Recycling", "1660 Jericho Rd.", "Hodgenville", "KY", "42708", "Larue", "37.5157", "-85.64462", "Primary & Secondary"], ["Loc361", "Ulrich Cabinets and Woodworking, Inc.", "99 Ulrich Lane", "East Bernstadt", "KY", "40729", "Laurel", "37.1991299999999", "-84.0853299999999", "Primary & Secondary"], ["Loc362", "Vittitow Cabinets, Inc.", "11145 New Haven Road", "New Haven", "KY", "40051", "Nelson", "37.68444", "-85.56776", "Primary & Secondary"], ["Loc363", "W. M. Cramer Lumber & Kiln Drying, Inc.", "384 Kefauver", "Millwood", "KY", "42762", "Grayson", "37.45394", "-86.38853", "Primary & Secondary"], ["Loc364", "Wayne Dry Kilns, Inc.", "193 Wayne Lumber Drive", "Monticello", "KY", "42633", "Wayne", "36.77993", "-84.9502999999999", "Primary & Secondary"], ["Loc365", "Weaver Precuts", "260  Robert Stinson Rd.", "Cub Run", "KY", "42729", "Hart", "37.29952", "-86.09094", "Primary & Secondary"], ["Loc366", "Westport Custom Cabinets", "7207 W. Hwy 146", "Westport", "KY", "40077", "Oldham", "38.4799", "-85.4646099999999", "Primary & Secondary"], ["Loc367", "White Manufacturing", "609 Main Street", "Salt Lick", "KY", "40371", "Bath", "38.11489", "-83.6195799999999", "Primary & Secondary"], ["Loc368", "Willumwood", "695 Rocky Hill Rd.", "Munfordville", "KY", "42765", "Hart", "37.3456899999999", "-85.95028", "Primary & Secondary"], ["Loc369", "Wolford & Wethington Co., Inc.", "1805 Casey Creek Rd.", "Liberty", "KY", "42539", "Casey", "37.12928", "-85.0124699999999", "Primary & Secondary"], ["Loc370", "Wolford & Wethington Lbr. No.2", "Hwy. 127", "Hustonville", "KY", "40437", "Casey", "37.40294", "-84.86108", "Primary & Secondary"], ["Loc371", "Woodcraft Industries, Inc.", "434 Scotty's Way", "Bowling Green", "KY", "42103", "Warren", "37.0307699999999", "-86.3384199999999", "Primary & Secondary"], ["Loc372", "Woodstock Pallet Co., Inc.", "1025 Liberty Road", "Eubank", "KY", "42567-0429", "Pulaski", "37.3068", "-84.5272999999999", "Primary & Secondary"], ["Loc373", "Wooten Pallet Co.", "1368 Hemlock St.", "Louisville", "KY", "40256-0638", "Jefferson", "38.2348", "-85.80338", "Primary & Secondary"], ["Loc374", "Wroe Pallet & Skids", "287 Nugent Lane", "Hawesville", "KY", "42348", "Hancock", "37.9071399999999", "-86.76397", "Primary & Secondary"], ["Loc375", "Young Manufacturing Co., Inc.", "521 South Main", "Beaver Dam", "KY", "42320", "Ohio", "37.3947399999999", "-86.8766099999999", "Primary & Secondary"], ["Loc376", "ZAK, Ltd.", "9372 Bardstown Rd.", "Hodgenville", "KY", "42748", "Larue", "37.63139", "-85.60831", "Primary & Secondary"], ["Loc377", "Zeager Hardwood Co.", "340 Steele Road", "Franklin", "KY", "42134", "Simpson", "36.66006", "-86.5720699999999", "Primary & Secondary"]];
});
app.factory('UnitConvert', function () {
	return {
		toRad: function (x) {
			return x * Math.PI / 180;
		},
		toDeg: function (x) {
			return x * 180 / Math.PI;
		},
		intToHex: function (i) {
			var hex = parseInt(i).toString(16);
			return hex.length < 2 ? "0" + hex : hex;
		},
		miToKm: function (mi) {
			return mi * 1.609344;
		}
	};
});
app.directive('costCalculations', ['Cost', function (Cost) {
	return {
		restrict: 'E',
		templateUrl: 'js/common/directives/costCalculations/costCalculations.html'
	};
}]);
app.directive('costsSection', ['Cost', function (Cost) {
	return {
		restrict: 'E',
		templateUrl: 'js/common/directives/costsSection/costsSection.html',
		link: function (scope, element, attrs) {

			scope.cost = {
				isUserDefined: true
			};

			scope.rate = {};
			scope.setUserDefined = function () {
				Cost.setTotal(scope.rate.userDefined);
			};

			// default input values
			scope.input = {
				purchasePrice: 100000,
				hpRating: 470,
				machineLife: 10,
				salvagePercent: 25,
				utilizationRate: 60,
				repairMaintPercent: 50,
				interestRate: 8,
				insuranceTaxRate: 5,
				fuelConsumptionRate: 0.002,
				fuelCost: 2,
				lubeOilPercent: 25,
				operatorWage: 25,
				scheduledMachineHrs: 2000
			};

			scope.calculate = function () {
				// CALCULATIONS SECTION
				scope.salvageValue = +scope.input.purchasePrice * +scope.input.salvagePercent / 100;
				scope.annualDepreciation = (+scope.input.purchasePrice - scope.salvageValue) / +scope.input.machineLife;
				scope.avgYearInvestment = (+scope.input.purchasePrice - scope.salvageValue) * (+scope.input.machineLife + 1) / (2 * +scope.input.machineLife) + scope.salvageValue;
				scope.productiveMachineHrs = +scope.input.scheduledMachineHrs * +scope.input.utilizationRate / 100;

				// OWNERSHIP COSTS
				scope.interestCost = +scope.input.interestRate / 100 * scope.avgYearInvestment;
				scope.insuranceTaxCost = +scope.input.insuranceTaxRate / 100 * scope.avgYearInvestment;
				scope.yearOwnerCost = scope.annualDepreciation + scope.interestCost + scope.insuranceTaxCost;
				scope.ownershipCostSMH = scope.yearOwnerCost / +scope.input.scheduledMachineHrs;
				scope.ownershipCostPMH = scope.yearOwnerCost / scope.productiveMachineHrs;

				// OPERATING COSTS
				scope.fuelCost = +scope.input.hpRating * +scope.input.fuelConsumptionRate * +scope.input.fuelCost;
				scope.lubeCost = scope.fuelCost * +scope.input.lubeOilPercent / 100;
				scope.repairMaintenanceCost = scope.annualDepreciation * (+scope.input.repairMaintPercent / 100) / scope.productiveMachineHrs;
				scope.laborBenefitCost = +scope.input.operatorWage / (+scope.input.utilizationRate / 100);
				scope.operatingCostPMH = scope.fuelCost + scope.lubeCost + scope.repairMaintenanceCost + scope.laborBenefitCost;
				scope.operatingCostSMH = scope.operatingCostPMH * +scope.input.utilizationRate / 100;

				// TOTAL MACHINE COSTS
				scope.totalCostSMH = scope.ownershipCostSMH + scope.operatingCostSMH;
				scope.totalCostPMH = scope.ownershipCostPMH + scope.operatingCostPMH;

				Cost.setTotal(scope.totalCostPMH);
			};
		}

	};
}]);
app.directive('mapOptions', ['$state', function ($state) {
	return {
		restrict: 'E',
		templateUrl: 'js/common/directives/mapOptions/mapOptions.html',
		link: function (scope, element, attrs) {
			/*** Heatmap Panel ***/
			scope.setHeatmapType = function (type) {
				scope.$root.$emit('setHeatmapType', type);
			};
			// When page loads, markers are not shown
			scope.checkbox = {
				value1: false
			};
			scope.toggleMarkers = function () {
				scope.$root.$emit('toggleHeatmapMarkers');
			};

			/*** Route Finder Panel ***/
			scope.calcOptimalRoute = function () {
				scope.$root.$emit('calcOptimalRoute');
				scope.showOptRouteDirections = true;
			};

			scope.clearOptimalRouteMap = function () {
				scope.$root.$emit('clearOptimalRouteMap');
				scope.showOptRouteDirections = false;
			};

			scope.revOptimalDirections = function () {
				scope.$root.$emit('reverseOptimalDirections');
			};

			/*** Route Selector Panel ***/
			scope.calcSelectedRoute = function () {
				scope.$root.$emit('calcSelectedRoute');
				scope.showSelRouteDirections = true;
			};

			scope.clearSelectedRouteMap = function () {
				scope.$root.$emit('clearSelectedRouteMap');
				scope.showSelRouteDirections = false;
			};

			scope.revSelectedDirections = function () {
				scope.$root.$emit('reverseSelectedDirections');
			};

			/*** On page load ***/
			scope.showOptRouteDirections = false;
			scope.showSelRouteDirections = false;

			// check current state to determine what accordion panel to open
			if ($state.current.name === 'heatmap') {
				scope.isHeatmapOpen = true;
			} else if ($state.current.name === 'routeFinder') {
				scope.isRouteFinderOpen = true;
			} else {
				scope.isRouteSelectorOpen = true;
			}
		}
	};
}]);
app.directive('sidePanel', function () {
	return {
		restrict: 'E',
		templateUrl: 'js/common/directives/sidePanel/sidePanel.html',
		link: function (scope, element, attrs) {
			scope.enableCost = false;
		}
	};
});
app.directive('pageHeader', function () {
	return {
		restrict: 'E',
		templateUrl: 'js/common/directives/pageHeader/pageHeader.html'
	};
});
