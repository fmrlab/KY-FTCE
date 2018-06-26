app.directive('costsSection', ['Cost', function (Cost) {
	return {
		restrict: 'E',
		templateUrl: 'js/common/directives/costsSection/costsSection.html',
		link: function (scope, element, attrs) {

			scope.cost = {
				isUserDefined: true
			};

			scope.rate = {};
			scope.setUserDefined = function () {
				Cost.setTotal(scope.rate.userDefined);
			};

			// default input values
			scope.input = {
				purchasePrice: 100000,
				hpRating: 470,
				machineLife: 10,
				salvagePercent: 25,
				utilizationRate: 60,
				repairMaintPercent: 50,
				interestRate: 8,
				insuranceTaxRate: 5,
				fuelConsumptionRate: 0.002,
				fuelCost: 2,
				lubeOilPercent: 25,
				operatorWage: 25,
				scheduledMachineHrs: 2000
			};

			scope.calculate = function () {
				// CALCULATIONS SECTION
				scope.salvageValue = +scope.input.purchasePrice * +scope.input.salvagePercent/100;
				scope.annualDepreciation = (+scope.input.purchasePrice - scope.salvageValue)/+scope.input.machineLife;
				scope.avgYearInvestment = ((+scope.input.purchasePrice - scope.salvageValue) * (+scope.input.machineLife + 1))/(2 * +scope.input.machineLife) + scope.salvageValue;
				scope.productiveMachineHrs = +scope.input.scheduledMachineHrs * +scope.input.utilizationRate/100;

				// OWNERSHIP COSTS
				scope.interestCost = +scope.input.interestRate/100 * scope.avgYearInvestment;
				scope.insuranceTaxCost = +scope.input.insuranceTaxRate/100 * scope.avgYearInvestment;
				scope.yearOwnerCost = scope.annualDepreciation + scope.interestCost + scope.insuranceTaxCost;
				scope.ownershipCostSMH = scope.yearOwnerCost/+scope.input.scheduledMachineHrs;
				scope.ownershipCostPMH = scope.yearOwnerCost/scope.productiveMachineHrs;

				// OPERATING COSTS
				scope.fuelCost = +scope.input.hpRating * +scope.input.fuelConsumptionRate * +scope.input.fuelCost;
				scope.lubeCost = scope.fuelCost * +scope.input.lubeOilPercent/100;
				scope.repairMaintenanceCost = scope.annualDepreciation * (+scope.input.repairMaintPercent/100)/scope.productiveMachineHrs;
				scope.laborBenefitCost = +scope.input.operatorWage/(+scope.input.utilizationRate/100);
				scope.operatingCostPMH = scope.fuelCost + scope.lubeCost + scope.repairMaintenanceCost + scope.laborBenefitCost;
				scope.operatingCostSMH = scope.operatingCostPMH * +scope.input.utilizationRate/100;

				// TOTAL MACHINE COSTS
				scope.totalCostSMH = scope.ownershipCostSMH + scope.operatingCostSMH;
				scope.totalCostPMH = scope.ownershipCostPMH + scope.operatingCostPMH;
				
				Cost.setTotal(scope.totalCostPMH);
			};

		}

	};
}]);