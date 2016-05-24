'use strict';

var ariModule = angular.module('ari');
ariModule.register.controller('GUIBuilderController', ["$scope", "$interval", 'AriClient', '$compile', '$location', '$http', '$ocLazyLoad',
    function ($scope, $interval, AriClient, $compile, $location, $http, $ocLazyLoad) {
        
        $scope.ThisIs = "Editor";

        // get singleton connection.
        var ari = AriClient.getInstance("ariValue");

        /*
        console.log("Location:", $location);
        console.log("Path:", $location.path());
        console.log("Search:", $location.search());
        */
        
        var path = $location.path();
        var pluginsPath = path.substring(0, path.lastIndexOf("/") + 1);
        var widgetsPath = pluginsPath + "widgets/";
        
        // Load widget info from server.
        $http.get(widgetsPath + "widgetsInfo.json").then(function (response) {
            console.log("response:", response);
            
            $scope.widgetsInfo = response.data;
            for (var id in $scope.widgetsInfo.widgets) {
                var widget = $scope.widgetsInfo.widgets[id];
                widget.iconUrl = widgetsPath + widget.name + "/" + widget.iconFile;
                widget.controller = widgetsPath + widget.name + "/" + widget.controller;
                console.log("Widget:", id, widget);
            }
        });
        
        $scope.editor = {};
        $scope.editor.editMode = false;
        $scope.togleEditMode = function() {
            $scope.editor.editMode ^= 1;
        }
        
        function clone(obj) {
            var target = {};
            for (var i in obj) {
                if (obj.hasOwnProperty(i) && (i.indexOf("$$") < 0)) {
                    if(typeof obj[i] === 'object') target[i] = clone(obj[i]);
                    else target[i] = obj[i];
                }
            }
            return target;
        }
        
        $scope.widgets = [];
        var widgetId = 0;
        // Add selected element to GUI.
        $scope.addWidget = function (widgetInfo) {
            
            var widgetModel = clone(widgetInfo);
            widgetModel.id = widgetId++;
            
            console.log("ADD widgetModel...", widgetModel);

            $scope.widgets.push(widgetModel);
            
            console.log("editor scope:", $scope);
            
            /*$ocLazyLoad.load(newElement.controller).then(function () {
                // Compile element w. angulars $compile.
                //var newElement = $compile("<" + element + " class='guielement'></" + element + ">")($scope);
                //var newElement = $compile("<guib-element class='guielement'><" + element + "></" + element + "></guib-element>")($scope);
                var newElement = $compile("<guib-element config-params='configParams' style='left: 100px; top: 100px;'><" + element + " config-params='configParams'></" + element + "></guib-element>")($scope);
                console.log("newElement:", newElement);
                console.log("newElement.scope():", newElement.scope());
                
                // Add element DOM.
                var container = angular.element(document.getElementById('flexcontainer'));
                container.append(newElement);
                
            }, function (e) {
                console.log("Error:", e);
            })
            */
        }
        
        // Upload GUI to server.
        $scope.save = function () {
            console.log("Saving elements:", $scope.widgets);
            ari.callFunction("GUI-Builder.saveLayout", {fileName: "TestLayout.GUI", data: JSON.stringify($scope.widgets)}, function (err, result) {
                if (err) { console.log(err); return; }
                else console.log("File saved remotely.");
            });

            /*
            $scope.elements.forEach(function (element, index, array) { 
                console.log("Element:", element);
            });
            */
            /*var guielements = document.body.querySelectorAll('guib-element');//element[0].querySelectorAll('.guielement');
            [].forEach.call(guielements, function (element) {
                var e = angular.element(element);
                //console.log(e);
                console.log("Element:", element);
                console.log("Element.scope:", element.scope());

                console.log("X:", e.context.attributes["data-x"], "Y:", e.context.attributes["data-y"]);
            });*/
        }
        
        // Download GUI from server.
        $scope.load = function () {
            ari.callFunction("GUI-Builder.loadLayout", { fileName: "TestLayout.GUI" }, function (err, result) {
                if (err) { console.log(err); return; }
                
                $scope.widgets = [];   // clear contents first!
                $scope.$apply();

                $scope.widgets = JSON.parse(result.data);
                console.log("Loaded elements:", $scope.widgets);
                $scope.$apply();

                // Make sure we don't use ocupied widgetId 
                widgetId = 0;
                for (var key in $scope.widgets) {
                    var widget = $scope.widgets[key];
                    if (widget.id >= widgetId) widgetId = widget.id + 1;
                    console.log("Widget:", widget, widgetId);
                }
            });
        }
        
        // Edit element.
        $scope.editWidget = function (widgetModel) {
            console.log("editWidget:", widgetModel);
            
            $scope.widgetModel = widgetModel;
            $scope.showElementEditor ^= true;
        }

        $scope.editDone = function (){
            console.log($scope.elementConfig);
        }

        $scope.deleteWidget = function (widgetModel) {
            console.log("deleteWidget:", widgetModel);
            
            for (var key in $scope.widgets) {
                var widget = $scope.widgets[key];
                if (widget.id == widgetModel.id) $scope.widgets.splice(key, 1);
            }
        }
        
        /*
        var ari = AriClient.create("ari_Clock");
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
