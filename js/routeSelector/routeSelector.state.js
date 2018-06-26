app.config(['$stateProvider', function ($stateProvider) {
	$stateProvider.state('routeSelector', {
		url: '/routeSelector',
		template: '<div id="sel-map"></div>',
		controller: 'RouteSelectorCtrl'
	});
}]);