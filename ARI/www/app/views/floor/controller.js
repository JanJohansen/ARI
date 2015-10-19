'use strict';

var ariModule = angular.module('ari');
ariModule.register.controller('floorController', ["$scope", "$interval", 'AriClient',
    function ($scope, $interval, AriClient) {
        //$scope.ariVal = "orig";
        //$scope.x = { time: "origTime" };
        /*var ari = AriClient.create("ari_Clock");
        
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
        
        $scope.$on('$destroy', function () {
            ari.unsubscribe("ari.time");
            if (ari) ari.close();
        });
        */
    }
]);
