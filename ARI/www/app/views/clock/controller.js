'use strict';

var ariModule = angular.module('ari');
ariModule.register.controller('clockController', ["$scope", "$interval", 'AriClient',
    function ($scope, $interval, AriClient) {
        
        //helper.
        function addZero(x) {
            if (x < 10) {
                return x = '0' + x;
            } else {
                return x;
            }
        }
        
        var ari = AriClient.create("ari_Clock");
        
        ari.onconnect = function (result) {
            var clientName = result.name;
            console.log("Client connected as \"" + ari.name + "\"");
            
            ari.watchValue("ari.time", function (path, value) {
                var date = new Date(value);
                $scope.hour = addZero(date.getHours());
                $scope.minute = addZero(date.getMinutes());
                $scope.second = addZero(date.getSeconds());
                $scope.$apply(); // Apply async changes.
            });
        };
        
        $scope.$on('$destroy', function () {
            ari.unWatchValue("ari.time");
            if (ari) ari.close();
        });
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
