"use strict";

if (typeof window === 'undefined') {
    // We're in NodeJS
    var WebSocket = require('ws');
}
else {
}

function AriClient(options) {
    // private
    var self = this;
    this._clientConfig = {};
    this._nextReqId = 0;
    this._pendingCallbacks = {};
    this._functions = {};
    this._models = {};
    this._pendingMsgs = [];
    this._clientConfig.defaultName = "Anonymous";
    this._url = "ws://localhost:3000/socket/";
    this._subscriptions = {};
    this._ws = null;
    
    if (typeof window !== 'undefined') this._url = "ws://" + window.location.host;
    if (options)
    {
        this._clientConfig.defaultName = options.defaultName;
        this._url = options.url;
    }
    
    //public
    //this.publicThing = 0;
    
    this._connect();   // This connects or reconnects to a server.
}

AriClient.prototype._connect = function () {
    var self = this;
    var reconnectInterval = 2000;

    // TODO: Load local configuration to identify as "previously logged in instance of view" - if exists...
    // Then try to re-register this client to continue "session" = "get session configuration"...
    
    // Create our websocket object with the address to the websocket
    // TODO: Set default WS URL if run in NodeJS to localhost?
    //var ws = new WebSocket("ws://localhost:8000/socket/");
    
    // Open socket!
    this._ws = new WebSocket(this._url);
    
    this._ws.onopen = function () {
        // !!! Use "self" since "this" changes context when called from other owner of calling function in javascript!!!
        
        // Send if we have stored msg's...
        for (var i = 0; i < self._pendingMsgs.length; i++) {
            self._ws.send(self._pendingMsgs[i]);
        }
        self._pendingMsgs = [];
    };
    
    this._ws.onmessage = function (message) {
        // !!! Use "self" since "this" changes context when called from other owner of calling function in javascript!!!
        self._handleMessage(message);
    };

    this._ws.onerror = function () {
        console.log('Socket error... Will try to reconnect...');
        self._ws.terminate();
        self._ws = null;
        setTimeout(self._connect.bind(self), reconnectInterval);
    };

    this._wsclose = function () {
        console.log('Socket closed... Will try to reconnect...');
        self._ws.terminate();
        self._ws = null;
        setTimeout(self._connect.bind(self), reconnectInterval);
    };
};


// Send msg to server. Buffer and send later if not connected yet.
AriClient.prototype._wsSend = function (msg)
{
    if (!this._ws) {
        console.log("Storing message until connected...");
        this._pendingMsgs.push(msg);
    }
    else if (this._ws.readyState != this._ws.OPEN) {
        console.log("Storing message until connected...");
        this._pendingMsgs.push(msg);
    }
    else this._ws.send(msg);
}

// Top level protocol message handling.
// Call method on server...
AriClient.prototype._call = function (command, parameters, callback) {
    var msg = {};
    msg.req = this._nextReqId++;
    msg.cmd = command;
    msg.pars = parameters;
    this._pendingCallbacks[msg.req] = callback;
    this._wsSend(JSON.stringify(msg));
}

// Publish value to server...
AriClient.prototype._notify = function (command, parameters) {
    var msg = {};
    msg.cmd = command;
    msg.pars = parameters;
    this._wsSend(JSON.stringify(msg));
}

// Handle incomming messages from server.
AriClient.prototype._handleMessage = function (message) {
    console.log("WsMessage.data:", message.data);
    
    try { var msg = JSON.parse(message.data); }        
        catch (e) { console.log("Error: Illegal JSON in message! - Ignoring..."); return; }
    
    if ("req" in msg) {
        // Request message.
        var cmd = msg.cmd;
        if (!cmd) { console.log("Error: Missing comand in telegram! - Ignoring..."); return; };
        
        var functionName = "_webcall_" + cmd;
        if (functionName in this) {
            // Requested function name exists in this object. Call it...
            this[functionName](msg.pars, function (err, result) {
                // reply with results...
                var res = {};
                res.res = msg.req;
                res.err = err;
                res.result = result;
                this._wsSend(JSON.stringify(res));
            });
        }
    } else if ("res" in msg) {
        // Response message.
        var responseId = msg.res;
        // Get stored callback from calling function.
        msg.callback = this._pendingCallbacks[msg.res];
        delete this._pendingCallbacks[msg.res];
        msg.callback(msg.err, msg.result);
    } else {
        // Notofication message.
        var cmd = msg.cmd;
        if (!cmd) { console.log("Error: Missing comand in telegram! - Ignoring..."); return; };
        
        var functionName = "_webnotify_" + cmd;
        if (functionName in this) {
            // Requested notification function name exists in this object. Call it...
            this[functionName](msg.pars);
        }
    }
};

AriClient.prototype._matches = function (strA, strB) {
    var aPos = strA.indexOf('*');
    if (aPos >= 0) {
        var aStr = strA.substring(0, aPos);
        if (aStr == strB.substring(0, aPos)) return true;
    }
    return false;
}


/*****************************************************************************/
AriClient.prototype.connect = function (defaultName, callback) {
    this.registerClient(defaultName, function (err, result) { 
        callback(err, result);
    });
}

//RegisterClient...
AriClient.prototype.registerClient = function (clientName, callback) {
    var self = this;
    this._call("REGISTERCLIENT", { defaultName: clientName }, function (err, result) {
        if (err) { console.log("Error when trying to regiser client:", err); };
        
        console.log("registerClient result:", result);
        self.name = result.givenName;
        callback(err, result);
    });
};

AriClient.prototype.reRegisterClient = function (clientName, secret, callback) {
    var self = this;
    this._call("REREGISTERCLIENT", { "name": clientName, "secret": secret }, function (err, result) {
        if (err) { console.log("Error when trying to re-regiser client:", err); };
        console.log("re-registerClient result:", result);
        self.name = name;
        callback(err, result);
    });
};

// PUB/SUB --------------------------------------------------------------------
AriClient.prototype.publish = function (name, value, callback) {
    this._notify("PUBLISH", { "name": name, "value": value });
}

AriClient.prototype.subscribe = function (name, callback) {
    var self = this;
    this._call("SUBSCRIBE", { "name": name }, function (err, result) {
        if (err) { console.log("Error:", err); callback(err, null); return;}
        self._subscriptions[name] = { "callback": callback };
    });
}

AriClient.prototype.unsubscribe = function (name, callback) {
    var self = this;
    this._call("UNSUBSCRIBE", { "name": name }, function (err, result) {
        if (err) { console.log("Error:", err); callback(err, null); return; }
        delete self._subscriptions[name];
        if (callback) callback(null, null);
    });
}

// RPC ------------------------------------------------------------------------
// RegisterRpc...
AriClient.prototype.registerRpc = function (rpcName, rpcFunction) {
    if (this._functions[rpcName]) throw ("Trying to register RPC with existing name.");
    this._functions[rpcName] = { "func": rpcFunction };
    
    // Send registration to server!
    this._call("REGISTERRPC", { name: rpcName }, function (err, result) {
        if (err) { console.log("Error:", err); return; }
        console.log("RPC", rpcName, "registered.");
    });
};

// Call Rpc on remote client...
AriClient.prototype.callRpc = function (rpcName, params, callback) {
    // Send registration to server!
    this._call("CALLRPC", { "name": rpcName, "params": params }, function (err, result) {
        callback(err, result);
    });
};

//****************************************************************************
// Server published value to client.
AriClient.prototype._webnotify_PUBLISH = function (msg) {
    var name = msg.name;
    if (!name) {
        return;
    }
    
    for (var subName in this._subscriptions) {
        if (this._matches(subName, name)) {
            var value = msg.value;
            
            // Call the local callback
            this._subscriptions[subName].callback(name, value);
        }
    }
}

// Server calls RPC on this client...
AriClient.prototype._webcall_CALLRPC = function (msg, callback) {
    var rpcName = msg.name;
    if (!rpcName) {
        console.log("Error: Missing name of RPC to call! - Ignoring...");
        callback("Error: Missing name of RPC to call at client!", null);
        return;
    }
    
    if (!this._functions.hasOwnProperty(rpcName)) {
        console.log("Error: Name of RPC not previously registered! - Ignoring...");
        callback("Error: RPC unkknown at client!", null);
        return;
    }
    var rpc = this._functions[rpcName];
    var rpcFunc = rpc.func;
    
    var params = msg.params;
    
    // Call the local RPC                
    var result = rpcFunc(params);
    // send result back.  
    if (callback === "function") callback(null, result);    //indicate OK
}

// Module...
/*AriClient.prototype.registerModule = function (model, callback) {
    var self = this;
    
    if (this._models[model.name]) throw ("Trying to register xxx with existing name.");
    this._models[model.name] = model;
    
    var pars = { "name": model.name };
    for (var member in model) {
        if (member.indexOf("_") == 0) continue; // Skip members marked as private using the "_" underscore!
        pars[member] = {};
        if ("_ariAttributes" in model) {
            if (member in model._ariAttributes) {
                pars[member] = model._ariAttributes[member];
            }
        }
        pars[member].type = typeof model[member];
        pars[member].value = model[member];
    }
    
    // Observer registered module.
    Object.observe(model, function (changes) {
        console.log("MODEL CHANGED!");
        // Send update of model to server.
        for (var change in changes) {
            pars = {};
            pars.name = changes[change].name;
            if (pars.name.indexOf("_") == 0) continue;   // exclude "hidden" members.
            
            pars.type = changes[change].type;
            if (pars.type == "add") {
                // Check if description is available.
            }
            if (pars.type == "update") {
                pars.value = model[changes[change].name];
            }
            
            self._call("MODULEUPDATE", pars, function (err, result) {
                if (err) { console.log("Error:", err); return; }
            });
        }
    });
    
    // Send registration to server!
    this._call("REGISTERMODULE", pars, function (err, result) {
        if (err) { console.log("Error:", err); return; }
        console.log("Value:", pars.name, "registered.");
        callback(err, result);
    });
};
*/

//*****************************************************************************
// EventListener implementation...
/*
AriClient.prototype.on = function (event, fct) {
    this._events = this._events || {};
    this._events[event] = this._events[event] || [];
    this._events[event].push(fct);
};

AriClient.prototype.unbind = function (event, fct) {
    this._events = this._events || {};
    if (event in this._events === false) return;
    this._events[event].splice(this._events[event].indexOf(fct), 1);
};

AriClient.prototype._trigger = function (event , args) {
    this._events = this._events || {};
    if (event in this._events === false) return;
    for (var i = 0; i < this._events[event].length; i++) {
        this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
    }
};
*/

if (typeof window === 'undefined') {
    // We're in NodeJS
    var WebSocket = require('ws');
    exports.AriClient = AriClient;
}
else {
}
