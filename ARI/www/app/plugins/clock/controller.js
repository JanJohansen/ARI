'use strict';

//console.log("Regisering controller.");

var ariModule = angular.module('ari');
ariModule.register.controller('clockController', function ($scope, $interval ) {
    $scope.hour = "hh";
    $scope.minute = "mm";
    $scope.second = "ss";
    $scope.second = "88";
    
    // Create timer.
    var timer = $interval(function () {
        var date = new Date();
        function addZero(x) {
            if (x < 10) {
                return x = '0' + x;
            } else {
                return x;
            }
        }
        $scope.hour = addZero(date.getHours());
        $scope.minute = addZero(date.getMinutes());
        $scope.second = addZero(date.getSeconds());
    }, 1000);
    
    // Free resources.
    $scope.$on('$destroy', function () {
        // Remember to desctroy timer and set to zero, to avoid mem-leeks.
        console.log("DESTROYING!");
        $interval.cancel(timer);
        timer = undefined;
    });
});
