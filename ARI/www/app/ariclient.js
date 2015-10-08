"use strict";

if (typeof window === 'undefined') {
    // We're in NodeJS
    var WebSocket = require('ws');
}
else {
}


function transferOpts(origOpts, newOpts){
    if (newOpts == null) return;
    for (var key in newOpts) {
        if (key.indexOf("_") != 0) origOpts[key] = newOpts[key];    // Copy all but "private" members.
    }
}

function AriClient(options) {
    // private
    var self = this;
    this._clientConfig = {};
    this._nextReqId = 0;
    this._pendingCallbacks = {};
    this._functions = {};
//    this._models = {};
    this._pendingMsgs = [];     // Buffer for messages that should have been sent while offline.
    this._subscriptions = {};   // Contains callbacks for subsriptions
    this._ws = null;
    
    // Set defaults  
    this.name = "Anonymous";
    this.url = "ws://localhost:3000/socket/";

    if (typeof window !== 'undefined') { // Config for browser
        this.url = "ws://" + window.location.host;
    }
    
    // Override defaults if set specifically.
    transferOpts(this, options);
    
    this._connect();   // This connects or reconnects to a server.
}

AriClient.prototype.onconnect = null;   // User function to handle subscription, registration etc. on connection.
AriClient.prototype.onerror = null;   // User function to handle errors!

/*
* For documentation:
* If client requests or presents a "clientToken", the server will persist it's registered functions and values.
* Initial connection from clients without a clientToken can request a token for later reconnection.
* This means that clients that don't register function or values on the server (like a browser client only displaying state)
* will onlly temporarily show up in the list of clients.
 * 
 * ← CONNECT({ name: "defaultName" })
 * → err, result: { name: "givenName"}
 * Client is not authenticated and can act as "Anonymous External" or "Anonymous Local" user, based on origin IP.
 * On http request, client could be redircted to login page.
 * 
 * ← REQCLIENTTOKEN({name: "givenName"})
 * → err, result: {clientToken: "clientToken"}
 * Server will list client in "pending client authorizations" list.
 * ??? A user must now allow the client for inclusion?
 * (Client is now authenticated and persists the session changes.)
 * ...
*/

AriClient.prototype._connect = function () {
    var self = this;
    var reconnectInterval = 2000;

    // Open socket!
    this._ws = new WebSocket(this.url);
    
    this._ws.onopen = function () {
        // USE SELF!
        
        // Always register or authorize this client
        self.clientConnect({"name": self.name, "clientToken": self.clientToken}, function (err, result) {
            if (err) {
                if (self.onerror) self.onerror(err);
                return;
            }
            // Call connect function of user.
            if (self.onconnect) self.onconnect(result);
        });
        
        // Send if we have stored msg's...
        for (var i = 0; i < self._pendingMsgs.length; i++) {
            self._ws.send(self._pendingMsgs[i]);
        }
        self._pendingMsgs = [];
    };
    
    this._ws.onmessage = function (message) {
        // USE SELF!
        self._handleMessage(message);
    };

    this._ws.onerror = function () {
        console.log('Socket error... Will try to reconnect...');
        self._ws.close();
        self._ws = null;
        setTimeout(self._connect.bind(self), reconnectInterval);
        if (self.onerror) self.onerror();
    };

    this._ws.onclose = function () {
        console.log('Socket closed... Will try to reconnect...');
        self._ws.close();
        self._ws = null;
        setTimeout(self._connect.bind(self), reconnectInterval);
        if (self.onclose) self.onclose();
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
    console.log("-->", message.data);
    
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
        try {
            msg.callback(msg.err, msg.result);
        } catch (e) {
            console.log("!!!!!!!!!!!!!!", e);
        }
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
    if (strA == strB) return true;
    var aPos = strA.indexOf('*');
    if (aPos >= 0) {
        var aStr = strA.substring(0, aPos);
        if (aStr == strB.substring(0, aPos)) return true;
    }
    return false;
}


/*****************************************************************************/
//RegisterClient...
AriClient.prototype.clientConnect = function (options, callback) {
    var self = this;
    this._call("CONNECT", options, function (err, result) {
        if (err) {
            if(self.onerror) self.onerror(err);
            callback(err, null);
            return;
        }
        
        console.log("registerClient result:", result);
        self.name = result.name;
        callback(err, result);
    });
};

AriClient.prototype.requestClientToken = function (callback) {
    var self = this;
    this._call("REQCLIENTTOKEN", { "clientToken": self._clientToken }, function (err, result) {
//        if (err) { console.log("Error when trying to re-connect client:", err); };
//        console.log("re-connectClient result:", result);
//        self.name = result.givenName;
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
