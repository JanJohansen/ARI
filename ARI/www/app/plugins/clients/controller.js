'use strict';

var ariModule = angular.module('ari');
console.log("calling client/controller.");

ariModule.register.controller('clientsController', ['$scope', 'AriConnection', 
    function ($scope, AriConnection) {
        console.log("clients.html loaded");
        
        $scope.clientInfo = {};
        
        var ari = new AriConnection();
        ari.connect("Clients", function (err, result) {
            if (err) { console.log("ERROR: Could not connect vi WebSocket!"); return; }
            
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
                    
                    $scope.clientInfo.values = {};
                    //var lscope = $scope;
                    ari.subscribe(clientName + ".*", function (path, value) {
                        console.log("->", path, "=", value);
                        $scope.clientInfo.values[path] = value;
                        $scope.$apply();
                    });
                });
            }
        });
    }
]);

