'use strict';
    
var app = angular.module('ari');
app.directive('text1', [ 
    function ($window) {
        console.log("registering gauge1 directive.");
        return {
            restrict: 'EA',
            scope: {
                text: "=?",
                fontSize: "=?",
                color: "=?"
            },
            template: "<div>{{text}}<div>", //style=\"width: 100%; height: 100%;\"
            link: function (scope, element, attrs) {
                console.log("link  text1directive.");
                // Debug:
                scope.ThisIs = "text1";
                
                // Set defaults.
                scope.text = scope.text || "???";
                scope.fontSize = scope.fontSize || "200%";
                
                // watch for data changes and re-render if changed.
/*                scope.$watch('text', function (newVal, oldVal) {
                    if (!newVal) return;
                    scope.text(function (d) { return scope.label; });
                }, true);
 * */
            }
        }
    }
]);
