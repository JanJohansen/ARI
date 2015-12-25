'use strict';

var ariModule = angular.module('ari');
ariModule.register.controller('overviewController', ["$scope", "$interval", 'AriClient',
    function ($scope, $interval, AriClient) {

      $scope.clientInfo = {};

      var ari = AriClient.create("ari_clients");

      watchValue("MysensorsGW.VærelseVand.Humidity.V_HUM", chart);

      function watchValue(clientName, theChart) {
        ari.watchValue(clientName, function (path, value) {
            console.log("Value:", path, "=", value);
            // Remove client name from valuename since we will show it as a "child" of the client.
            path = path.substring(path.indexOf(".") + 1);

            theChart.load({
              columns: [
                ['data', value]
              ]
            });
        });
      }

      // Get list of clients.
      ari.callFunction("ari.listLogs", {}, function (err, result) {
          if (err) { console.log(err); return; }

          console.log("listLogs -->", result);
          $scope.selected = null;
          $scope.logs = result;
          $scope.$apply();    // make sure nGular treats the update!
      });

      var logRequest =
      {
          "name": "", // Depends on selected logs.
          "startTime": 0,
          "endTime": new Date(),
          "minInterval": 0,
          "interpolation": "mean"
      };

      logSelected("MysensorsGW.WaterMeter.Water.V_VAR1.log");

      function logSelected (logName) {
          logRequest.name = logName;
          console.log("Requesting log from", logRequest.startTime, "to", logRequest.endTime);
          ari.callFunction("ari.getLog", logRequest, function (err, result) {
              if (err) { console.log(err); return; }
              var entries = result.split("\n");
              var data = [];
              entries.forEach(function (entry) {
                  var split = entry.indexOf(",");
                  if (split == -1) return;    // This is like "continue"!!!
                  var time = +entry.substring(0, split);
                  var value = JSON.parse(entry.substring(split + 1));
                  data.push({ "x": time, "value": value });
              });
              $scope.logName = logName;
              $scope.data = data;
              $scope.$apply();    // make sure nGular treats the update!
              log.load({
                  json: data,
                  keys: {
                      x: 'x',
                      value: ['value']
                  },
                  unload: 'value'
              });
          });
      }

      $scope.update = function() {
         console.log("selected: "+ $scope.selected);

         logSelected($scope.selected);
         // use $scope.selectedItem.code and $scope.selectedItem.name here
         // for other stuff ...
      }

      $scope.$on('$destroy', function () {
          ari.unWatchValue("MysensorsGW.*");

          if (ari) ari.close();
          ari = null;
      });
    }
]);
