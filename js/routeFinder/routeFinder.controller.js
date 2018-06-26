app.controller('RouteFinderCtrl', ['$scope','$rootScope','$state','GoogleMaps','MarkerFactory','RouteFinderFactory','Kml', function ($scope, $rootScope, $state, GoogleMaps, MarkerFactory, RouteFinderFactory, Kml) {
	var gMap, gUserMarker;
	
	GoogleMaps.loadAPI
	.then(function () {
		initMap();
	});

	function initMap() {

		var mapCenterPoint = new google.maps.LatLng(37.791322359780914, -85.01533446044925);
		gMap = new google.maps.Map(document.getElementById('opt-map'), {
			zoom: 7,
			center: mapCenterPoint,
			mapTypeId: google.maps.MapTypeId.ROADMAP
		});

		Kml.addKYBoundaryLayer(gMap);
		MarkerFactory.displayMarkers(gMap);

		RouteFinderFactory.showLegend(gMap);
		
		// add click event to place a marker on the map
		google.maps.event.addListener(gMap, 'click', function(event) {
			gUserMarker = MarkerFactory.placeOnMap(event.latLng, gUserMarker, gMap);
			// enable the "Calculate routes" button
			if(document.getElementById('opt-calcRoute-button').disabled) {
				document.getElementById('opt-calcRoute-button').disabled = false;
			}
		});
	}

	// When the calcMillRoute button is clicked, calculate and display route
	var calcOptimalRouteListener = $rootScope.$on('calcOptimalRoute', function () {
		RouteFinderFactory.calcMillRoute(gUserMarker, gMap);
	});
	// Unbind from the calcMillRouteListener when scope is destroyed (i.e. when go to another state) to avoid memory leaks
	$scope.$on('$destroy', calcOptimalRouteListener);

	// When the reverse button is clicked, calculate and display reversed route
	var reverseOptimalRouteListener = $rootScope.$on('reverseOptimalDirections', function () {
		RouteFinderFactory.reverseDirections(gUserMarker, gMap);
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