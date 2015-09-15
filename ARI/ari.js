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

/*
 * root structure:
 * root.clients // contains all clients by unique givenName.
 * root.clients.testclient.functions.testRpc1
 * root.clients.testclient.functions.testVal1
 * 
 * root.clients.MusicPlayer.functions.Play(
 * root.clients.MusicPlayer.values.url = "localhost:3000/files/music/music.mp3"
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

var Ari = module.exports.Ari = function (options) {
    var self = this;
    this._wss = options.websocketServer;

    // Connected clients indexed by the given clientName.
    this.clients = {};
    
    this._nextRequestId = 1;
    
    this._wss.on('connection', function connection(ws) {
        // Use "SELF!
        var clientServer = new AriClientServer({ ariServer: self, websocket: ws });
    });

    // DEBUG
    Object.observe(this.clients, function (changes) {
        changes.forEach(function (change) {
            console.log("--Observed _clients:", change.type, change.name);
            
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

Ari.prototype.callRpc = function (name, params, callback) {
    // Find client...
    var clientName = name.split(".");
    for (client in this._clients) {
        if (client.name == clientName) {
            ariClient.callRpc(name, params, callback);
        }
    }
}
