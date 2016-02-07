"use strict";

// ARI (Automation Routing Infrastructure)
//var SortedObjectArray = require("./sorted-object-array");
var AriClientServer = require("./ariclientserver.js").AriClientServer;
var AriServerServer = require("./ariserverserver.js").AriServerServer;
var ConfigStore = require("./configStore.js");
var fs = require('fs');
var net = require('net');

var Ari = module.exports.Ari = function (options) {
    var self = this;
    this._wss = options.websocketServer;
    this.pendingClients = {};       // new SortedObjectArray('name');   // List of clients awaiting approval
    
    // Load config.    
    var configStore = new ConfigStore(__dirname, "ari_config");
    var config = configStore.load();
    
    // Load state.
    this.stateStore = new ConfigStore(__dirname, "ari_state");
    var state = this.stateStore.load();
    
    this.JWTSecret = config.JWTSecret || 'AriSecret';
    
    this.clientModels = state.clients || {};
    this.userModels = state.users || {};

    this.loggingConfig = state.loggingConfig || { "values": {} };
    this.logs = {};
    
    // DEBUG!!!!
    this.loggingConfig = {
        "values": { "*": {} },
        "saveInterval": "10",
        "logFilePath": "www/app/logs/"
    };
    
    // Save log every at intervals
    setInterval(this.saveLog.bind(this), this.loggingConfig.saveInterval * 60 * 1000);

    // serverServer represents the server API, etc.
    var serverServer = new AriServerServer({ "ariServer": this, "name": "ari" });
        
    this._wss.on('connection', function connection(ws) {
        // Use "SELF!
        // Create AriClientServer to handle serving of this client.
        var clientServer = new AriClientServer({ ariServer: self, websocket: ws });
        ws.on("close", clientServer.handleClose);
        ws.on("error", clientServer.handleClose);
        ws.on("message", clientServer.handleMessage);
        clientServer.onSendMessage = function (msg) { 
            if (ws.readyState !== ws.OPEN) {
                console.log('ERROR!!! - WS not opened');
            }
            else ws.send(msg);
        }
    });
    
    
    //-------------------------------------------------------------------------
    // Start a TCP Server
    var server = net.createServer();
    server.listen(5000);
    console.log('TcpServer listening on ' + server.address().address + ':' + server.address().port);
    server.on('connection', function (socket) {
        
        console.log("TcpServer:", socket.name, "connected.");
        var clientServer = new AriClientServer({ ariServer: self, websocket: socket });
        socket.on("end", clientServer.handleClose);
        socket.on("error", clientServer.handleClose);
        clientServer.onSendMessage = function (msg) {
            socket.write(msg);
        }
        
        var message = "";
        //var messagePos = 0;
        var bCount = 0;
        var msg = undefined;
        var brCount = 0;
        socket.on("data", function (data){
            var data = data.toString();
            //console.log("TCPData:", data.toString());
            for (var i = 0; i < data.length; i++) {
                if (data[i] == '{') brCount++;
                else if (data[i] == '}') brCount--;
                if (brCount == 0) {
                    message += data.substring(0, i+1);
                    data = data.slice(i + 1);
                    i = -1; // Will be incremented to 0 next for loop!

                    try {
                        msg = JSON.parse(message);
                    } catch (e) {
                        console.log("ERROR: Not correctky formatted JSON in message!");
                    }
                    
                    if (msg) {
                        console.log("Message:", message.toString());
                        clientServer.handleMessage(message);
                    }
                    message = "";
                    msg = undefined;
                }
            }
            if (brCount != 0) {
                message += data;    // Inbetween data chunks...
            }
        });
    });
};

/*****************************************************************************/
// Find alias.Return vlaue for alias if found. Return undefined if not found.
Ari.prototype.findValueByAlias = function (alias) {
    for (var cName in this.clientModels) {
        var values = this.clientModels[cName].values;
        if (values) {
            for (var vName in values) {
                var vAlias = values[vName].alias;
                if (vAlias && (vAlias == alias)) {
                    return cName + "." + vName;
                }
            }
        }
    }
    return undefined;
}

Ari.prototype.findValueByName = function (name) {
    var clientName = name.split(".")[0];
    
    // Find client.
    var client = this.clientModels[clientName];
    if (client) {
        var clientValueName = name.substring(name.indexOf(".") + 1);
        if (client.values) return client.values[clientValueName];
    }
    return undefined;
}


/*****************************************************************************/
// Main function called by all clients.!
Ari.prototype.callFunction = function (name, params, callback) {
    // Find client...
    var clientName = name.split(".")[0];
    
    // Find client.
    var client = this.clientModels[clientName];
    if (client) {
        if (client.__clientServer) {
            client.__clientServer.callFunction(name, params, callback);
        }
    }
}

// Main publish function called by all clients.!
Ari.prototype.publish = function (name, value) {
    
    // Store last value and time of update.
    var clientName = name.split(".")[0];
    var client = this.clientModels[clientName];
    if (client) {
        if (client.values) {
            var clientValueName = name.substring(name.indexOf(".") + 1);
            var clientValue = client.values[clientValueName];
            if (clientValue) {
                clientValue.last = value;
                clientValue.updated = new Date().toISOString();
            }
        }
    }
    
    // Find all subscribing and connected clients and notify...
    for (var key in this.clientModels) {
        var client = this.clientModels[key];
        if (client) {
            if (client.online == true) {
                var cs = client.__clientServer;
                if (cs) {
                    for (var subName in cs._subscriptions) {
                        if (this.matches(subName, name)) {
                            cs._notify("PUBLISH", { "name": name , "value": value });
                        }
                    }
                }
            }
        }
    }
}

// Main setValue function called by all clients.!
// For now allow to try to set any value even nonregistered values!
Ari.prototype.setValue = function (name, value) {
    //console.log("setValue:", name, "=", value);
    
    // Check if this is an alias. Use name if it is.
    var vName = this.findValueByAlias(name);
    if (vName) name = vName;

    
    // Find client.
    var clientName = name.split(".")[0];
    var client = this.clientModels[clientName];
    if (client) {
        if (client.__clientServer) {
            // Remove client name and notify setValue...
            name = name.substring(name.indexOf(".") + 1);
            client.__clientServer._notify("SETVALUE", { "name": name , "value": value });
        }
    }
}

// Main getValue function called by all clients.!
Ari.prototype.getValue = function (name, callback) {
    
    // Check if this is an alias. Use name if it is.
    var vName = this.findValueByAlias(name);
    if (vName) name = vName;
    
    // Find client.
    var clientName = name.split(".")[0];
    var client = this.clientModels[clientName];
    if (client) {
        if (client.values) {
            // Removeo client name and setValue...
            name = name.substring(name.indexOf(".") + 1);
            if (client.values[name]) callback(null, { "name": name, "value": client.values[name].value });
            else callback("Value name not found on client", null);
        }
    }
    else callback("Client for getValue not found.", null);
}

// Main handleValue function called by all clients.!
Ari.prototype.handleValue = function (name, value) {
    
    // Store last value and time of update.
    var clientName = name.split(".")[0];
    var client = this.clientModels[clientName];
    if (client) {
        if (client.values) {
            var clientValueName = name.substring(name.indexOf(".") + 1);
            var clientValue = client.values[clientValueName];
            if (clientValue) {
                clientValue.value = value;
                clientValue.updated = new Date().toISOString();
            }
        }
    }
    
    // This would be a good place to log values...
    for (var key in this.loggingConfig.values) {
        var loggingConfig = this.loggingConfig.values[key];
        if (this.matches(key, name)) {
            if (!this.logs[name]) this.logs[name] = []; // Create if not exists.
            var ds = new Date().getTime();
            this.logs[name].push({ "t": ds, "v": value });
        }
    }
    
    var v = this.findValueByName(name);
    if (v && v.alias) var alias = v.alias;
   
    // Find all clients watching value and notify.
    for (var key in this.clientModels) {
        var clientModel = this.clientModels[key];
        if (clientModel._watches) {
            for (var watch in clientModel._watches) {
                var cs = clientModel.__clientServer;
                if (cs) {
                    if (this.matches(watch, name)) {    // Check NAME
                        cs._notify("VALUE", { "name": name , "value": value });
                    }
                    if (alias && this.matches(watch, alias)) {   // Check ALIAS
                        cs._notify("VALUE", { "name": alias , "value": value });
                    }
                }
            }
        }
    }
}


/*****************************************************************************/
// Match possible wildcarded strA to strB.
Ari.prototype.matches = function(strA, strB)
{
    if (strA == strB) return true;
    var aPos = strA.indexOf('*');
    if (aPos >= 0) {
        var aStr = strA.substring(0, aPos);
        if (aStr == strB.substring(0, aPos)) return true;
    }
    return false;
}

// Main set function called by all clients.!
Ari.prototype.set = function (name, value) {

}


/*****************************************************************************/
Ari.prototype.shutDown = function () {
    // Store state...
    var state = {
        "clients": this.clientModels , 
        "users": this.userModels,
        "loggingConfig": this.loggingConfig
    };
    this.stateStore.save(state);

    this.saveLog(true);
}

/*****************************************************************************/
// Store logs for individual values in individual files named "valueName-date" with a timestam and a avalue separated by comma.
// TODO: Convert this to an async function!
Ari.prototype.saveLog = function(synchronous) {
    // Make sure there is a log folder.!
    try { fs.mkdirSync(__dirname + "/" + this.loggingConfig.logFilePath); } catch (e) { };  // Ignore exception (dir already exists!)
        
    //var d = new Date();
    //var dateString = (new Date()).toISOString().replace(/[^0-9]/g, "").substring(0,8);  // Daily file...

    for (var key in this.logs) {
        //var fileName = __dirname + "/" + this.loggingConfig.logFilePath + key + "_" + dateString + ".log"; // e.g. "./logs/ari.time_20151001.log"
        var fileName = __dirname + "/" + this.loggingConfig.logFilePath + key.replace("/", "_") + ".log";
        
        var log = this.logs[key];   // Get reference to log...
        delete this.logs[key];// = [];        // Assign new empty array - this prevents race condition.
        
        var data = [];
        for (var i = 0; i < log.length; i++) {
            data[i] = JSON.stringify(log[i].t) + "," + JSON.stringify(log[i].v);
        }
        data = data.join("\n") + "\n";
        if(synchronous) fs.appendFileSync(fileName, data);
        else fs.appendFile(fileName, data, function () { });
        console.log("Log file written:", fileName)
    }
}
