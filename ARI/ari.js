"use strict";

/*
 * Protocol:
 * Bidirectional RPC framework.
 * Persisting PubSub key/value storage w. history logging.
 * 
 * Messages/Commands:
 *  Overall format for requests and responses: 
 *      -> {"req":123, "cmd":"REQUESTTYPE", {Named Arguments}}
 *      <- {"res":123, <err: {}>, result: {}}}
 *          req = Request Id.
 *          rep = Response Id.
 *          This allows for multiple requests in parallel.
 *          If there is no rid member, no reply is to be sent. E.g. It's a notification only
 *          Err will be omitted if no error occured!


Implementation:
	-> {"rid":123, "cmd":"SUBCRIBE", args:{Path: "key"}]
	<- {"rid":123, "cmd":"SUBSCRIBERESULT, "result":{Path: "key?"}]
		Subscribes to notifications in case of updates to a keys value.
		Wildcards allowed!
			[123, "SUBCRIBE", "root.*">]
			Returns: 	[123, "SUBSCRIBED, {Path: "key*"}]
			
	->[123, "UNSUBCRIBE", <Path>]
	<- 
	
	-> [123, "SET", {Path: "key", Value: "Value"}]
	<- [123, "SET", {Path: "key", Value: "Value"}]
		Sets the value of a key.
		
	-> [123, "GET", {Path: "key", Value: "Value"}]
	<- [123, "GOT", {Path: "key", Value: "Value"}]
		Gets the latest value of a key.
	
	-> [123, "SETOPTS", {Path: "key", <Options>}]
	<- [123, "OPTSSET"]
		Options could be 
			Logging.TimeToLive
				Time in milli seconds for values to be kept in the log.
			Logging.MaxNumLogs
				Maximum number of log entries to be kept in log for this value.

	-> [123, "LISTKEYS", {Path: "key", <Options>}]
	<- [123, "KEYLIST", {Keys: [key1, key2, ...]}]
		Get the list of matching keys in store.

Usage examples:
	List all keys and values in store:
		-> [123, "LISTKEYS", {Path: "*"}]
		<- [123, "KEYLIST", {Keys: [	"Modules.musicPlayer.SelectedFile",
										"Modules.FileServer.files",
										...]}]
	Get key value:
		-> ["123, GET", {Path: "Modules.FileServer.files"}]
		<- [123, "GOT", {Path: "Modules.FileServer.files", Value: ["mastermix.mp3", ...]}]
		
	Set key value:
		[123, "SET", {Path: "root.modules.musicPlayer.SelectedFile", Value: "mastermix.mp3"}]




Device / endpoint - as in hardware device or virtual software device/separate program!
	-> [123, "REGISTERDEVICE", {<deviceId: 123>, Name: "ESP_MAX"}]
	<- [123, "ACK", {deviceId: 123, Name: "ESP_MAX(2)"}]
		In request, devideID is optional. If not known, just reqister and the server will assign new id. If known, this is identifying a "returning" device.

RPC store?
	-> [req:123, "REGISTERRPC", {Name: "FileServer.Dir", <desciption: "">}]
	<- [res:123, {err: null, result: {}}]
	
	-> [123, "CALLRPC", {deviceId: 123, Name: "FileServer.Dir", Path: "*"}]
	<- [123, {["test.mp3", "test2.mp3"]}]
		
*/

/* URI Structure = ClientName.ModuleName.RPC-/MSG-name
 * 
 * 
 * testclient.functions.testRpc1
 * testclient.functions.testVal1
 * 
 * RPI(2).MusicPlayer.functions.Play
 * RPI(2).MusicPlayer.functions.Play.description = Call this function without parameters to start playing current set URL, or include URL to play.
 * RPI(2).MusicPlayer.variables.url = "localhost:3000/files/music/music.mp3"
 * RPI(2).MusicPlayer.variables.url.description = URL of music to play. Ex. "localhost:3000/files/music/music.mp3"
 * 
 * root.clients.FileServer.functions.listFiles(path);
 * 
 * root.clients.MultiClient(7).values.Temperature1 = "23"
 * root.clients.MultiClient(7).values.Relay1 = "1"
 * 
 * subscribe("MusicPlayer.values", function(){});
*/


// ARI (Automation Routing Infrastructure)

var AriClientServer = require("./ariclientserver.js").AriClientServer;
var AriServerServer = require("./ariserverserver.js").AriServerServer;

var Ari = module.exports.Ari = function (options) {
    var self = this;
    this._wss = options.websocketServer;
    this.clientsModel = {};
    
    // Persisted client information indexed by client.givenName. Contains infor about connection state, etc...
    // ari: represents the server API, etc.
    var serverServer = new AriServerServer({ "ariServer": this, "name": "ari" });   
        
    this._wss.on('connection', function connection(ws) {
        // Use "SELF!
        // Create AriClientServer to handle serving of this client.
        var clientServer = new AriClientServer({ ariServer: self, websocket: ws });
    });

    // DEBUG
    Object.observe(this.clientsModel, function (changes) {
        changes.forEach(function (change) {
            console.log("--Observed _clientsModel:", change.type, change.name);
            if (change.type == "add") {
                Object.observe(change.object[change.name].functions, function (changes) {
                    changes.forEach(function (change) {
                        console.log("--Observed ?:", change.type, change.name);
                    });
                });
            }
        });
    });
};

// ServerServer could thoretically call functions on clients!
Ari.prototype.callRpc = function (name, params, callback) {
    // Find client...
    var clientName = name.split(".");
    for (client in this._clients) {
        if (client.name == clientName) {
            ariClient.callRpc(name, params, callback);
        }
    }
}

// ServerServer could very well provide/publish values to clients!
Ari.prototype.publish = function (name, value) {
    // Find client...
    var clientName = name.split(".")[0];
    for (var key in this.clientsModel) {
        var client = this.clientsModel[key];
        if (client) {
            if (client.online == true) {
                var cs = client.__clientServer;
                if (cs) {
                    for (var subName in cs._subscriptions) {
                        if (this.matches(subName, name))
                            cs._notify("PUBLISH", { "name": name , "value": value});
                    }
                }
            }
        }
    }
}

Ari.prototype.matches = function(strA, strB)
{
    var aPos = strA.indexOf('*');
    if (aPos >= 0) {
        var aStr = strA.substring(0, aPos);
        if (aStr == strB.substring(0, aPos)) return true;
    }
    return false;
}
