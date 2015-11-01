"use strict";

var AriClient = require("../../../www/app/ariclient.js").AriClient;
var ConfigStore = require("../../../configStore.js");

var instance = null;

// Load state.
var stateStore = new ConfigStore(__dirname, "NodeRedClient_State");
var state = stateStore.load();

var AriSingleton = module.exports.getInstance = function (name) {
    if (instance == null) {
        
        var ari = instance = new AriClient(name);
        
        // Connect    
        if (!state.authToken) ari.connectDevice("controller");
        else ari.connect(state.authToken);

        // Handle connection.
        var self = this;
        ari.on("connect", function (result) {
            if (!state.authToken) {
                // First time we get an authToken, save it!
                state.authToken = ari.authToken;
                stateStore.save();
            }
            
            var clientName = result.name;   // Store name in case we got a new one (with (x) at the end!)
            console.log("Node-Red client connected as \"" + ari.name + "\"");
        });
    }
    return instance;
}

//*****************************************************************************
// EventListener implementation...
/*AriSingleton.prototype.on = function (event, fct) {
    this._events = this._events || {};
    this._events[event] = this._events[event] || [];
    this._events[event].push(fct);
};

AriSingleton.prototype.unbind = function (event, fct) {
    this._events = this._events || {};
    if (event in this._events === false) return;
    this._events[event].splice(this._events[event].indexOf(fct), 1);
};

AriSingleton.prototype._trigger = function (event , args) {
    this._events = this._events || {};
    if (event in this._events === false) return;
    for (var i = 0; i < this._events[event].length; i++) {
        this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1));
    }
};
*/