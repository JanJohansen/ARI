'use strict';

var ariModule = angular.module('ari');
ariModule.register.controller('clockController', ["$scope", "$interval", 'AriConnection', 
    function ($scope, $interval, AriConnection) {
        
        //helper.
        function addZero(x) {
            if (x < 10) {
                return x = '0' + x;
            } else {
                return x;
            }
        }
        
        var ari = new AriConnection({ "name": "Guest" });
        
        ari.onconnect = function (result) {
            var clientName = result.name;
            console.log("Client connected as \"" + ari.name + "\"");
            
            ari.subscribe("ari.time", function (path, value) {
                var date = new Date(value);
                $scope.hour = addZero(date.getHours());
                $scope.minute = addZero(date.getMinutes());
                $scope.second = addZero(date.getSeconds());
                $scope.$apply(); // Apply async changes.
            });
        };
    /*    
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
    */
    }
]);
