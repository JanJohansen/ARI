'use strict';

var ariModule = angular.module('ari');
console.log("calling client/controller.");
ariModule.register.controller('clientsController', function ($scope) {
    console.log("clients.html loaded");//, clientsModule);
    console.log("clients.$scope = ", $scope);
});

