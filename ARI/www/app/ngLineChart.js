'use strict';
    
var app = angular.module('ari');
app.directive('d3Lines', [ 
    function () {
        console.log("registering d3-lines directive.");
        return {
            restrict: 'EA',
            scope: {
                data: "=",
                label: "@",
                onClick: "&"
            },
            link: function (scope, iElement, iAttrs) {
                console.log("link  d3");
                
                var svg = d3.select(iElement[0])// Select "self"element.
                    .append("svg")// Prepare SVG content
                    .attr("width", "100%")         // at full width.
                    .attr("height", "100%");         // at full width.
                
                // on window resize, re-render d3 canvas
                window.onresize = function () {
                    return scope.$apply();
                };
                scope.$watch(function () {
                    return angular.element(window)[0].innerWidth;
                }, function () {
                    return scope.render(scope.data);
                });
                
                // watch for data changes and re-render
                scope.$watch('data', function (newVals, oldVals) {
                    console.log("newData d3");
                    return scope.render(newVals);
                }, true);
                
                // define render function
                scope.render = function (data) {
                    
                    console.log("render d3 - data");
                    var t0 = performance.now();
                    
                    // remove all previous items before render
                    svg.selectAll("*").remove();
                    
                    // I fno data, return.
                    if (!data) return;
                    
                    var WIDTH = d3.select(iElement[0]).node().offsetWidth;//300;
                    var HEIGHT = d3.select(iElement[0]).node().offsetHeight;//300;
                    console.log(WIDTH, HEIGHT);
                    var MARGINS = {
                        top: 50,
                        right: 20,
                        bottom: 50,
                        left: 50
                    };
                    
                    var xScale = d3.time.scale.utc().range([MARGINS.left, WIDTH - MARGINS.right]).domain([d3.min(data, 
                        function (d) {
                            return d.time;
                        }), 
                        d3.max(data, function (d) {
                            return d.time;
                        })]);
                    
                    var yScale = d3.scale.linear().range([HEIGHT - MARGINS.top, MARGINS.bottom]).domain([
                        d3.min(data, function (d) {
                            return parseFloat(d.value);
                            //return d.value;
                        }), 
                        d3.max(data, function (d) {
                            return parseFloat(d.value);
                        })]);
                    
                    var xAxis = d3.svg.axis()
                        .scale(xScale)
                        .tickFormat(d3.time.format('%Y-%m-%d %H:%M:%S'));
                    
                    var yAxis = d3.svg.axis()
                        .scale(yScale)
                        .orient("left");
                    
                    svg.append("svg:g")
                        .attr("class", "x axis")
                        .attr("transform", "translate(0," + (HEIGHT - MARGINS.bottom) + ")")
                        .call(xAxis);
                    
                    svg.selectAll(".x text")// select all the text elements for the xaxis
                        .attr("transform", function (d) {
                            return "translate(" + this.getBBox().height * -2 + "," + this.getBBox().height + ")rotate(-45)";
                        });
                    
                    svg.append("svg:g")
                        .attr("class", "y axis")
                        .attr("transform", "translate(" + (MARGINS.left) + ",0)")
                        .call(yAxis);
                    
                    var lineGen = d3.svg.line()
                    .x(function (d) {
                        return xScale(d.time);
                    })
                    .y(function (d) {
                        return yScale(d.value);
                    })
                    .interpolate("step-after");
                    
                    svg.append('svg:path')
                        .attr('d', lineGen(data))
                        .attr('stroke', 'blue')
                        .attr('stroke-width', 2)
                        .attr('fill', 'none');

                    /*vis.append("text")
                        .attr("x", (lSpace / 2) + i * lSpace)
                        .attr("y", HEIGHT)
                        .style("fill", "black")
                        .attr("class", "legend")
                        .on('click', function () {
                            var active = d.active ? false : true;
                            var opacity = active ? 0 : 1;
                            d3.select("#line_" + d.key).style("opacity", opacity);
                            d.active = active;
                        })
                        .text(d.key);*/
                    var t1 = performance.now();
                    console.log("Call to doSomething took " + (t1 - t0) + " milliseconds.")
                }
            }
        }
    }
]);
