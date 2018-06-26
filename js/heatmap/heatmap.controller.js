app.controller('HeatmapCtrl', ['$scope','GoogleMaps','MarkerFactory','$rootScope','HeatmapFactory','Kml', function ($scope, GoogleMaps, MarkerFactory, $rootScope, HeatmapFactory, Kml) {
	var gMap;

	GoogleMaps.loadAPI
	.then(function () {
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