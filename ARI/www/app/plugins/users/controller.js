'use strict';

console.log("Regisering users/controller.");

var ariModule = angular.module('ari');
ariModule.register.controller('usersController', function ($scope, $http) {
    
    console.log("users.html loaded");//, clientsModule);

    $http.get('api/users').success(function (data) {
        $scope.users = data;
    });
});
