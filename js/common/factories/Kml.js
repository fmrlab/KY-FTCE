app.factory('Kml', function () {
	var KML = {
		addKYBoundaryLayer: function (map) {
			// Add Kentucky state KML layer
			var folderId = '0B1Q3VQq55ISGU3hUS1hFMkFQNG8';
			var kyKML = new google.maps.KmlLayer({
				url: 'https://www.googledrive.com/host/' + folderId + '/ky_state_boundary.zip', 
				clickable: false, 
				suppressInfoWindows: true, 
				preserveViewport: true,
				map: map
			});
		}
	};

	return KML;	
});