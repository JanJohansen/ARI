﻿'use strict';
    
var app = angular.module('ari');
app.directive('button1', [ 
    function ($window) {
        return {
            restrict: 'EA',
            scope: {
                text: "@",
            },
            //template: "<button>{{text}}</button>",
            link: function (scope, element, iAttrs) {
                
                scope.text = scope.text || "????";
                
                // watch for data changes and re-render if changed.
                scope.$watch('text', function (newVal, oldVal) {
                    if (!newVal) return;
                    //update();
                }, true);
                
                var newElement = document.createElement("BUTTON");        // Create a <button> element
                var t = document.createTextNode("CLICK ME");       // Create a text node
                newElement.appendChild(t);                                // Append the text to <button>
                
                /*
                t.css({
                    //display: "block-inline",
                    //position: 'absolute',
                    width: "100%",
                    height: "100%"
                });
                element.css({
                    //display: "block-inline",
                    //position: 'absolute',
                    width: "100%",
                    height: "100%"
                });
                 * */
                element.prepend(newElement);

                              
/*
                // Define SVG.
                var svg = d3.select(iElement[0])// Select "self"element.
                    .append("svg")// Prepare SVG content
                    .attr("width", "100%")// at full width.
                    .attr("height", "100%")// at full width.
                    .attr("viewBox", "0 0 1000 500")
                    .attr("preserveAspectRatio", "xMidYMid meet");
                
                var WIDTH = 1000;
                var HEIGHT = 500;
                
                svg.selectAll("*").remove();

                var myScale = d3.scale.linear()
                    .domain([scope.min, scope.max])
                    .range([-0.5 * Math.PI, 0.5 * Math.PI]);

                // GaugeArc
                var arcFunc = d3.svg.arc()
                    .innerRadius(WIDTH / 2 * 0.8 + 5)
                    .outerRadius(WIDTH / 2 - 10)
                    .startAngle(myScale(scope.min));
                var arc = svg.append("path")
                    .datum({ endAngle: myScale(scope.min) })
                    .attr("d", arcFunc)
                    .attr("transform", "translate(" + WIDTH / 2 + ", " + HEIGHT + ")")
                    .style("fill", "yellow");
                    
                // outerArc
                var outerArc = d3.svg.arc()
                    .innerRadius(WIDTH / 2 * 0.8)
                    .outerRadius(WIDTH / 2 - 5)
                    .startAngle(myScale(scope.min))
                    .endAngle(myScale(scope.max));
                svg.append("path")
                    .attr("d", outerArc)
                    .attr("transform", "translate(" + WIDTH / 2 + ", " + HEIGHT + ")")
                    .style("stroke-width", "10")
                    .style("stroke", "blue")
                    .style("fill-opacity", "0");
                    
                // valueText
                var label = svg.append("text")
                    .attr("font-size", WIDTH/10)
                    .attr("text-anchor", "middle")
                    .attr("alignment-baseline", "after-edge")
                    //.text(function (d) { return scope.value + "°C" })//scope.unit; })
                    .text("")
                    .attr("transform", "translate(" + WIDTH / 2 + ", " + HEIGHT + ")")
                    .style("fill", "blue");
                
                var valueLabel = svg.append("text")
                    .attr("font-size", WIDTH / 7)
                    .attr("text-anchor", "middle")
                    .attr("alignment-baseline", "after-edge")
                    .text("")
                    .attr("transform", "translate(" + WIDTH / 2 + ", " + (HEIGHT - 100) + ")")
                    .style("fill", "yellow");
                
                

                // Creates a tween on the specified transition's "d" attribute, transitioning
                // any selected arcs from their current angle to the specified new angle.
                function arcTween(transition, newAngle) {
                    
                    // The function passed to attrTween is invoked for each selected element when
                    // the transition starts, and for each element returns the interpolator to use
                    // over the course of transition. This function is thus responsible for
                    // determining the starting angle of the transition (which is pulled from the
                    // element's bound datum, d.endAngle), and the ending angle (simply the
                    // newAngle argument to the enclosing function).
                    transition.attrTween("d", function (d) {
                        
                        // To interpolate between the two angles, we use the default d3.interpolate.
                        // (Internally, this maps to d3.interpolateNumber, since both of the
                        // arguments to d3.interpolate are numbers.) The returned function takes a
                        // single argument t and returns a number between the starting angle and the
                        // ending angle. When t = 0, it returns d.endAngle; when t = 1, it returns
                        // newAngle; and for 0 < t < 1 it returns an angle in-between.
                        var interpolate = d3.interpolate(d.endAngle, newAngle);
                        
                        // The return value of the attrTween is also a function: the function that
                        // we want to run for each tick of the transition. Because we used
                        // attrTween("d"), the return value of this last function will be set to the
                        // "d" attribute at every tick. (It's also possible to use transition.tween
                        // to run arbitrary code for every tick, say if you want to set multiple
                        // attributes from a single function.) The argument t ranges from 0, at the
                        // start of the transition, to 1, at the end.
                        return function (t) {
                            
                            // Calculate the current arc angle based on the transition time, t. Since
                            // the t for the transition and the t for the interpolate both range from
                            // 0 to 1, we can pass t directly to the interpolator.
                            //
                            // Note that the interpolated angle is written into the element's bound
                            // data object! This is important: it means that if the transition were
                            // interrupted, the data bound to the element would still be consistent
                            // with its appearance. Whenever we start a new arc transition, the
                            // correct starting angle can be inferred from the data.
                            d.endAngle = interpolate(t);
                            
                            // Lastly, compute the arc path given the updated data! In effect, this
                            // transition uses data-space interpolation: the data is interpolated
                            // (that is, the end angle) rather than the path string itself.
                            // Interpolating the angles in polar coordinates, rather than the raw path
                            // string, produces valid intermediate arcs during the transition.
                            return arcFunc(d);
                        };
                    });
                }
*/
            }
        }
    }
]);
