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
			scope.toggleMarkers = function() {
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
			if($state.current.name === 'heatmap') {
				scope.isHeatmapOpen = true;

			} else if ($state.current.name === 'routeFinder') {
				scope.isRouteFinderOpen = true;
			} else {
				scope.isRouteSelectorOpen = true;
			}
		} 
	};
}]);