'use strict';
    
var app = angular.module('ari');
app.directive('button1', [ 
    function ($window) {
        console.log("registering Button1 directive.");
        return {
            restrict: 'EA',
            scope: {
                text: "=?",
                label: "=?",
                value: "=?"
            },
            replace: true,
            link: function (scope, element, attrs) {
                // Debug:
                scope.ThisIs = "Button1";
                
                // Set defaults.
                scope.label = scope.label || "";
                
                // watch for data changes and re-render if changed.
                scope.$watch('label', function (newVal, oldVal) {
                    if (!newVal) return;
                    console.log("label updated!");
                    update();
                }, true);

                scope.$watch('text', function (newVal, oldVal) {
                    if (!newVal) return;
                    update();
                }, true);
                
                
                //attrs.$set("position", "absolute");
                //attrs.$set("width", "100%");
                //attrs.$set("height", "100%");
                
                element.css({
                    "position": "absolute",
                    "width": "100%",
                    "height": "100%",
                    //"pointer-events": "none"    // for this element - but svg should still fire!
                });

                // Define SVG.
                var svg = d3.select(element[0])// Select "self"element.
                    .append("svg")// Prepare SVG content
                    .attr("width", "100%")// at full width.
                    .attr("height", "100%");// at full width.
                    
                    //.attr("viewBox", "0 0 100 50")
                    //.attr("preserveAspectRatio", "xMidYMid meet");
                
                element.on('mousedown', mouseDown);

                var mouseDown = function (){
                    scope.value ^= 1;
                    if (scope.value) {
                        frame
                            .style("stroke", "yellow")
                            .style("stroke-opacity", 1);
                    }
                    else {
                        frame
                        .style("stroke", "white")
                        .style("stroke-opacity", 0.1);
                    }
                    console.log("ButtonMouseDown!", scope.value);
                }
                
                element.on('mousedown', function (event) {
                    console.log("YAY!");
                });
                                
                console.log("svg", svg);
                console.log("element", element);
                
                var computedStyle = getComputedStyle(element[0], null)
                console.log("computedStyle:", computedStyle);

                // Watch Size....
                // This depends on a "hack" in containing element calling scope.$apply() when resizing an element.
                scope.$watch(
                    function () {
                        return element[0].offsetWidth;
                    },
                    function (value) {
                        console.log('Resized width:', value);
                        WIDTH = value;
                        update();
                    }
                )
                scope.$watch(
                    function () {
                        return element[0].offsetHeight;
                    },
                    function (value) {
                        console.log('Resized height:', value);
                        HEIGHT = value;
                        update();
                    }
                )
                
                function update() {
                    // Frame svg
                    frame.attr("x", frameWidth / 2)
                            .attr("y", frameWidth / 2)
                            .attr("width", WIDTH - frameWidth)
                            .attr("height", HEIGHT - frameWidth);
                    
                    // Button svg
                    button.attr("x", frameWidth + 2)
                            .attr("y", frameWidth + 2)
                            .attr("width", WIDTH - 2 * frameWidth - 4)
                            .attr("height", HEIGHT - 2 * frameWidth - 4);

                    label
                        .text(scope.label)
                        .attr("transform", "translate(" + WIDTH / 2 + ", " + HEIGHT + ")")
                        .attr("font-size", WIDTH / 10);

                    text
                        .text(scope.text)
                        .attr("transform", "translate(" + WIDTH / 2 + ", " + HEIGHT / 2 + ")")
                        .attr("font-size", WIDTH / 10);
                }

                
                var WIDTH = 100;
                var HEIGHT = 50;
                
                var frameWidth = 3;
                
                svg.selectAll("*").remove();
                
                // Common defs for svg.                
                var defs = svg.append("svg:defs");
                var buttonGradient = defs.append("svg:linearGradient")
                    .attr("id", "buttonGradient")
                    .attr("x1", "0%")
                    .attr("y1", "0%")
                    .attr("x2", "0%")
                    .attr("y2", "100%");
                    //.attr("spreadMethod", "pad");
                
                buttonGradient.append("svg:stop")
                    .attr("offset", "0%")
                    .attr("stop-color", "#888888")
                    .attr("stop-opacity", 1);

                buttonGradient.append("svg:stop")
                    .attr("offset", "100%")
                    .attr("stop-color", "#111111")
                    .attr("stop-opacity", 1);

                var buttonHighlightGradient = defs.append("svg:linearGradient")
                    .attr("id", "buttonHighlightGradient")
                    .attr("x1", "0%")
                    .attr("y1", "0%")
                    .attr("x2", "0%")
                    .attr("y2", "100%");
                    //.attr("spreadMethod", "pad");
                
                buttonHighlightGradient.append("svg:stop")
                    .attr("offset", "0%")
                    .attr("stop-color", "#FFFFFF")
                    .attr("stop-opacity", 0.5);
                
                var highlightStop = buttonHighlightGradient.append("svg:stop")
                    .attr("id", "highlightStop")
                    .attr("offset", "100%")
                    .attr("stop-color", "#111111")
                    .attr("stop-opacity", 0.5);

                // Frame svg
                var frame = svg.append("rect")
                    .attr("x", frameWidth / 2)
                    .attr("y", frameWidth / 2)
                    .attr("width", WIDTH - frameWidth)
                    .attr("height", HEIGHT - frameWidth)
                    //.attr("transform", "translate(" + WIDTH / 2 + ", " + HEIGHT + ")")
                    .style("fill", "black")
                    .style("stroke", "white")
                    .style("stroke-opacity", 0.1)
                    .style("stroke-width", 6);
                    
                // Button svg
                var button = svg.append("rect")
                    .attr("x", frameWidth + 2)
                    .attr("y", frameWidth + 2)
                    .attr("width", WIDTH - 2*frameWidth - 4)
                    .attr("height", HEIGHT - 2*frameWidth - 4)
                    //.attr("transform", "translate(" + WIDTH / 2 + ", " + HEIGHT + ")")
                    .style("fill", "grey")
                    .style("stroke", "url(#buttonHighlightGradient)")
                    .style("stroke-width", 2)
                    .style("fill", "url(#buttonGradient)")
                    .on("mousedown", mouseDown);
                
                
                // valueText
                var label = svg.append("text")
                    .attr("font-size", WIDTH/10)
                    .attr("text-anchor", "middle")
                    .attr("alignment-baseline", "hanging")
                    .text(scope.label)
                    .attr("transform", "translate(" + WIDTH / 2 + ", " + HEIGHT + ")")
                    .style("fill", "blue")
                    .style("pointer-events", "none");   // Don't block pointer events to child elements.
              
                var text = svg.append("text")
                    .attr("font-size", WIDTH / 7)
                    .attr("text-anchor", "middle")
                    .attr("alignment-baseline", "central")
                    .text(scope.text)
                    .attr("transform", "translate(" + WIDTH / 2 + ", " + HEIGHT / 2 + ")")
                    .style("fill", "white")
                    .style("fill-opacity", 0.5)
                    .style("pointer-events", "none");   // Don't block pointer events to child elements.
                
            }
        }
    }
]);
