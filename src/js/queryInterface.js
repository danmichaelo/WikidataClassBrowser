(function() {
	//classBrowser.controller('QueryController', function($scope, Arguments, Classes, Properties, jsonData) {
	qry = angular.module('queryInterface', ['angucomplete-alt']);

	qry.controller('QueryController', ['$scope','Classes', function($scope, Classes) {

		$scope.selected = false;
		$scope.classIndex = [];

		// searching classes in lokal data by id or labels (case insensitive) 
		$scope.classSearch = function(str) {
			var i = $scope.classIndex.length, matches = [], 
				classId, classLabel, newMatch;
			str = str.toString().toLowerCase();
			while(i--) {
				classId = $scope.classIndex[i];
				classLabel = $scope.classData[classId].l;
				if( (classLabel !== undefined && classLabel !== null && classLabel.toLowerCase().indexOf(str) > -1) 
				||( ('q'+classId).indexOf(str) > -1) ) {
					newmatch = $scope.classData[$scope.classIndex[i]];
					newmatch.qid = 'Q' + $scope.classIndex[i];
					newmatch.title = newmatch.l + ' [' + newmatch.qid + ']';
					matches.push(newmatch);
				}
			}
			matches.sort(function(a,b) { // sort by number of all instances descending
				return (a.ai > b.ai) ? -1 : ( (a.ai === b.ai) ? 0 : 1);
			});
			return matches.slice(0,9);
		};

		// build classIndex array when we have the class data
		Classes.then(function(data){
			//console.log('classes loaded');
			$scope.classData = data.getClasses();
			for(var p in $scope.classData) {
				if($scope.classData.hasOwnProperty(p)) {
					$scope.classIndex.push(p);
				}
			}
			 
		});
	}]);
})();
