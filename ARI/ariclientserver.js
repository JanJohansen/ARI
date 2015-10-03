"use strict";

var AriClientServer = module.exports.AriClientServer = function (options) {
    var self = this;
    this._pendingCallbacks = {};
    this._server = options.ariServer;
    this._ws = options.websocket;
    this.name = "";
    this._functions = {};
    this._subscriptions = {};
    
    //this._server.clients.push(this);   // Put into list of connected clients.

    this._ws.on("message", function (message) {
        // !!! USE "SELF" !!!
        
        try { var msg = JSON.parse(message); }        
        catch (e) {
            console.log("Error: Illegal JSON in message! - Ignoring...");
            websocket.close(1002, "Protocol error.");
            handleClientDisconnect();
            return;
        }
        
        if ("req" in msg) {
            // Request message.
            var cmd = msg.cmd;
            if (!cmd) { console.log("Error: Missing comand in telegram! - Ignoring..."); return; };
            
            var functionName = "_webcall_" + cmd;
            if (functionName in self) {
                // Requested function name exists in this object. Call it...
                self[functionName](msg.pars, function (err, result) {
                    // reply with results...
                    var res = {};
                    res.res = msg.req;
                    res.err = err;
                    res.result = result;
                    self._ws.send(JSON.stringify(res, self.jsonReplacer));
                });
            } else {
                console.log("Error: Trying to call unknown webcall: ", functionName);
            }
        } else if ("res" in msg) {
            // Response message.
            var responseId = msg.res;
            // Get stored callback from calling function.
            msg.callback = self._pendingCallbacks[msg.res];
            delete self._pendingCallbacks[msg.res];
            msg.callback(msg.err, msg.result);
        } else {
            // Notofication message.
            var cmd = msg.cmd;
            if (!cmd) { console.log("Error: Missing comand in telegram! - Ignoring..."); return; };
            
            var functionName = "_webnotify_" + cmd;
            if (functionName in self) {
                // Requested notification function name exists in this object. Call it...
                self[functionName](msg.pars);
            }
        }
    });

    this._ws.on("close", function () { 
        // !!! USE SELF
        self.handleClientDisconnect();
        console.log("Client disconnected: ", self._givenName);
    });
};

AriClientServer.prototype.jsonReplacer = function (key, value) {
    //console.log("-- ", key, ",", value);
    if (key == undefined) return value;
    if (key.indexOf('_') == 0) return undefined;    // Don's show hidden members.
    return value;
}

AriClientServer.prototype.handleClientDisconnect = function () {
    console.log("Client disconnected.");
    if (this._server.clientsModel.hasOwnProperty(this.name)) {
        this._server.clientsModel[this.name].online = false;
        this._server.clientsModel[this.name].__clientServer = null;
    }
}

// Send msg to client
AriClientServer.prototype._wsSend = function (msg) {
    this._ws.send(msg);
}

// Call method on client...
AriClientServer.prototype._call = function (command, parameters, callback) {
    // TODO: Intercept for local rpc-functions (if we are "serverserver" as opposed to clientserver!)
    
    // Send msg.
    var msg = {};
    msg.req = this._nextReqId++;
    msg.cmd = command;
    msg.pars = parameters;
    this._pendingCallbacks[msg.req] = callback;
    this._wsSend(JSON.stringify(msg));
}

// Publish value to client...
AriClientServer.prototype._notify = function (command, parameters) {
    var msg = {};
    msg.cmd = command;
    msg.pars = parameters;
    this._wsSend(JSON.stringify(msg));
}

/*****************************************************************************/
AriClientServer.prototype._webcall_REGISTERCLIENT = function (pars, callback) {
    var clientDefaultName = pars.defaultName;
    if (!clientDefaultName) { console.log("Error: Missing name of client whentrying to register client! - Ignoring..."); return; }
    
    // Find "Given" name based on DefaultName. (add (x) if allready existing!)
    this.name = clientDefaultName;
    var count = 1;
    while (true) {
        if (!this._server.clientsModel[this.name]) break;
        this.name = clientDefaultName + "(" + count + ")";
        count++;
    }
    
    //------------------------------------------------------------------------
    // Create new "ClientInfo", set name and status. Keep updated from now on!
    this._server.clientsModel[this.name] = {
        "name": this.name, 
        "online": true, 
        "__clientServer": this,
        "functions": {}
    };
    
    console.log("New client registered:", this.name);
    
    // Set random key to identify correct client.
    // TODO: Generate random key!
    this._reRegisterKey = "secretKey";

    // Call callback even we executed synchronusly :O)
    callback(null, { "givenName": this.name, "reRegisterKey": this._reRegisterKey });
};

AriClientServer.prototype._webcall_REREGISTERCLIENT = function (pars, callback) {
    var clientId = pars.clientId;
    if (!clientId) { console.log("Error: Missing clientId when trying to re-register client - Ignoring..."); return; }
    
    if (clientId in this.clients) {
        // device found.
        console.log("Existing device registered.");
        consolde.log("Client Id: ", clientId);
        if (this.clients[clientId].name != name) {
            consolde.log("Name changed from ", this.devices[clientId].name, " to ", name);
            this.clients[clientId].name = name;
        }
        else consolde.log("Device name: ", this.devices[clientId].name);
    }
    else {
        console.log("Error - Given deviceId (", clientId, ") not known!");
        if (cb) cb("deviceId not found!");
        return;
    }
    
    // Call callback even we executed synchronusly :O)
    callback(null, {}); // Indicat OK!?
};

//-----------------------------------------------------------------------------
AriClientServer.prototype._webcall_REGISTERRPC = function (pars, callback) {
    console.log("RegisterRPC(", pars, ")");
    
    if (pars.name in this._server.clientsModel) {
        console.log("Error: Trying to register RPC with existing name:", pars.name);
        callback("Error: Trying to register RPC with existing name:" + pars.name, null);
    } else {
        this._server.clientsModel[this.name]._functions[pars.name] = pars;
    }
    callback(null, {});
}

// Client wants to call remote (or server local) RPC.
AriClientServer.prototype._webcall_CALLRPC = function (pars, callback) {
    var rpcName = pars.name;
    if (!rpcName) {
        console.log("Error: Missing name of RPC to call! - Ignoring...");
        callback("Error: Missing name of RPC to call! - Ignoring...", null);
        return;
    }
    
    // Find RPC in other connected clients, in offline clients, in server registered rpc's or even in own client! (Ping yourself ;O)
    var rpcNameParts = rpcName.split(".");
    // Find client
    var client = this._server.clientsModel[rpcNameParts[0]];
    if (client) {
        // Client found, now find rpc.
        var rpc = client.functions[rpcNameParts[1]];
        if (rpc) {
            if (client.online == false) {
                callback("Error: Target client for function call is offline.", null);
                return;
            } else {
                client.__clientServer._call("CALLRPC", { "name": rpcName.substring(rpcName.indexOf(".") + 1), "params": pars.params}, function (err, result) { 
                    callback(err, result);
                });
            }
        }
        else {
            callback("Error: Target function call not registered.", null);
            return;
        }
    }
    else {
        callback("Error: Target client for function call not registered.", null);
        return;
    }
};


/*AriClientServer.prototype.callRpc = function (name, params, callback) {
    // Send command telegram...    
    this._ws.send(JSON.stringify({ rid: this._nextRequestId, cmd: "CALLRPC", name: name, params: params }));
    
    // Store callback for returning results.
    this._pendingRpcs[this._nextRequestId].cb = callback;
    
    this._nextRequestId++;
};
*/

//-----------------------------------------------------------------------------
AriClientServer.prototype._webcall_SUBSCRIBE = function (pars, callback) {
    console.log("subscribe(", pars, ")");
    
    var name = pars.name;
    if (!name) { callback("Error: No name parameter specified!", null); return; }
    
    this._subscriptions[name] = {}; // Just indicate that there is a subscription to topic/value.
    callback(null, {});
}

AriClientServer.prototype._webcall_UNSUBSCRIBE = function (pars, callback) {
    console.log("unsubscribe(", pars, ")");
    
    var name = pars.name;
    if (!name) { callback("Error: No name parameter specified!", null); return; }
    
    delete this._subscriptions[name];
    callback(null, {});
}

AriClientServer.prototype._webnotify_PUBLISH = function (pars) {
    console.log("publish(", pars, ")");
    
    var valueName = pars.name;
    if (!valueName) {
        console.log("Error: Missing name of RPC to call! - Ignoring...");
        return;
    }
    this._server.publish(valueName, pars.value);
}
