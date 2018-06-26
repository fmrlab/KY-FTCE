app.controller('RouteSelectorCtrl', ['$scope','$rootScope','$state','GoogleMaps','RouteSelectorFactory','MarkerFactory','Kml', function ($scope, $rootScope, $state, GoogleMaps, RouteSelectorFactory, MarkerFactory, Kml) {
	var gMap, markers = [];

	GoogleMaps.loadAPI
	.then(function () {
		initMap();
	});

	function initMap() {
		var mapCenterPoint = new google.maps.LatLng(37.791322359780914, -85.01533446044925);
		gMap = new google.maps.Map(document.getElementById('sel-map'), {
			zoom: 7,
			center: mapCenterPoint,
			mapTypeId: google.maps.MapTypeId.ROADMAP
		});

		Kml.addKYBoundaryLayer(gMap);
		MarkerFactory.displayMarkers(gMap);
		RouteSelectorFactory.showLegend(gMap);

		google.maps.event.addListener(gMap, 'click', function (event) {
			var numOfMarkers = markers.length;
			var labels = "LD";

			if (numOfMarkers < 2) {
				var label = labels[numOfMarkers];
				if (numOfMarkers === 1) {
					if(document.getElementById('sel-calcRoute-button').disabled) {
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
	});
	// Unbind from the selectedRouteListener when scope is destroyed (i.e. when go to another state) to avoid memory leaks
	$scope.$on('$destroy', selectedRouteListener);

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