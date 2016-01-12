
var app = angular.module('ari');
app.directive('ariValue', ["$interval", "AriClient",
    function ($interval, AriClient) {
        console.log("registering ari-value directive.");
        // get singleton connection.
        var ari = AriClient.getInstance("ariValue");

        return {
            restrict: 'E',
            link: function (scope, element, attrs) {
                //console.log("link:attrs =", attrs);
                ari.watchValue(attrs.name, function (path, value) {
                    scope.$parent[attrs.value] = value;
                    scope.$parent.$apply();
                });

                                
/*                scope.$watch("name", function (newValue) {
                    console.log("!!scope.ariVal:", JSON.stringify(scope.ariVal));
                    ari.subscribe(newValue, function (path, value) {
                        scope.$parent[attrs.value] = value;
                    });
                });*/
                
              /*  console.log("scope.ariName:", JSON.stringify(scope.ariName));
                console.log("scope.ariVal:", JSON.stringify(scope.ariVal));

                //console.log("link:attrs =", attrs);
                //attrs.$set("ariVal", "mJello!");
                //console.log("link:attrs =", attrs);
                
                console.log("scope.ariName:", JSON.stringify(scope.ariName));
                console.log("scope.ariVal:", JSON.stringify(scope.ariVal));
                
                scope.$watch("ariVal", function (newValue) {
                    console.log("!!scope.ariVal:", JSON.stringify(scope.ariVal));
                    //element.text(newValue);
                });
                
                attrs.$observe("ariName", function (newName) {
                    console.log("!!! ", newName, "=", attrs.ariVal);
                    
                    console.log("scope.ariName:", JSON.stringify(scope.ariName));
                    console.log("scope.ariVal:", JSON.stringify(scope.ariVal));
                    
                    scope.ariVal = 99;
                    
                    console.log("scope.ariName:", JSON.stringify(scope.ariName));
                    console.log("scope.ariVal:", JSON.stringify(scope.ariVal));
                });
                
                element.on('$destroy', function () {
                });
              */
              /*var c = 0;
                $interval(function () {
                    console.log("-->", scope, attrs);
                    
                    // This might be a anti-transclusion-patern/hack...?
                    // But seems to work :O)
                    scope.$parent[attrs.value] = attrs.name + ":" + c++;

                }, 1000);*/
            },
            template: ""
        }
    }
]);