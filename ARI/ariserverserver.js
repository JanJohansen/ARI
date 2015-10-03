"use strict";

var AriServerServer = module.exports.AriServerServer = function (options) {
    this._server = options.ariServer;
    this.name = options.name || "ari";

    this._server.clientsModel[this.name] = {
        "name": this.name, 
        "online": true, 
        "__clientServer": this,
        "functions": {}
    };
    
    // register all functions exposed to ari from the server!
    var fIdent = "_webcall_";
    for (var func in this) {
        if (func.substring(0, fIdent.length) == fIdent) {
            var fname = func.substring(fIdent.length);
            this._server.clientsModel[this.name].functions[fname] = {"name": fname};
        }
    }

    this.provideValues();
}

AriServerServer.prototype._call = function (command, parameters, callback) {
    if (command == "CALLRPC") {
        var rpcName = parameters.name;
        if (!rpcName) {
            console.log("Error: Missing name of RPC to call! - Ignoring...");
            callback("Error: Missing name of RPC to call at client!", null);
            return;
        }
        
        if (!"_webcall_" + rpcName in this) {
            console.log("Error: Name of RPC unknown.");
            callback("Error: RPC unkknown at client!", null);
            return;
        }

        // Call local function.
        this["_webcall_" + rpcName](parameters.params, callback);
    }
}

// Server provided functions. *************************************************

//-----------------------------------------------------------------------------
// Return array of clients.
AriServerServer.prototype._webcall_listClients = function (parameters, callback) {
    var result = [];
    for (var key in this._server.clientsModel) {
        var client = this._server.clientsModel[key];
        result.push({"name": client.name, "online": client.online});
    }

    callback(null, result);
}

// Return entire model of client.
AriServerServer.prototype._webcall_getClientInfo = function (parameters, callback) {
    var client = this._server.clientsModel[parameters.clientName];
    

    callback(null, client);
}

// Server provided values. ****************************************************
AriServerServer.prototype.provideValues = function () {
    var self = this;
    setInterval(function () {
        self._server.publish("ari.time", new Date().toISOString());
    }, 1000);
}

