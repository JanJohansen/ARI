'use strict';

// Declare app level module which depends on views, and components
var ariModule = angular.module('ari', ['ngRoute', 'ngAnimate']);

ariModule.controller('ariMainController', ['$scope', '$http', function ($scope, $http) {
    $http.get('api/users').success(function (data) {
        $scope.users = data;
    });
}]);

ariModule.directive('animateOnChange', function ($animate, $timeout) {
    return function (scope, elem, attr) {
        scope.$watch(attr.animateOnChange, function (newVal, oldVal) {
            $animate.addClass(elem, "change").then(function () {
                $timeout(function () { $animate.removeClass(elem, "change") });
            });
        })
    }
})

ariModule.config(function ($controllerProvider, $compileProvider, $filterProvider, $provide) {
    ariModule.register = {
        controller: $controllerProvider.register,
        directive: $compileProvider.directive,
        filter: $filterProvider.register,
        factory: $provide.factory,
        service: $provide.service
    };
});

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
        .when('/plugins/:plugin', {
            templateUrl: function (rd) {
                return 'plugins/' + rd.plugin + '/index.html';
            },
            resolve: {
                load: function ($q, $route, $rootScope) {
                    
                    var deferred = $q.defer();
                    
                    var dependencies = [
                        'plugins/' + $route.current.params.plugin + '/controller.js'
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
