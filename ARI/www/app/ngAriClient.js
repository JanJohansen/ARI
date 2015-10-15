
var app = angular.module('ari');
app.service('AriClient', ["AriUser",
    function (AriUser) {
        
        var self = {};

        self.create = function (name) {
            var ari = new AriClient(name);
            ari.connect(AriUser.token);
            return ari;
        }
        return self;
    }
]);
