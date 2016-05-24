
var app = angular.module('ari');
app.directive('ariValue', ["$interval", "AriClient",
    function ($interval, AriClient) {
        console.log("registering ari-value directive.");
        // get singleton connection.
        var ari = AriClient.getInstance("ariValue");

        return {
            restrict: 'E',
            link: function (scope, element, attrs) {
                
                //console.log("attrs:", attrs);

                var watchedAriValue = "";
                
                attrs.$observe('name', function (newValue) {
                    //console.log("observe name:", newValue);
                    if (!newValue) return;
                    
                    if (watchedAriValue != "") ari.unWatchValue(watchedAriValue);
                    watchedAriValue = "";
                    
                    if (newValue.indexOf("$$") == 0) {
                        // There is a $$ari.value
                        var ariValue = newValue.substring(2);
                        
                        // Subscribe to ariValue updates.
                        
                        ari.watchValue(ariValue, function (path, value) {
                            scope[attrs.value] = value;
                            scope.$apply();
                        });
                        watchedAriValue = ariValue;
                    } else {
                        // NO {{value}} - use raw string.
                        scope[attrs.value] = newValue;
                        //console.log("scope", scope);
                    }
                });

                // TODO: Observe value for 2way bindings - to set ari.value!
                // ...

            },
            template: ""
        }
    }
]);