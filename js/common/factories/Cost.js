app.factory('Cost', function () {
	var total = null;
	var Cost = {
		getTotal: function () {
			return total;
		},
		setTotal: function (totalCost) {
			total = totalCost;
		}
	};
	return Cost;
});