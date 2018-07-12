app.controller('pageHeaderCtrl', ['$scope', '$uibModal', function ($scope, $uibModal) {
	$scope.open = function () {
		console.log("pageHeaderController");
		var modalInstance = $uibModal.open({
			templateUrl: 'js/common/directives/pageHeader/helpPage.html',
			controller: 'helpWindowCtrl'
		});
	}
}]);