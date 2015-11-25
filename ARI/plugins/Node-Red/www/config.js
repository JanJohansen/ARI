'use strict';

var ariModule = angular.module('ari');
ariModule.register.controller('nodeRedController', ["$scope", "$interval", 'AriClient', "$location", "$sce",
    function ($scope, $interval, AriClient, $location, $sce) {
        
        //$location
        $scope.iFrameUrl = $sce.trustAsResourceUrl("http://" + $location.host() + ":1880");


        /*
        var ari = AriClient.create("ari_NodeRed");
        
        ari.onconnect = function (result) {
            var clientName = result.name;
            console.log("Client connected as \"" + ari.name + "\"");
            
            ari.subscribe("ari.time", function (path, value) {
                var date = new Date(value);
                $scope.date = date;
                $scope.$apply(); // Apply async changes.
            });
        };
        
        $scope.$on('$destroy', function () {
            ari.unsubscribe("ari.time");
            if (ari) ari.close();
        });*/
    }
]);
