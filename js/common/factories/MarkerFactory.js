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
		
		geocoder.geocode({latLng: pos}, function(results, status) {
			if (status == google.maps.GeocoderStatus.OK) {
				if(label === "D") title = "Destination";
				else title = "Logging Site";
				// update the marker's infowindow information with the formatted address
				updateInfoWindow(map, marker, title + "<br>" + results[0].formatted_address.slice(0, results[0].formatted_address.length - 5) + "<br> Lat: " + pos.lat().toFixed(4) + " Lng: " + pos.lng().toFixed(4));
			}
			else { // there was an error decoding the address
				alert('Cannot determine address at this location:' + status);
			}
		});
	};


	var MarkerFactory = {
		displayMarkers: function (map) {
			var millInfoWindow = new google.maps.InfoWindow();
			if(!gMillMarkers.length) {
				//For loop to create a marker with an infowindow for each mill
				for (var i = 0; i < mills.length; i++) {

					var name = mills[i][1], address = mills[i][2], city = mills[i][3], state = mills[i][4],
						zip = mills[i][5], county = mills[i][6], lat = +mills[i][7], lng = +mills[i][8],
						itype = mills[i][9],
					latLngSet = new google.maps.LatLng(lat, lng);

					var millContent = '<div class="map-content">' +
								'Company name: ' + '<b>' + name + '</b>' + '<br />' +
								'Industry type: ' + itype + '<br />' +
								'Address: ' + address + '<br />' +
								'City: ' + city + '<br />' +
								'State: ' + state + '<br />' +
								'Zip code: ' + zip + '<br />' +
								'County: ' + county + '</div>';

					gMillMarkers[i] = new google.maps.Marker({
						map: map,
						title: name,
						position: latLngSet,
						icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
					});

					google.maps.event.addListener(gMillMarkers[i], 'click', (function(marker, content) {
			            return function() {
							millInfoWindow.setContent(content);
			                millInfoWindow.open(map, marker);
			            }
			        })(gMillMarkers[i], millContent));
				}
			} else {
				for (var i = 0; i < gMillMarkers.length; i++) {
					gMillMarkers[i].setMap(map);
				}
			}
		}, 
		toggleMarkers: function (map) {
			if(document.getElementById('checkbox-showLoc').checked){
				this.displayMarkers(map);	
			} else {
				this.clearAllMarkers();
			}
		},
		clearAllMarkers: function () {
			for(var i = 0; i < gMillMarkers.length; i++){
				gMillMarkers[i].setMap(null);
			}
		},
		deleteMarkerArr: function () {
			gMillMarkers.length = 0;
		},
		placeOnMap: function (location, userMarker, map, label) {
			if(!userMarker) { // if there's no user marker on the map, create one
				userMarker = new google.maps.Marker({
					draggable:true,
					position: location,
					map: map,
					label: label
				});
				
				// create an infowindow to display the address of the marker
				userMarker.infoWindow = new google.maps.InfoWindow();
			}
			else { // else, just change the location
				userMarker.setPosition(location);
				userMarker.infoWindow.close();
			}
			
			geocodePosition(userMarker, location, map, label);

			// add drag event to update infowindow information
			google.maps.event.addListener(userMarker, 'dragend', function() {
				userMarker.infoWindow.close();
				geocodePosition(userMarker, userMarker.getPosition(), map, label);
			});
			
			// add click event to open infowindow when marker is clicked
			google.maps.event.addListener(userMarker, 'click', function(event) {
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

			if(Math.abs(end.lat() - start.lat()) > 0.001 || Math.abs(end.lng() - start.lng()) > 0.001) {
				// create an infowindow to display the address of the marker
				var infoWindow = new google.maps.InfoWindow({
					content: '<div style="width: 180px">Access Point<br />Lat: ' + start.lat().toFixed(4) + ' Lng: ' + start.lng().toFixed(4) + '</div>'
				});
				if (gAccessPointMarker == null || typeof gAccessPointMarker == 'undefined'){
					gAccessPointMarker = new google.maps.Marker({
						draggable: true,
						position: start,
						map: map,
						zIndex = Date.now(),
						icon: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
					});
					// add click event to open infowindow when marker is clicked
					google.maps.event.addListener(gAccessPointMarker, 'click', function(event) {
						infoWindow.open(map, gAccessPointMarker);
					});
					google.maps.event.addListener(gAccessPointMarker, 'dragend', function () {
						$rootScope.$emit('accessPointDragend');
					});
				}else{
					gAccessPointMarker.setPosition(start);
				}
				
			}
		},
		getAccessPointMarker:function()		{
			return gAccessPointMarker;
		}
	};

	return MarkerFactory;
}]);
