var app = angular.module('ari');
app.service('AriUser', ["$window",
    function ($window) {
        console.log("Creating ngUser singleton!");
        
        var user = {};
        user.name = $window.localStorage['userName'] || "???";
        user.token = $window.localStorage['userToken'] || null;
        
        user.set = function (name, token){
            user.name = $window.localStorage['userName'] = name;
            user.token = $window.localStorage['userToken'] = token;
        }
        
        user.clear = function (){
            user.name = "?";
            $window.localStorage.removeItem('userName');
            user.token = null;
            $window.localStorage.removeItem('userToken');
        }     
        
        return user;
    }
]);
