"use strict";

var fs = require('fs');

var AriServerServer = module.exports.AriServerServer = function (options) {
    this._server = options.ariServer;
    this.name = options.name || "ari";

    this.clientModel = {
        "name": this.name, 
        "online": true, 
        "__clientServer": this,
        "values": {
            "serverStart": { "description": "Time when server started last time." },
            "time": { "description": "Current server time." }
        },
        "functions": {}
    };
    
    this._server.clientModels[this.name] = this.clientModel;
    
    // register all functions exposed to ari from the server!
    var fIdent = "_webcall_";
    for (var func in this) {
        if (func.substring(0, fIdent.length) == fIdent) {
            var fname = func.substring(fIdent.length);
            this.clientModel.functions[fname] = {"name": fname};
        }
    }
    
    this.provideValues();
}

AriServerServer.prototype._call = function (command, parameters, callback) {
    if (command == "CALLFUNCTION") {
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

// Server provided values. ****************************************************
AriServerServer.prototype.provideValues = function () {
    var self = this;
    
    this.serverStarted = new Date().toISOString();
    self._server.handleValue("ari.serverStart", this.serverStarted);

    this.provideTime(0); // Starts providing time.
}

// Provide time when milliseconds == 0,
AriServerServer.prototype.provideTime = function (interval) {
    var self = this;
    setTimeout(function () {
        var date = new Date();
        var ms = date.getMilliseconds();
        /*if(ms > 500) self.provideTime(2000 - ms);
        else self.provideTime(1000 - ms);*/
        self.provideTime(1000 - ms);
        
        // This function might run two times if ms ~999, so only report time when ms<500.
        if (ms < 500) {
            //date.setMilliseconds(0);    // Just show 000 since we should be very close and not drifting!
            self._server.handleValue("ari.time", date.toISOString());
        }

    }, interval);
}

//*****************************************************************************
// Server provided functions. *************************************************

//-----------------------------------------------------------------------------
// Return array of clients.
AriServerServer.prototype._webcall_listClients = function (parameters, callback) {
    var result = [];
    for (var key in this._server.clientModels) {
        var client = this._server.clientModels[key];
        result.push({"name": key, "online": client.online});
    }
    callback(null, result);
}

// Return entire model of client.
AriServerServer.prototype._webcall_getClientInfo = function (parameters, callback) {
    var client = this._server.clientModels[parameters.clientName];
    if (client) callback(null, client);
    else callback("Error: Unknown client name!", null);
}

//-----------------------------------------------------------------------------
// Return array of clients.
AriServerServer.prototype._webcall_getLoggingConfig = function (parameters, callback) {
    callback(null, { "loggingConfig": this._server.loggingConfig });
}

AriServerServer.prototype._webcall_setLoggingConfig = function (parameters, callback) {
    this._server.loggingConfig = parameters.loggingConfig;
    callback(null, {});
}

AriServerServer.prototype._webcall_listLogs = function (parameters, callback) {
    
    var logsPath = __dirname + "/" + this._server.loggingConfig.logFilePath;
     //+ key + "_" + dateString + ".log"; // e.g. "./logs/ari.time_20151001.log"
    var logs = [];
    fs.readdir(logsPath, function (err, files) {
        if (err) { callback(err, null); return; }

        files.forEach(function (file) {
            logs.push(file);
        });
        callback(null, logs);
    });
}

AriServerServer.prototype._webcall_getLog = function (parameters, callback) {
    
    // TODO: implement time limits for getting logs, and combine multiple files into one reply!
    
    if (!parameters.name) { callback("Error: Missing name!", null); return; }

    var logsPath = __dirname + "/" + this._server.loggingConfig.logFilePath;
    var fileName = parameters.name;// + "_" + dateString + ".log"; // e.g. "./logs/ari.time_20151001.log"
    fs.readFile(logsPath + "/" + fileName, "utf8", function (err, data) {
        //if (err) throw err;
        callback(null, data);
    });    
    
}

