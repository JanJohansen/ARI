'use strict';
    
var app = angular.module('ari');
app.directive('d3Gauge', [ 
    function () {
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
                scope.$watch(function () {
                    return angular.element(window)[0].innerWidth;
                }, function () {
                    return scope.render();
                });
                
                // watch for data changes and re-render
                scope.$watch('value', function (newVals, oldVals) {
                    return scope.render(newVals);
                }, true);
                
                // define render function
                scope.render = function () {
                    
                    console.log("render d3 - data");
                    var t0 = performance.now();
                    
                    // remove all previous items before render
                    svg.selectAll("*").remove();
                    
                    // If no data, return.
                    if (!scope.value) return;
                    scope.unit = scope.unit || "";
                    
                    var WIDTH = d3.select(iElement[0]).node().offsetWidth;
                    var HEIGHT = d3.select(iElement[0]).node().offsetHeight;
                    var MARGINS = {
                        top: 50,
                        right: 20,
                        bottom: 50,
                        left: 50
                    };
                    
                    var minValue = 0;
                    var maxValue = 100;
                    
                    var myScale = d3.scale.linear().domain([scope.min, scope.max]).range([-0.5 * Math.PI, 0.5 * Math.PI]);
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
                    
                    // minValueText
                    /*svg.append("text")
                        .attr("transform", function (d) { return "translate(" + arc.centroid(d) + ")"; })
                        .attr("font-size", WIDTH / 15)
                        .attr("text-anchor", "start")
                        .text(function (d) { return scope.min })
                        .attr("transform", "translate(" + WIDTH / 2 + ", " + HEIGHT + ")");*/

                    var t1 = performance.now();
                    console.log("Call to doSomething took " + (t1 - t0) + " milliseconds.")
                }
            }
        }
    }
]);
