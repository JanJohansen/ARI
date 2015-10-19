
var app = angular.module('ari');
app.service('AriClient', ["AriUser",
    function (AriUser) {
        
        var self = {};
        var instance = null;

        self.create = function (name) {
            var ari = new AriClient(name);
            ari.connect(AriUser.token);
            return ari;
        }
        self.getInstance = function (name) {
            if (!instance) {
                instance = new AriClient(name);
                instance.connect(AriUser.token);
            }
            return instance;
        }
        return self;
    }
]);
