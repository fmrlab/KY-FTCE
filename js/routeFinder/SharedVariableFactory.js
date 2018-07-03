app.factory('SharedVariableFactory', function () {
	var gZoom = 7;
	var gCenterPoint = {lat: 37.791322359780914, lng: -85.01533446044925};
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
			gCenterPoint = {lat: latitude, lng: longitude};
		}
	};
	
});