'use strict';

// Declare app level module which depends on views, and components
var ariModule = angular.module('ari', ['ngRoute', 'ngAnimate', 'ui.bootstrap']);

ariModule.controller('ariMainController', ['$scope', '$http', 'AriUser', '$uibModal',
    function ($scope, $http, AriUser) {
        $scope.user = AriUser;
    }
]);


//-----------------------------------------------------------------------------
// Interceptor to allow authentication on server.
ariModule.config(['$httpProvider',
    function ($httpProvider) {
        $httpProvider.interceptors.push(function (AriUser) {
            return {
                "request": function (config) {
                    var token = AriUser.token;
                    //if (config.url.indexOf("api/") === 0 && token) { // Limit to aip section???
                    if (token) {    // If user is authenticated with a token, send it along requests.
                        config.headers.auth = token;
                    }
                    return config;
                },
                "response": function (response) {
                    //if (response.config.url.indexOf(API) === 0 && response.data.token) { // Limit to aip section???
                    if (response.data.token) {
                        // if we get a new token in a response from server, use this from now on. (Can be used to keep alive time limited authorizations.)
                        AriUser.token = res.data.token;
                    }
                    return response;
                }
            };
        });
    }
]);

//-----------------------------------------------------------------------------
// animate on change directive.
ariModule.directive('animateOnChange', function ($animate, $timeout) {
    return function (scope, elem, attr) {
        scope.$watch(attr.animateOnChange, function (newVal, oldVal) {
            $animate.addClass(elem, "change").then(function () {
                $timeout(function () { $animate.removeClass(elem, "change") });
            });
        })
    }
})

//-----------------------------------------------------------------------------
// For dynamic loading of "views", we need to make providers available... or something... :O)
ariModule.config(function ($controllerProvider, $compileProvider, $filterProvider, $provide) {
    ariModule.register = {
        controller: $controllerProvider.register,
        directive: $compileProvider.directive,
        filter: $filterProvider.register,
        factory: $provide.factory,
        service: $provide.service
    };
});

// Routes for "hash"'es.
ariModule.config(['$routeProvider',
    function ($routeProvider) {
        $routeProvider.
        when('/users', {
            templateUrl: 'views/users.html',
            controller: 'usersController'
        }).
        when('/clients', {
            templateUrl: 'views/clients.html',
            controller: 'clientsController'
        })
        // Dynamic view loading from "views" folder @ runtime.
        .when('/views/:view', {
            templateUrl: function (rd) {
                return 'views/' + rd.view + '/index.html';
            },
            resolve: {
                load: function ($q, $route, $rootScope) {

                    var deferred = $q.defer();

                    var dependencies = [
                        'views/' + $route.current.params.view + '/controller.js'
                    ];

                    $script(dependencies, function () {
                        $rootScope.$apply(function () {
                            deferred.resolve();
                        });
                    });

                    return deferred.promise;
                }
            }
        })
        .when('/plugins/:plugin/:view', {
            templateUrl: function (rd) {
                return "plugins/" + rd.plugin + "/" + rd.view + ".html";
            },
            resolve: {
                load: function ($q, $route, $rootScope) {

                    var deferred = $q.defer();

                    var dependencies = [
                        "plugins/" + $route.current.params.plugin + "/" + $route.current.params.view + '.js'
                    ];

                    $script(dependencies, function () {
                        $rootScope.$apply(function () {
                            deferred.resolve();
                        });
                    });

                    return deferred.promise;
                }
            }
        }).
        otherwise({
            redirectTo: '/'
        });
    }
]);
