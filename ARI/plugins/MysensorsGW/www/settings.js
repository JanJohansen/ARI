'use strict';

var ariModule = angular.module('ari');
ariModule.register.controller('MysensorsGWSettingsController', ['$scope', 'AriClient', "AriUser",
    function ($scope, AriClient, AriUser) {
        $scope.clientInfo = {};

        var ari = AriClient.create("MysensorsGW_Settings");

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
                alert("Missing setReqTypes for sensor \n" + JSON.stringify(result, null, 4));
              } else {
                $scope.config.nodes[nodeId].active = true;
              }
            }

            $scope.deActivateNodeId = function (nodeId)
            {
              $scope.config.nodes[nodeId].active = false;
            }

            $scope.showNodeId = function (nodeId)
            {
              return $scope.config.nodes[nodeId].active;
            }


        };



        $scope.$on('$destroy', function () {
            //if ($scope.clientInfo.name) ari.unsubscribe($scope.clientInfo.name + ".*");
            if (ari) ari.close();
            ari = null;
        });
    }
]);
