app.directive('sidePanel', function () {
	return {
		restrict: 'E',
		templateUrl: 'js/common/directives/sidePanel/sidePanel.html',
		link: function (scope, element, attrs) {
			scope.enableCost = false;
		}
	};
});