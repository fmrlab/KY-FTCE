app.factory('UnitConvert', function () {
	return {
		toRad: function (x) {
			return x*Math.PI/180;
		},
		toDeg: function (x) {
			return x*180/Math.PI;
		},
		intToHex: function (i) {
			var hex = parseInt(i).toString(16);
	    	return (hex.length < 2) ? "0" + hex : hex;
		},
		miToKm: function (mi) {
			return mi * 1.609344;
		}
	};
});