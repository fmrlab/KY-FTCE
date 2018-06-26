app.factory('Location', ['UnitConvert', 'MarkerFactory', 'Cost', function (UnitConvert, MarkerFactory, Cost) {
	
	/**
	* Sort by last element in array
	*/
	var _sortByLastElement = function (a,b) {
		if (a[a.length - 1] > b[b.length - 1]) {
		  return 1;
		}
		if (a[a.length - 1] < b[b.length - 1]) {
		  return -1;
		}
		// a must be equal to b
		return 0;
	};

	var gCalcDuration = function (origin, destinations){
		var request = {
		    origins: origin,
		    destinations: destinations,
		    travelMode: google.maps.TravelMode.DRIVING
		};

		return new Promise(function (resolve, reject) {
			var service = new google.maps.DistanceMatrixService();
			service.getDistanceMatrix(request, function(response, status) {
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
			gDirectionsService.route(request, function(response, status) {
				if (status === google.maps.DistanceMatrixStatus.OK) {
					resolve(response);
				} else {
					reject(status);
				}
			});
		});		
	};


	var displayRouteInfoWindow = function(directionsRenderer, map) {
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

		    for(var i=0; i < destinationList.length; i++) {
		        var mlat = destinationList[i][7]; // get possible destination latitude
		        var mlng = destinationList[i][8]; // get possible destination longitude
		        var dLat  = UnitConvert.toRad(mlat - lat);
		        var dLong = UnitConvert.toRad(mlng - lng);
				
				// calculate distance between 2 points using haversine formula
		        var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
		            Math.cos(UnitConvert.toRad(lat)) * Math.cos(UnitConvert.toRad(lat)) * Math.sin(dLong/2) * Math.sin(dLong/2);
		        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
		        var d = R * c;
		        
		        destinationList[i].push(d); //Push distance into destinationList array
		    }

		    // Sort from closest to farthest destination
		    destinationList.sort(_sortByLastElement);
		    
		    // Return closest routes
			return destinationList.splice(0, numOfDestinations);
		},
		calcShortestTravel: function (origin, destinations) {

			var destCoordinates = [], durations = [];

			for (var i = 0; i < destinations.length; i++){
				destCoordinates[i] = new google.maps.LatLng(destinations[i][7], destinations[i][8]);
			}

			//Calculate driving time from origin to a list of destinations
			return gCalcDuration([origin], destCoordinates)
					.then(function(response){
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

			if(boundsObj){
				// display access point marker
				MarkerFactory.displayAccessPoint(directionsRenderer, map);
				// Add destination marker to bounds object
				boundsObj.extend(directionsRenderer.directions.routes[0].legs[0].end_location);
				// zoom to include all points in bounds object
				map.fitBounds(boundsObj);

				// Since the fitBounds function zooms in too much, we zoom out a little
				var zoomChangeBoundsListener = google.maps.event.addListenerOnce(map, 'bounds_changed', function(event) {
					var currentZoom = this.getZoom();
			        if (currentZoom){
			            this.setZoom(currentZoom - 1);
			        }
				});
				setTimeout(function(){google.maps.event.removeListener(zoomChangeBoundsListener)}, 2000);	
			}

			return directionsRenderer;
		},
		updateText: function (directionsRenderer) {
			// get trip distance
			var tripDistance = directionsRenderer.directions.routes[0].legs[0].distance.text.toString();
			// get trip duration
			var tripDuration = directionsRenderer.directions.routes[0].legs[0].duration.text.toString();
			var durationHrs = directionsRenderer.directions.routes[0].legs[0].duration.value/3600;

			var tripInfo;
			var costPerHour = Cost.getTotal();

			// create string to be used in route infowindow
			if(costPerHour) {
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
			google.maps.event.addListener(directionsRenderer, 'directions_changed', function(event){
				self.updateText(directionsRenderer);
				
				// open route infowindow
				directionsRenderer.infoWindow.open(map);
			});
		}
	};

	return Location;
}]);