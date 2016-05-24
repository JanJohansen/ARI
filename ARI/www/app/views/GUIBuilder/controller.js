'use strict';

var ariModule = angular.module('ari');
ariModule.register.controller('GUIBuilderController', ["$scope", "$interval", 'AriClient', '$uibModal', '$compile', '$location', '$http',
    function ($scope, $interval, AriClient, $uibModal, $compile, $location, $http) {
    
        console.log("Location:", $location);
        console.log("Path:", $location.path());
        console.log("Search:", $location.search());

        $scope.items = ['item1', 'item2', 'item3'];
        
        $http.get($location.path() + "/widgets.json").then(function (response) {
            console.log("response:", response);
            //$scope.myWelcome = response.data;
        });

        
        $scope.addElement = function () {
            console.log("ADD element...");
            angular.element(document.getElementById('flexcontainer'))
             .append($compile('<d3-gauge class="guielement" value="50" label="???" unit="?" min="0" max="100" style="width:300px;"></d3-gauge>')
             ($scope));
        }
        
        $scope.save = function () {
            var guielements = document.body.querySelectorAll('.guielement');//element[0].querySelectorAll('.guielement');
            [].forEach.call(guielements, function (element) {
                var e = angular.element(element);
                //console.log(e);
                console.log("Element:", element);
                console.log("X:", e.context.attributes["data-x"], "Y:", e.context.attributes["data-y"]);
            });
        }
        
        $scope.load = function () {
        }
                
        $scope.editElement = function () {
            console.log("Edit element...");

            var modalInstance = $uibModal.open({
                animation: true,
                templateUrl: 'myModalContent.html',
                controller: 'ModalInstanceCtrl',
                //size: size,
                resolve: {
                    items: function () {
                        return $scope.items;
                    }
                }
            });
        }

        
        
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

