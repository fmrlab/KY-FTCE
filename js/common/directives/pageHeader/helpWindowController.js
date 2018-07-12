app.controller('helpWindowCtrl', ['$scope', '$uibModalInstance', function ($scope, $uibModalInstance) {
	$scope.close = function () {
		console.log("close");
		$uibModalInstance.dismiss('cancel');
	}
}]);