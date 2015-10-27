"use strict";

if (typeof window === 'undefined') {
    // We're in NodeJS
    var WebSocket = require('ws');
    exports.AriClient = AriClient;
}
else {
}

function transferOpts(origOpts, newOpts){
    if (newOpts == null) return;
    for (var key in newOpts) {
        if (key.indexOf("_") != 0) origOpts[key] = newOpts[key];    // Copy all but "private" members.
    }
}

function AriClient(clientName) {
    // private
    var self = this;
    this._nextReqId = 0;        // Id to use for identifying requests and corresponding response callbacks.
    this._pendingCallbacks = {};// Callbacks for pending server requests.
    this._functions = {};       // registered callbacks.
    this._pendingMsgs = [];     // Buffer for messages that should have been sent while offline.
    this._subscriptions = {};   // Contains callbacks for subsriptions
    this._ws = null;            // WebSocket connecting to server.
    this.reconnectInterval = 2000; // Interval (in mS) to wait before retrying to connect on unexpected disconnection or error. 0 = no retry!
    this.authToken = null;
    
    this.name = clientName;
    
    if (typeof window !== 'undefined') { // Config for browser
        this.url = "ws://" + window.location.host;
    } else {
        this.url = "ws://localhost:3000/socket/";
    }
    
    // Override defaults if set specifically.
    //    transferOpts(this, options);
    
    //this._connect();   // This connects or reconnects to a server.
}

AriClient.prototype.onconnect = null;   // User function to handle subscription, registration etc. on connection.
AriClient.prototype.onerror = null;   // User function to handle errors!

AriClient.prototype._connect = function () {
    var self = this;

    // Open socket!
    if (!this._ws) {
        console.log("Creating WSocket!");
        this._ws = new WebSocket(this.url);
    }
    this._ws.onopen = function () {
        if (!self.authToken) {
            if (self.role) {
                // No authToken, so we need to request it.
                self._call("REQAUTHTOKEN", { "name": self.name, "role": self.role }, function (err, result) {
                    if (err) { console.log("Error:", err); return; }
                    self.name = result.name;
                    self.authToken = result.authToken;
                    
                    // reconnect, now with authToken
                    self._ws.close();
                    self._ws = null;
                });
            } else if (self.userName && self.userPassword) {
                // No authToken, so we need to request it.
                self._call("REQAUTHTOKEN", { "name": self.userName, "password": self.userPassword }, function (err, result) {
                    if (err) { console.log("Error:", err); return; };
                    self.name = result.name;
                    self.authToken = result.authToken;
                    
                    // reconnect, not with authToken
                    self._ws.close();
                    self._ws = null;
                });
            }
        }
        
        if (self.authToken) {
            // We have authToken, so connect "normally".
            
            self._call("CONNECT", { "name": self.name, "authToken": self.authToken }, function (err, result) {
                if (err) {
                    if (self.onerror) self.onerror(err);
                    return;
                }
                
                console.log("registerClient result:", result);
                self.name = result.name;
                
                // Send if we have stored msg's...
                for (var i = 0; i < self._pendingMsgs.length; i++) {
                    self._ws.send(self._pendingMsgs[i]);
                }
                self._pendingMsgs = [];
                
                if (self.onconnect) self.onconnect(result);
            });
        }
    };
    
    this._ws.onmessage = function (message) {
        self._handleMessage(message);
    };

    this._ws.onerror = function () {
        console.log('Socket error... Will try to reconnect...');
        if (self._ws) {
            self._ws.close();
            self._ws = null;
        }
        if(self.reconnectInterval > 0) setTimeout(self._connect.bind(self), self.reconnectInterval);
        if (self.onerror) self.onerror();
    };

    this._ws.onclose = function () {
        console.log('Socket closed... Will try to reconnect...');
        if (self._ws) {
            self._ws.close();
            self._ws = null;
        }
        if (self.reconnectInterval > 0) setTimeout(self._connect.bind(self), self.reconnectInterval);
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
    if (callback) {
        // if callback is provided, store it to be called when response is received.
        this._pendingCallbacks[msg.req] = callback;
    }
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
            var self = this;
            this[functionName](msg.pars, function (err, result) {
                // reply with results...
                var res = {};
                res.res = msg.req;
                res.err = err;
                res.result = result;
                self._wsSend(JSON.stringify(res));
            });
        }
    } else if ("res" in msg) {
        // Response message.
        var responseId = msg.res;
        // Get stored callback from calling function.
        msg.callback = this._pendingCallbacks[msg.res];
        if (msg.callback) {
            delete this._pendingCallbacks[msg.res];
            //try {
                msg.callback(msg.err, msg.result);
            /*} catch (e) {
                console.log("Uncaught exception in callback for _call!", e);
            }*/
        } else {
            // No callback provided...
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
// connect, disconnect --------------------------------------------------------

// Normal connect with authToken.
AriClient.prototype.connect = function (authToken) {
    this.authToken = authToken;
    this._connect();    
};

// First time connect if only user and password is known. 
// authToken will be available if successfully loggend in.
AriClient.prototype.connectUser = function (userName, userPassword) {
    this.userName = userName;
    this.userPassword = userPassword;
    this.authToken = null;
    this._connect();
};

// First time connect if its a device/controller.
// authToken will be available if successfully loggend in after admin has manually approved device.
AriClient.prototype.connectDevice = function (role) {
    this.role = role == "controller" ? "controller" : "device";
    this.authToken = null;
    this._connect();
};

// Close connection to server.
AriClient.prototype.close = function () {
    this.reconnectInterval = 0;    // No reconnect!
    this._ws.close();
    this._ws = null;
}


/*****************************************************************************/
// Values, PUB/SUB ------------------------------------------------------------
AriClient.prototype.registerValue = function (name, optionals, callback) {
    var self = this;
    this._call("REGISTERVALUE", { "name": name , "optionals": optionals}, function (err, result) {
        if (err) { console.log("Error:", err); if (callback) callback(err, null); return; }
        if (callback) callback(null, result);
    });
}

AriClient.prototype.publish = function (name, value, callback) {
    this._notify("PUBLISH", { "name": name, "value": value });
}

AriClient.prototype.subscribe = function (name, callback) {
    var self = this;
    this._call("SUBSCRIBE", { "name": name }, function (err, result) {
        if (err) { console.log("Error:", err); if(callback) callback(err, null); return;}
        self._subscriptions[name] = { "callback": callback };
    });
}

AriClient.prototype.unsubscribe = function (name, callback) {
    var self = this;
    this._call("UNSUBSCRIBE", { "name": name }, function (err, result) {
        if (err) { console.log("Error:", err); if(callback) callback(err, null); return; }
        delete self._subscriptions[name];
        if (callback) callback(null, result);
    });
}

/*****************************************************************************/
// RPC ------------------------------------------------------------------------
// RegisterRpc...
AriClient.prototype.registerRpc = function (rpcName, optionals, rpcFunction) {
    this._functions[rpcName] = { "func": rpcFunction };
    
    // Send registration to server!
    var info = optionals || {};
    info.name = rpcName;
    this._call("REGISTERRPC", info, function (err, result) {
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
    var result = rpcFunc(params, function (err, result) {
        // send result back.  
        callback(err, result);
    });
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
