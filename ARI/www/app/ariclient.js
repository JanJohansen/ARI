"use strict";

if (typeof window === 'undefined') {
    // We're in NodeJS
    var WebSocket = require('ws');
    exports.AriClient = AriClient;
}
else {
}

function transferOpts(origOpts, newOpts) {
    if (newOpts == null) return;
    for (var key in newOpts) {
        if (key.indexOf("_") != 0) origOpts[key] = newOpts[key];    // Copy all but "private" members.
    }
}

function AriClient(clientName, clientModelOptionals) {
    // private
    var self = this;
    this._nextReqId = 0;        // Id to use for identifying requests and corresponding response callbacks.
    this._pendingCallbacks = {};// Callbacks for pending server requests.
    this._valueWatches = {};    // Watched values. callback= function to be calle don change of value...
    this._pendingMsgs = [];     // Buffer for messages that should have been sent while offline.
    this._ws = null;            // WebSocket connecting to server.
    this.reconnectInterval = 2000; // Interval (in mS) to wait before retrying to connect on unexpected disconnection or error. 0 = no retry!
    this.authToken = null;
    this.isConnected = false;

    this.name = clientName;

    // define clientInfo object to send to server and to maintain local state.
    // Note that members starting with "_" will NOT be sent to server! - So use this to store members with local relevance only.
    this.clientModel = clientModelOptionals || {};
    this.clientModel.name = this.name;
    this.clientModel.functions = {};      // registered functions
    this.clientModel.values = {};         // registered values
    this.clientModel.subscriptions = {};  // registered subscriptions with "private" callbacks indicated by "_"...

    if (typeof window !== 'undefined') { // Config for browser
        this.url = "ws://" + window.location.host;
    } else {
        this.url = "ws://localhost:3000/socket/";
    }
}

AriClient.prototype.onconnect = null;   // User function to handle subscription, registration etc. on connection.
AriClient.prototype.onerror = null;   // User function to handle errors!

AriClient.prototype._connect = function () {
    var self = this;

    // Open socket!
    if (!this._ws) {
        //console.log("Creating WSocket!");
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
                    self._trigger("error", err);
                    return;
                }

                //console.log("registerClient result:", result);
                self.name = result.name;

                // Send if we have stored msg's...
                for (var i = 0; i < self._pendingMsgs.length; i++) {
                    self._ws.send(self._pendingMsgs[i]);
                }
                self._pendingMsgs = [];

                self.isConnected = true;
                if (self.onconnect) self.onconnect(result);
                self._trigger("connect", result);
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
        if (self.reconnectInterval > 0) setTimeout(self._connect.bind(self), self.reconnectInterval);
        self.isConnected = false;
        if (self.onerror) self.onerror();
        self._trigger("error", "Websocket error.");
        self._trigger("disconnect");
    };

    this._ws.onclose = function () {
        console.log('Socket closed... Will try to reconnect...');
        if (self._ws) {
            self._ws.close();
            self._ws = null;
        }
        self.isConnected = false;
        if (self.reconnectInterval > 0) setTimeout(self._connect.bind(self), self.reconnectInterval);
        if (self.onclose) self.onclose();
        self._trigger("close", "Websocket closed.");
        self._trigger("disconnect");
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
    //console.log("-->", message.data);

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
// clientInfo -----------------------------------------------------------------
// This function sets a timeout function, so that after 10ms the update is sent.
// If many updates are made to clientInfo (durgin startup), only one clientInfo update will be sent to the server!
AriClient.prototype.sendClientInfo = function (){

    if (!AriClient.prototype.sendClientInfo.serverupdatePending) {
        AriClient.prototype.sendClientInfo.serverupdatePending = true; // "static" member value of member function!

    var self = this;
        setTimeout(function () {
            delete AriClient.prototype.sendClientInfo.serverupdatePending;

            // send clientInfo.
            self._notify("SETCLIENTINFO", self.clientModel);
            console.log("clientInfo:", self.clientModel);
        }, 10);
    }
}

// For easier update of values, call this and re-register all again.
AriClient.prototype.clearValues = function () {
    this.clientModel.values = {};
    this.sendClientInfo();
}

// For easier update of functions, call this and re-register all again.
AriClient.prototype.clearFunctions = function () {
    self.clientModel.functions = {};
    this.sendClientInfo();
}

/*****************************************************************************/
// Values ---------------------------------------------------------------------
AriClient.prototype.registerValue = function (name, optionals, inputCallback) {
    this.clientModel.values[name] = optionals || {};
    this.clientModel.values[name]._callback = inputCallback;
    this.sendClientInfo();
}

// Check if value has been registered.
AriClient.prototype.isValueRegistered = function (name) {
    if (this.clientModel.values[name]) return true;
    else return false;
}

// Remove info about value and send update to server.
AriClient.prototype.unRegisterValue = function (name) {
   delete this.clientModel.values[name];
   this.sendClientInfo();
}

// Watch remote client value - call function when value change is notified.
// Returns reference to the function. Store this to be able to unwatch for this specific callback in case you have more than one watch/callback on same value.
AriClient.prototype.watchValue = function (name, callback) {
    // Target structure: this.clientModel._watches = {valName1: [function1, function2,...], valName2: [function3, function4,...], ...}
    if (!this.clientModel._watches) this.clientModel._watches = {};
    if (!this.clientModel._watches[name]) this.clientModel._watches[name] = [];
    this.clientModel._watches[name].push(callback);
    this._notify("WATCHVALUE", { "name": name });
    return callback;
}

// unWatch value
// Provide original callback in case you have more than one callback per watch. Calling unwatch without callback function will unwatch all callbacks for the value.
AriClient.prototype.unWatchValue = function (name, callback) {
    if (!callback) {
        if(this.clientModel._watches) delete this.clientModel._watches[name];
    } else {
        if (this.clientModel._watches) {
            var watch = this.clientModel._watches[name];
            if (watch) {
                watch.splice(watch.indexOf(callback), 1);   // remove callback from list of callbacks for watch.
            }
        }
    }
    if (!this.clientModel._watches || !this.clientModel._watches[name] || this.clientModel._watches[name].length == 0) {
        this._notify("UNWATCHVALUE", { "name": name });
    }
}

// Get latest reported value from server.
AriClient.prototype.getValue = function (name, callback) {
    this._call("GETVALUE", { "name": name }, function (err, result) {
        callback(err, result);
    });
}

// Function to set local or remote values.
AriClient.prototype.setValue = function (name, value) {
    if (this.clientModel.values.hasOwnProperty(name)) {
        // Local value - store local value and notify server of update.
        this.clientModel.values[name].value = value;
        this._notify("VALUE", { "name": name, "value": value });
    } else {
        // Not local - possibly remote, so send set request to server.
        this._notify("SETVALUE", { "name": name, "value": value });
    }
}

// Server informs that a watched value has been updated.
AriClient.prototype._webnotify_VALUE = function (msg) {
    var name = msg.name;
    if (!name) return;

    //console.log("VALUE:", name, "=", msg.value);

    // Call all registered callbacks for watched values.
    for (var watch in this.clientModel._watches) {
        if (this._matches(watch, name)) {
            watch = this.clientModel._watches[watch];
            for (var i in watch) {
                watch[i](name, msg.value);
            }
        }
    }
}

// Remote client wants to set a local value.
AriClient.prototype._webnotify_SETVALUE = function (msg) {
    var name = msg.name;
    var value = msg.value;
    if (name == undefined || value == undefined) return;

    //console.log("SETVALUE:", name, "=", value);

    var v = this.clientModel.values[name];
    if (v) {
        if(v._callback) v._callback(name, value)
    }
}

/*****************************************************************************/
// PUB/SUB --------------------------------------------------------------------
AriClient.prototype.subscribe = function (name, callback) {
    this.clientModel.subscriptions[name] = { "_callback": callback };
    this.sendClientInfo();
}

AriClient.prototype.publish = function (name, value) {
    this._notify("PUBLISH", { "name": name, "value": value });
}

AriClient.prototype.unsubscribe = function (name, callback) {
    if (this.clientModel.subscriptions[name]) delete this.clientModel.subscriptions[name];
    this.sendClientInfo();
}

// Server published value to client.
AriClient.prototype._webnotify_PUBLISH = function (msg) {
    var name = msg.name;
    if (!name) {
        return;
    }

    for (var subName in this.clientModel.subscriptions) {
        if (this._matches(subName, name)) {
            var value = msg.value;

            // Call the local callback
            this.clientModel.subscriptions[subName].callback(name, value);
        }
    }
}

/*****************************************************************************/
// Register Function that can be called on client...
AriClient.prototype.registerFunction = function (name, optionals, functionToCall) {
    this.clientModel.functions[name] = { "func": functionToCall };
    this.sendClientInfo();
};

// Call function on remote client...
AriClient.prototype.callFunction = function (rpcName, params, callback) {
    this._call("CALLFUNCTION", { "name": rpcName, "params": params }, function (err, result) {
        callback(err, result);
    });
};

// Server calls RPC on this client...
AriClient.prototype._webcall_CALLFUNCTION = function (msg, callback) {
    var rpcName = msg.name;
    if (!rpcName) {
        console.log("Error: Missing name of RPC to call! - Ignoring...");
        callback("Error: Missing name of RPC to call at client!", null);
        return;
    }

    if (!this.clientModel.functions.hasOwnProperty(rpcName)) {
        console.log("Error: Name of RPC not previously registered! - Ignoring...");
        callback("Error: RPC unkknown at client!", null);
        return;
    }
    var rpc = this.clientModel.functions[rpcName];
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
        //console.log("DBG!!!", event, this._events);
        this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
    }
};
