'use strict';

var ariModule = angular.module('ari');
ariModule.register.controller('MysensorsGWSettingsController', ['$scope', 'AriClient', "AriUser", '$uibModal',
    function ($scope, AriClient, AriUser, $uibModal) {

        var ari = AriClient.create("PhilipsHueGW_Settings");

        ari.onconnect = function (result) {
            var clientName = result.name;

            // Get list of clients.
            ari.callFunction("MysensorsGW.getConfig", {}, function (err, result) {
                if (err) { console.log(err); return; }

                console.log(result);
                $scope.config = result;
                $scope.$apply();    // make sure nGular treats the update!
            });

            $scope.saveConfig = function ()
            {
                ari.callFunction("MysensorsGW.setConfig", $scope.config, function (err, result) {
                    if (err) { console.log(err); return; }
                });
            }

            $scope.activateNodeId = function (nodeId)
            {
              var result = {};
              var number = 0;
              var sensors = $scope.config.nodes[nodeId].sensors;
              for (var key in sensors) {
                var sensor = sensors[key];
                if (!sensor.setReqTypes) {
                  result[number] = {"name": $scope.config.nodes[nodeId].name, "sensor": sensors[key].name};
                  number = number + 1;
                  console.log("BINGO");
                }
              }
              if (number != 0) {
                var r = confirm("Missing setReqTypes for sensor \n" + JSON.stringify(result, null, 4) + "\n\n add node any way?");
                if (r == true) {
                    $scope.config.nodes[nodeId].active = true;
                } else {
                }
                //alert("Missing setReqTypes for sensor \n" + JSON.stringify(result, null, 4));
              } else {
                $scope.config.nodes[nodeId].active = true;
              }
            }

            $scope.deActivateNodeId = function (nodeId)
            {
              $scope.config.nodes[nodeId].active = false;
            }

            $scope.removeNodeId = function (nodeId)
            {
              delete $scope.config.nodes[nodeId];
            }

            $scope.editNodeId = function (nodeId)
            {
              var node = $scope.config.nodes[nodeId];
              //prompt("Please edit:", JSON.stringify(node, null, 4));
              var data = JSON.stringify(node, null, 4); // pretty print
              data = "<textarea cols='100' rows='150'>" + data + "</textarea>"; // encase in text area
              open("data:text/html,"+ encodeURIComponent(data), "_blank", "width=300,height=500");
            }

            $scope.showNodeId = function (nodeId)
            {
              return $scope.config.nodes[nodeId].active;
            }
        };

        //$scope.sensors = ['item1', 'item2', 'item3'];

        $scope.open = function (nodeId) {

          var modalInstance = $uibModal.open({
            animation: true,
            templateUrl: 'myModalContent.html',
            controller: 'ModalInstanceCtrl',
            size: 'lg', //lg, sm
            resolve: {
              sensors: function () {
                // Provide the necessary data to the
                var node = $scope.config.nodes[nodeId];
                $scope.sensors = node.sensors;
                return $scope.sensors;
              }
            }
          });

          modalInstance.result.then(function (selectedItem) {
            $scope.selected = selectedItem;
            console.log("OK pressed in Model");
          }, function () {
            console.log("Modal dismissed");
          });
        };

        $scope.$on('$destroy', function () {
            //if ($scope.clientInfo.name) ari.unsubscribe($scope.clientInfo.name + ".*");
            if (ari) ari.close();
            ari = null;
        });
    }
]);

// Please note that $uibModalInstance represents a modal window (instance) dependency.
// It is not the same as the $uibModal service used above.

angular.module('ari').register.controller('ModalInstanceCtrl', function ($scope, $uibModalInstance, sensors) {

  $scope.sensors = sensors;

  $scope.selected = {
    sensor: 'None'
  };

  $scope.ok = function () {
    $uibModalInstance.close($scope.selected.sensor);
  };

  $scope.cancel = function () {
    $uibModalInstance.dismiss('cancel');
  };
});
