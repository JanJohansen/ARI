"use strict";

var AriClientServer = module.exports.AriClientServer = function (options) {
    var self = this;
    this._server = options.ariServer;
    this._ws = options.websocket;
    this.name = "";
    this.functions = {};
    this.modules = {};

    this._ws.on("message", function (message) {
        // !!! Use "self" since "this" changes meaning when called from other owner of calling function in javascript!!!
        
        try { var msg = JSON.parse(message); }        
        catch (e) { console.log("Error: Illegal JSON in message! - Ignoring..."); return; }
        
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
                    self._ws.send(JSON.stringify(res));
                });
            } else {
                console.log("Error: Trying to call unknows webcall: ", functionName);
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

        }
    });

    this._ws.on("close", function () { 
        // !!! USE SELF
        // Destroy this???
        // TODO: Mark as offline???
        console.log("Client disconnected: ", self._givenName);
    });
};

AriClientServer.prototype._webcall_REGISTERMEMBER = function (pars, callback) {
    this[pars.path] = pars;


    /*
     * client.subs.Relay1
     * client.pubs.temp1
     * 
     * client.vals.Relay1 = 1
     * client.vals.temp1 = 23
     * client.rpcs.DoStuff1(...)
     *      
     * client.Relay1.value = 1
     * client.Relay1.description = "State of relay 1. Set to change state."
     * client.temp1 = 23
     * client.DoStuff(...)
     * */
};

AriClientServer.prototype._webcall_REGISTERCLIENT = function (pars, callback) {
    var clientDefaultName = pars.defaultName;
    if (!clientDefaultName) { console.log("Error: Missing name of client whentrying to register client! - Ignoring..."); return; }
    
    // Find GivenName based on DefaultName. (add (x) if allready existing!)
    var clientGivenName = clientDefaultName;
    var count = 1;
    while (true) {
        if (!this._server.clients[clientGivenName]) break;
        clientGivenName = clientDefaultName + "(" + count + ")";
        count++;
    }
    this._server.clients[clientGivenName] = this;
    this.name = clientGivenName;
    
    console.log("New device registered.");
    console.log("Device given name: ", this._givenName);
    
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

AriClientServer.prototype._webcall_REGISTERRPC = function (pars, callback) {
    console.log("RegisterRPC(", pars, ")");

    if (pars.name in this.functions) {
        console.log("Error: Trying to register RPC with existing name:", pars.name);
        callback("Error: Trying to register RPC with existing name:" + pars.name, null);
    } else {
        this.functions[pars.name] = pars;
        callback(null, {});
    }
}

AriClientServer.prototype._webcall_REGISTERMODULE = function (pars, callback) {
    console.log("RegisterModule(", pars, ")");
    
    if (pars.name.value in this.modules) {
        var err = "Error: Trying to register module with existing name:" + pars.name.value;
        console.log(err);
        callback(err, null);
    } else {
        this.modules[pars.name.value] = pars;
        callback(null, {});
    }
}

AriClientServer.prototype._webcall_MODULEUPDATE = function (pars, callback) {
    console.log("ModuleUpdate(", pars, ")");
    
    if (!pars.name.value in this.modules) {
        var err = "Error: Trying to update unknown module:" + pars.name.value;
        console.log(err);
        callback(err, null);
    } else {
        //this.modules[pars.name.value];
        callback(null, {});
    }
}


AriClientServer.prototype._webcall_CALLRPC = function (pars, callback) {
    var rpcName = msg.name;
    if (!rpcName) {
        console.log("Error: Missing name of RPC to call! - Ignoring...");
        return;
    }
    
    if (!this.functions.hasOwnProperty(rpcName)) {
        console.log("Error: Name of RPC not previously registered! - Ignoring...");
        return;
    }
    var rpc = this.functions[rpcName];
    var rpcFunc = rpc.func;
    
    var params = msg.params;
    
    // Call the local RPC                
    var result = rpcFunc(params);
    // send result back.
    this._ws.send(JSON.stringify({ rid: requestId, "cmd": "RPCRESULT", "result": result }));
};

AriClientServer.prototype.callRpc = function (name, params, callback) {
    // Send command telegram...    
    this._ws.send(JSON.stringify({ rid: this._nextRequestId, cmd: "CALLRPC", name: name, params: params }));
    
    // Store callback for returning results.
    this._pendingRpcs[this._nextRequestId].cb = callback;
    
    this._nextRequestId++;
};
