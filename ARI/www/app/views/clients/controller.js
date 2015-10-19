'use strict';

var ariModule = angular.module('ari');
ariModule.register.controller('clientsController', ['$scope', 'AriClient', "AriUser",
    function ($scope, AriClient, AriUser) {
        console.log("clients.html loaded");
        
        $scope.clientInfo = {};
        
        var ari = AriClient.create("ari_clients");
        
        ari.onconnect = function (result) {
            var clientName = result.name;
            console.log("Client connected as \"" + ari.name + "\"");
            
            // Get list of clients.
            ari.callRpc("ari.listClients", {}, function (err, result) {
                if (err) { console.log(err); return; }

                console.log(result);
                $scope.clients = result;
                $scope.$apply();    // make sure nGular treats the update!
            });
            
            $scope.clientSelected = function (clientName)
            {
                // Unsibscribe last subs.
                if($scope.clientInfo.name) ari.unsubscribe($scope.clientInfo.name + ".*");

                ari.callRpc("ari.getClientInfo", { "clientName": clientName }, function (err, result) {
                    if (err) { console.log(err); return; }
                    //console.log(result);
                    $scope.clientInfo = result;//JSON.stringify(result, null, 4);
                    $scope.$apply();    // make sure nGular treats the update!
                    
                    if(!$scope.clientInfo.values) $scope.clientInfo.values = {};
                    //var lscope = $scope;
                    ari.subscribe(clientName + ".*", function (path, value) {
                        console.log("->", path, "=", value);
                        // Remove client name from valuename since we will show it as a "child" of the client.
                        path = path.substring(path.indexOf(".") + 1);
                        if (!$scope.clientInfo.values[path]) $scope.clientInfo.values[path] = {};
                        $scope.clientInfo.values[path].value = value;
                        $scope.$apply();
                    });
                });
            }
        };
        
        $scope.$on('$destroy', function () {
            if ($scope.clientInfo.name) ari.unsubscribe($scope.clientInfo.name + ".*");
            if (ari) ari.close();
            ari = null;
        });
    }
]);

