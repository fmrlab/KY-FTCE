app.controller('RouteFinderCtrl', ['$scope', '$rootScope', '$state', 'GoogleMaps', 'MarkerFactory', 'RouteFinderFactory', 'Kml', 'SharedVariableFactory', function ($scope, $rootScope, $state, GoogleMaps, MarkerFactory, RouteFinderFactory, Kml, SharedVariableFactory){
	var gMap, gUserMarker;
	
	GoogleMaps.loadAPI
	.then(function () {
		initMap();
	});

	function initMap() {

		var zoomLevel = SharedVariableFactory.getZoom();
		var centerPointLatLng = SharedVariableFactory.getMapCenterPoint();
		var mapCenterPoint = new google.maps.LatLng(centerPointLatLng.lat, centerPointLatLng.lng);

		gMap = new google.maps.Map(document.getElementById('opt-map'), {
			zoom: zoomLevel,
			center: mapCenterPoint,
			mapTypeId: google.maps.MapTypeId.ROADMAP
		});

		Kml.addKYBoundaryLayer(gMap);
		MarkerFactory.displayMarkers(gMap);

		RouteFinderFactory.showLegend(gMap);
		google.maps.event.addListener(gMap, 'zoom_changed', function() {
			SharedVariableFactory.setZoom(gMap.getZoom());
		});

		google.maps.event.addListener(gMap, 'center_changed', function() {
			var centerPoint = gMap.getCenter();
			SharedVariableFactory.setMapCenterPoint(centerPoint.lat(), centerPoint.lng());
		});
		

		// add click event to place a marker on the map
		google.maps.event.addListener(gMap, 'click', function (event) {
			gUserMarker = MarkerFactory.placeOnMap(event.latLng, gUserMarker, gMap);
			// enable the "Calculate routes" button
			if (document.getElementById('opt-calcRoute-button').disabled) {
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

	var calcOptimalRouteFromAccessPointListener = $rootScope.$on('accessPointDragend', function(){
		console.log("accessPointDragend");
	});

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
