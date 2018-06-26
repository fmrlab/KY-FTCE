app.config(['$stateProvider', function ($stateProvider) {
	$stateProvider.state('heatmap', {
		url: '/heatmap',
		template: '<div id="hm-map"></div>',
		controller: 'HeatmapCtrl'
	});
}]);