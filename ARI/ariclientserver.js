"use strict";

var jwt = require('jwt-simple');

var AriClientServer = module.exports.AriClientServer = function (options) {
    var self = this;
    this._pendingCallbacks = {};
    this._server = options.ariServer;
    this._ws = options.websocket;
    this.name = "";
    this._functions = {};
    this._subscriptions = {};
    this.clientModel = null;    // This will be set upon authentification.
    
    //this._server.clients.push(this);   // Put into list of connected clients.

    this._ws.on("message", function (message) {
        // !!! USE "SELF" !!!
        
        // DEBUG!
        console.log('-->', message);

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
    if (!this.clientModel) return;  // Probably logged without calling connect!
    if (this.clientModel._role == "guest") {
        if (!this.clientModel.pendingAuthorization) {   // If authorization is  pending we still need to persist client data!
            // remove client (e.g. don't persist!)
            delete this._server.clientsModel[this.name];
        }
    }
    else {
        // persist, but mark as offline!
        this.clientModel.online = flase;
        this.clientModel.__clientServer = null;
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
AriClientServer.prototype._webcall_CONNECT = function (pars, callback) {
    if (!pars.name) { console.log("Error: Missing name of client whentrying to register client! - Ignoring..."); return; }
    
    var clientToken = pars.clientToken;
    if (clientToken) {
        // Try to decode token.
        try { var payload = jwt.decode(clientToken, this._server.JWTSecret); }
        catch (e) { };
        if (!payload) {
            callback("Error: Invalid token!", null);
            return;
        } else {
            this.name = payload.clientName;
            // Link this client to clientModel indicating an authenticated client.
            this.clientModel = this._server.clientsModel[this.name];
            if (this.clientModel) {
                // check date match. (This allows to invalidate tokens based on date and not just on clientName.!!!)
                if (this.clientModel.created != payload.created) {
                    this.clientModel = null;    // De-Authenticate!!!
                    console.log("Error: Authentication failed! Ivalid creation date!", payload);
                    callback("Error: Authentication failed! Ivalid creation date!", null);
                    return;
                } else {
                    // Authentication OK and client model linked.
                    console.log("authentication success:", payload);
                    callback(null, { "name": this.name });
                    return;
                }
            }
            else {
                console.log("Error: Token invalid. ClientName not found!", payload);
                callback("Error: Token invalid. ClientName not found!", null);
                return;
            }
        }
    } else {
        // No clientToken given. This could be first time connection.
        // Find available name based on defaultName. (add (x) if allready existing!)
        var defaultName = pars.name;
        this.name = defaultName;
        var count = 1;
        while (true) {
            if (!this._server.clientsModel[this.name]) break;
            this.name = defaultName + "(" + count + ")";
            count++;
        }
        
        if (!this.clientModel) {
            // First time creation if not found. 
            // Set name and status and keep updated from now on!
            this.clientModel = {
                "name": this.name, 
                "created": new Date().toISOString(),
                "online": true,
                "_role": "guest",
                "__clientServer": this,
                "functions": {},
                "values": {}
            };
            this._server.clientsModel[this.name] = this.clientModel;
            console.log("First time authentication success:", payload);
            callback(null, { "name": this.name });
        }
    }
};

AriClientServer.prototype._webcall_REQCLIENTTOKEN = function (pars, callback) {
    this.clientModel.pendingAuthorization = true;
    var payload = { "clientName": this.name, "created": this.clientModel.created };
    var token = jwt.encode(payload, this._server.JWTSecret);
    callback(null, {"clientToken": token});
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
