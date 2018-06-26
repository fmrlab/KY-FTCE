app.config(['$stateProvider', function ($stateProvider) {
	$stateProvider.state('routeFinder', {
		url: '/routeFinder',
		template: '<div id="opt-map"></div>',
		controller: 'RouteFinderCtrl'
	});
}]);