'use strict';

// Please note that $modalInstance represents a modal window (instance) dependency.
// It is not the same as the $uibModal service used above.
angular.module('ui.bootstrap.demo', ['ngAnimate', 'ui.bootstrap']);
angular.module('ui.bootstrap.demo').controller('ModalInstanceCtrl', function ($scope, $modalInstance, items) {
    
    $scope.items = items;
    $scope.selected = {
        item: $scope.items[0]
    };
    
    $scope.ok = function () {
        $modalInstance.close($scope.selected.item);
    };
    
    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
});



var ariModule = angular.module('ari');
ariModule.register.controller('UIBuilderController', ["$scope", "$interval", 'AriClient', '$uibModal',
    function ($scope, $interval, AriClient, $uibModal) {
        
        $scope.items = ['item1', 'item2', 'item3'];
        
        $scope.togleModal = function () {
            console.log("HEY!");

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

