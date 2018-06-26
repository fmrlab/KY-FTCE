/*
* Code adapted from: http://stackoverflow.com/questions/24246403/angularjs-load-google-map-script-async-in-directive-for-multiple-maps?rq=1
*/
app.factory('GoogleMaps', ['$window', '$q', function ($window, $q) {

	function loadScript() {
		var gMapKey = 'AIzaSyCN9k-zbh2NrAynay5Tgz0400K1JsJpiJ4';
		var script = document.createElement('script');
		script.src = 'https://maps.googleapis.com/maps/api/js?key=' + gMapKey + '&callback=apiLoaded'
		document.body.appendChild(script);
	}

	var deferred = $q.defer();
	//Callback function - resolving promise after api has successfully loaded
	$window.apiLoaded = deferred.resolve;
	if ($window.attachEvent) {
	  $window.attachEvent('onload', loadScript)
	} else {
	  $window.addEventListener('load', loadScript, false)
	}


	var GoogleMaps = {
		loadAPI: deferred.promise
	};

	return GoogleMaps;

}]);
