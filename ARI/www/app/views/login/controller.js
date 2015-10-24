'use strict';

var ariModule = angular.module('ari');
ariModule.register.controller('loginController', function ($scope, $http, AriUser, $location, $window) {
    $scope.user = {};
    
    $scope.createUser = function () {
        $http.post('/api/users/login', $scope.user).success(function (data) {
            if (data.authToken) {
                AriUser.set($scope.user.name, data.authToken);
                $location.path("/");
            } else {
                AriUser.clear();
            }
        }).error(function (data, status, headers, config) {
            // called asynchronously if an error occurs
            // or server returns response with an error status.
            AriUser.clear();
        });
    }
});
