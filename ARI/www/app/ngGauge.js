'use strict';
    
var app = angular.module('ari');
app.directive('d3Gauge', [ 
    function ($window) {
        console.log("registering d3-gauge directive.");
        return {
            restrict: 'EA',
            scope: {
                value: "=",
                min: "=",
                max: "=",
                unit: "@"
            },
            link: function (scope, iElement, iAttrs) {
                console.log("link  ngGauge");
                
                var svg = d3.select(iElement[0])// Select "self"element.
                    .append("svg")// Prepare SVG content
                    .attr("width", "100%")// at full width.
                    .attr("height", "100%");         // at full width.
                
                // on window resize, re-render d3 canvas
                window.onresize = function () {
                    return scope.$apply();
                };
                
                // Watch element innerWidth, and re-render if changed.
                scope.$watch(function () {
                    return angular.element(window)[0].innerWidth;
                }, function () {
                    return scope.render();
                });
                
                // watch for data changes and re-render if changed.
                scope.$watch('value', function (newVal, oldVal) {
                    console.log("$WATCH!!!", newVal, oldVal);

                    return scope.render();
                }, true);
                
                // define render function
                scope.render = function () {
                    // If no data, return.
                    if (!scope.value) return;
                    
                    // THIS DOES NOT WORK!!!"%¤#!¤%"
                    //if (!scope.value) scope.value = scope.min;
                    
                    // remove all previous items before render
                    svg.selectAll("*").remove();
                    
                    var WIDTH = d3.select(iElement[0]).node().offsetWidth;
                    var HEIGHT = d3.select(iElement[0]).node().offsetHeight;
                    var MARGINS = { top: 50, right: 20, bottom: 50, left: 50 };
                    
                    console.log("WIDTH", WIDTH);
                    console.log("scope.value", scope.value);
                    console.log("scope.unit", scope.unit);
                    console.log("scope.min", scope.min);
                    console.log("scope.max", scope.max);
                    

                    var myScale = d3.scale.linear()
                        .domain([scope.min, scope.max])
                        .range([-0.5 * Math.PI, 0.5 * Math.PI]);

                    // outerArc
                    var outerArc = d3.svg.arc()
                        .innerRadius(WIDTH / 2 * 0.99)
                        .outerRadius(WIDTH / 2)
                        .startAngle(myScale(scope.min))
                        .endAngle(myScale(scope.max));
                    svg.append("path")
                        .attr("d", outerArc)
                        .attr("transform", "translate(" + WIDTH / 2 + ", " + HEIGHT + ")");
                    
                    // GaugeArc
                    var arc = d3.svg.arc()
                        .innerRadius(WIDTH / 2 * 0.8)
                        .outerRadius(WIDTH / 2)
                        .startAngle(myScale(scope.min))
                        .endAngle(myScale(scope.value));
                    svg.append("path")
                        .attr("d", arc)
                        .attr("transform", "translate(" + WIDTH / 2 + ", " + HEIGHT + ")");
                    
                    // valueText
                    svg.append("text")
                        .attr("transform", function (d) { return "translate(" + arc.centroid(d) + ")"; })
                        .attr("dy", -WIDTH/20)
                        .attr("font-size", WIDTH/7)
                        .attr("text-anchor", "middle")
                        .text(function (d) { return scope.value + "°C" })//scope.unit; })
                        .attr("transform", "translate(" + WIDTH / 2 + ", " + HEIGHT + ")");
                }
            }
        }
    }
]);
