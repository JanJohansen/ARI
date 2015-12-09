'use strict';

var ariModule = angular.module('ari');
ariModule.register.controller('aliasesController', ['$scope', 'AriClient', "AriUser",
    function ($scope, AriClient, AriUser) {
        
        //$scope.aliases = {};
        
        var ari = AriClient.create("ari_clients");
        
        ari.onconnect = function (result) {
            var clientName = result.name;
            console.log("Client connected as \"" + ari.name + "\"");
            
            // Get list of clients.
            ari.callFunction("ari.listClients", {}, function (err, result) {
                if (err) { console.log(err); return; }
                
                $scope.clients = {};

                for (var i in result) {
                    var clientName = result[i].name;
                    console.log("ClientName:", clientName);
                    ari.callFunction("ari.getClientInfo", { "clientName": clientName }, function (err, result) {
                        if (err) { console.log(err); return; }
                        console.log("result:", result, Object.keys(result.values).length);
                        if (Object.keys(result.values).length > 0) {
                            
                            for (var value in result.values) {
                                if (!result.values[value].alias) result.values[value].alias = "";
                            }

                            $scope.clients[result.name] = result;
                            $scope.$apply();    // make sure nGular treats the update!
                            console.log("Scope:", $scope);
                        }
                        /*ari.watchValue(clientName + ".*", function (path, value) {
                            console.log("Value:", path, "=", value);
                            // Remove client name from valuename since we will show it as a "child" of the client.
                            path = path.substring(path.indexOf(".") + 1);
                            if (!$scope.clientInfo.values[path]) $scope.clientInfo.values[path] = {};
                            $scope.clientInfo.values[path].value = value;
                            $scope.$apply();
                        });*/
                    });
                }
/*                console.log(result);
                $scope.clients = result;
                $scope.$apply();    // make sure nGular treats the update!*/
            });
            
            $scope.setAlias = function (element) {
                console.log("setAlias(", element.name, element.value);
                ari.callFunction("ari.setAlias", { "name": element.name, "alias": element.value }, function (err, result) { });
            };
        };
        
        $scope.$on('$destroy', function () {
            /*if ($scope.clientInfo.name) {
                ari.unWatchValue($scope.clientInfo.name + ".*");
                //ari.unsubscribe($scope.clientInfo.name + ".*");
            }
            */
            if (ari) ari.close();
            ari = null;
        });
    }
]);

