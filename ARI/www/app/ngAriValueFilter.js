'use strict';

var app = angular.module('ari');

app.filter('ariValueFilter', ["AriClient", 
    function (AriClient) {
        console.log("registering ari-value-filter.");
        // get singleton connection.
        var ari = AriClient.getInstance("ariValue");
        
        //    var cached = {};
        var lastInput = "";
        var watchedAriValue = "";
        var output = "";
        function doFilter(input) {
            if (input) {
                if (input != lastInput) {
                    // unWatch any watched ariValue
                    if (watchedAriValue != "") ari.unWatchValue(watchedAriValue);
                    watchedAriValue = "";

                    var startMust = input.indexOf("{{");
                    var endMust = input.indexOf("}}");
                    if ((startMust > 0) && (endMust > 0)) {
                        // There is a {{value}}
                        var ariValue = expression.subString(startMust, endMust - startMust);

                        // Subscribe to ariValue updates.
                        ari.watchValue(ariValueName, function (path, value) {
                            output = value;
                        });
                        watchedAriValue = ariValue;
                    } else {
                        // NO {{value}} - use raw string.
                        output = input;
                    }

                    lastInput = input;
                } else {
                    // Same input value, so return current ariValue...
                    // TODO: Check if we need to return undefined if no updates!?
                    return output;
                }
            }
        }
        doFilter.$stateful = true;
        return doFilter;
    }
]);

