'use strict';

var app = angular.module('ari');
app.directive('guibElement', ["$window", "$document", "$uibModal", "$ocLazyLoad", "$compile",
    function ($window, $document, $uibModal, $ocLazyLoad, $compile) {
        return {
            restrict: 'E',
            //transclude: true,
            // NO ISOLATE SCOPE - parent scope is used!
            templateUrl: "plugins/gui-builder/guiBElement.html",
            link: function (scope, element, attrs, ctrl, transclude) {
                
                var uiElement = undefined;

                console.log("Linking GUIB-Elementr.", scope);
                //console.log("widgetModel:", scope.widgetModel);
                //console.log("GUIBElement scope:", scope);

                // Debug:
                scope.ThisIs = "GUIBElement";
                
                // watch for data changes and re-render if changed.
                scope.$watch('widgetModel', function (newVal, oldVal) {
                    if (!newVal) return;
                    console.log("watch widgetModel:", scope.widgetModel);
                    //compileValues();
                }, true);
                
                // watch for data changes and re-render if changed.
                scope.$parent.$watch('editor.editMode', function (value) {
                    console.log("$parent.editor.editMode:", value);
                    if (uiElement) {
                        if (value) {
                            uiElement.css({
                                border: "1px solid rgba(255, 0, 0, .3)",
                                "pointer-events": "none"
                            });
                        } else {
                            uiElement.css({
                                border: "",
                                "pointer-events": ""
                            });
                        }
                    }
                });

                scope.$watch('widgetModel', function (newVal, oldVal) {
                    if (!newVal) return;
                    console.log("watch widgetModel:", scope.widgetModel);
                    //compileValues();
                }, true);
                
                // Lazy load gui element to show, according to config.
                $ocLazyLoad.load(scope.widgetModel.controller).then(function () {
                    
                    var ariValuesString = "";
                    var elementString = "<" + scope.widgetModel.name + " ";
                    for (var attribute in scope.widgetModel.attributes) {
                        elementString += attribute;
                        elementString += "=\"_";
                        elementString += attribute;
                        elementString += "\" ";
                        
                        // Create ari-value for all attributes to convert from "expressions" entered in editor, to either raw values, or to get from ari srever...
                        ariValuesString += "<ari-value name=\"{{widgetModel.attributes." + attribute + ".expression}}\" value=\"_" + attribute + "\" ></ari-value>\n";
                    }
                    elementString += "></" + scope.widgetModel.name + ">\n";
                    
                    // Compile element w. angulars $compile and add to DOM.
                    var newAriElement = $compile(ariValuesString)(scope);
                    element.prepend(newAriElement);

                    uiElement = $compile(elementString)(scope);
                    uiElement.css({
                                "pointer-events": "all"
                            });
                    element.prepend(uiElement);

                }, function (e) {
                    console.log("Error:", e);
                });
                
                // Functions --------------------------------------------------                
                scope.editWidget = function () {
                    scope.$parent.editWidget(scope.widgetModel);
                }
                
                scope.deleteWidget = function (element) {
                    scope.$parent.deleteWidget(scope.widgetModel);
                }
                
                // Defaults...
                if (!scope.widgetModel.left) scope.widgetModel.left = 100;
                if (!scope.widgetModel.top) scope.widgetModel.top = 100;
                if (!scope.widgetModel.width) scope.widgetModel.width = 100;
                if (!scope.widgetModel.height) scope.widgetModel.height = 100;
                
                // Handle draggability ----------------------------------------
                var startX = 0, startY = 0;
                //var computedStyle = getComputedStyle(element[0], null)
                var left = parseInt(scope.widgetModel.left);
                var top = parseInt(scope.widgetModel.top);
                var width = parseInt(scope.widgetModel.width);
                var height = parseInt(scope.widgetModel.height);
                var gridSpacing = 10;
                var action = "idle";
                
                // Set initial conditions.
                element.css({
                    position: 'absolute',
                    cursor: 'pointer',
                    left: left + "px",
                    top: top + "px",
                    width: width + "px",
                    height: height + "px"//,
                    //border: "1px solid rgba(255, 0, 0, .3)",
                    //"pointer-events": "none"
                });
                element[0].children.elementMenu.style.display = "none";

                // Store config in elementConfig.
                scope.widgetModel.left = left;
                scope.widgetModel.top = top;
                scope.widgetModel.width = width;
                scope.widgetModel.height = height;
               
                
                // Move to grid.
                /*
                console.log(left, top, width, height);
                console.log(element[0].offsetWidth);left = left - (left % gridSpacing);
                top = top - (top % gridSpacing);
                width = width - (width % gridSpacing);
                height = height - (height % gridSpacing);
                element.css({
                    top: top + "px",
                    left: left + 'px',
                    height: height + "px",
                    width: width + "px",
                    border: "1px solid rgba(255, 0, 0, .3)"
                });
                element[0].children.elementMenu.style.display = "none";
                console.log(left, top, width, height);
                */
                

                element.on('mousemove', handleMove);
                //element.on('mousedown', handleDown);
                element[0].addEventListener("mousedown", handleDown, true); // Use addEventListener instead of element.on("... to allow catching the event during the capture phase (as opposed to the bubbling phase!)
                scope.editor.editMode = scope.editor.editMode || false;
                function handleDown(event){
                    console.log("guibElem-ButtonMouseDown!");
                    if (scope.$parent.editor.editMode) {
                        console.log("preventDefault!");
                        event.preventDefault();     // Prevent default event for selected content
                        event.stopPropagation();
                        $document.on('mouseup', handleUp);
                        $document.on('mousemove', handleMove);
                        element.off('mousemove', handleMove);
                        
                        startX = event.pageX - left;
                        startY = event.pageY - top;
                        
                        var cursor = element.css("cursor");
                        if (cursor == "move") action = "moving";
                        else if (cursor == "n-resize") action = "resizeTop";
                        else if (cursor == "e-resize") action = "resizeRight";
                        else if (cursor == "s-resize") action = "resizeBottom";
                        else if (cursor == "w-resize") action = "resizeLeft";
                        //console.log("Action:", action);
                    }
                    else {
                        console.log("useDefault!");
                    }
                }
                
                function handleMove(event) {
                    if (scope.$parent.editor.editMode) {
                        if (action == "moving") {
                            left = event.pageX - startX;
                            top = event.pageY - startY;
                            
                            left = left - left % gridSpacing;
                            top = top - top % gridSpacing;
                            
                            element.css({
                                top: top + 'px',
                                left: left + 'px'
                            });
                            scope.widgetModel.top = top;
                            scope.widgetModel.left = left;

                        } else if (action == "resizeTop") {
                            var origTop = top;
                            top = event.pageY;
                            top = top - (top % gridSpacing);
                            height += origTop - top;
                            element.css({
                                top: top + "px",
                                height: height + "px"
                            });
                            scope.widgetModel.top = top;
                            scope.widgetModel.height = height;

                        } else if (action == "resizeRight") {
                            width = event.pageX - parseInt(element.css("left"));
                            width = width - (width % gridSpacing);    // Quantize to snap to grid.
                            element.css({
                                width: width + "px"
                            });
                            scope.widgetModel.width = width;

                        } else if (action == "resizeLeft") {
                            var origLeft = left;
                            left = event.pageX;
                            left = left - (left % gridSpacing);
                            width += origLeft - left;
                            element.css({
                                width: width + "px",
                                left: left + "px"
                            });
                            scope.widgetModel.width = width;
                            scope.widgetModel.left = left;

                        } else if (action == "resizeBottom") {
                            height = event.pageY - top;
                            height = height - (height % gridSpacing);    // Quantize to snap to grid.
                            element.css({
                                height: height + "px"
                            });
                            scope.widgetModel.height = height;

                        } else {
                            // Mouse poition within client.
                            var clientX = event.pageX - element.offset().left;
                            var clientY = event.pageY - element.offset().top;
                            
                            // Change cursor according to position - indicating drag, move, etc.
                            if (clientY < 0 || clientX < 0) element.css({ cursor: '' });   // Outside element.
                            else if (clientX < 10) element.css({ cursor: 'w-resize' });
                            else if (clientX > (width - 10)) element.css({ cursor: 'e-resize' });
                            else if (clientY < 10) element.css({ cursor: 'n-resize' });
                            else if (clientY > (height - 10)) element.css({ cursor: 's-resize' });
                            else element.css({ cursor: 'move' });
                        }
                        scope.$apply(); // "Hack" to force update of watches set on child elements being resized.!!!
                    }
                }
                
                function handleUp() {
                    if (scope.$parent.editor.editMode) {
                        $document.off('mouseup', handleUp);
                        
                        $document.off('mousemove', handleMove);
                        element.on('mousemove', handleMove);
                        action = "idle";
                        element.css({ cursor: 'pointer' });
                        
                        element.css("border", "1px solid rgba(255, 0, 0, .3)");
                        //element[0].children.elementMenu.style.display = "none";
                    }
                }

                // Mark element under mouse.
                element.on('mouseenter', function (event) {
                    if (scope.$parent.editor.editMode) {
                        element.css("border", "1px solid rgba(255, 0, 0, 1)");
                        element[0].children.elementMenu.style.display = "inline-block";
                    }
                });
                
                element.on('mouseleave', function (event) {
                    if (scope.$parent.editor.editMode) {
                        if (action == "idle") {  // Only disable highlight when idle to prvent flickering when resizing!
                            element.css("border", "1px solid rgba(255, 0, 0, .3)");
                            element[0].children.elementMenu.style.display = "none";
                        }
                    }
                });
            }
        }
    }
]);

