"use strict";
var port = 3000;

var server = require('http').createServer();
var url = require('url');
var WSServer = require('ws').Server;
var wss = new WSServer({ server: server });
var express = require('express');
var app = express();
var bodyParser = require('body-parser')
var jwt = require('jwt-simple');
var fs = require("fs");
var cp = require('child_process');

//*****************************************************************************
// Set up Ari server...
var Ari = require('./ari.js').Ari;
var ari = new Ari({ websocketServer: wss });


//*****************************************************************************
// HTTP Server 
app.use(bodyParser.json());     // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ extended: true /* to support URL-encoded bodies */ }));


//server.on('request', app);
server.on('request', function (req, res, next) {
    //console.log(req.url);
    app(req, res, next);
});

server.listen(port, function () {
    console.log('Listening on ' + server.address().port)
});

// REST API *******************************************************************

// Middleware checking if there is a JWT token in "Auth-request header". Decoding it to "user" if exists...
app.use(function (req, res, next) {
    // check header or url parameters or post parameters for token
    var token = req.body.Auth || req.query.Auth || req.headers["auth"];
    
    // decode token
    if (token) {
        // verifies secret and checks exp
        var decoded = jwt.decode(token, ari.JWTSecret);
        if (decoded) {
            // TODO: Check date of token agains local store, to check if token has been revoked...
            req.user = decoded;
        }
        next();
    } else {
        // Allow for now!
        //if there is no token check if targeturl route is allowed without it.
        //console.log("Checking if allowed without authentication?", req.url);
        //res.redirect("#/views/login");
        next();
    }
});

// GET userlist.
app.get('/api/users', function (req, res) {
    if (req.user && (req.user.role == "admin")) res.json(ari.userModels);
    else {
        res.status(401).send("API only allowed for role admin.");
        console.log("Atempt to get user list from:");
    }
});


// Provide userToken if credentials are OK.
app.post('/api/users/login', function (req, res) {
    var userName = req.body.name;
    var passWord = req.body.password;
    
    // Check authorization.
    if (userName in ari.userModels) {
        if (ari.userModels[userName].password == passWord) {
            ari.userModels[userName].signupDate = new Date().toISOString();
            var payload = { "name": userName, "role": ari.userModels[userName].role, "created": ari.userModels[userName].created };
            var authToken = jwt.encode(payload, ari.JWTSecret);
            res.json({ "authToken": authToken });
            return;
        }
    }
    res.status(401).send('Wrong user or password');
});


// Serve base app...
app.use("/", express.static(__dirname + "/www/app"));    // Serve static files. (Note: Don't use relative path since it is relative to CWD (Current Working Dir!") Yaiks!
// Serve plugin views.
app.get("/plugins/:plugin/:view", function (request, response, next) {
    console.log("http GET plugins...");
    response.sendFile(__dirname + "/plugins/" + request.params.plugin + "/www/" + request.params.view);
});



//*****************************************************************************
// Enable user to properly close down server...
process.stdin.resume();
process.stdin.setEncoding("ascii");

process.stdin.on('data', function (text) {
    console.log('received data:', text);
    if (text == "q") {
        handleConsoleQuit();    // TODO: Doesn't seem to work!?
    }
    handleConsoleQuit(); // Use "AnyKey" for now!
});

function handleConsoleQuit() {
    console.log('User shut down... Bye.');
    ari.shutDown();
    saveDebug(true);
    process.exit();
}


/*****************************************************************************/
// Plugin handling.
var pluginInfos = {};

// Start installed plugins.
var pluginsPath = __dirname + "/plugins";
fs.readdir(pluginsPath, function (err, files) {
    if (err) { return; }
   
    files.forEach(function (dir) {
        fs.stat(pluginsPath + "/" + dir, function (error, stat) {
            if (stat && stat.isDirectory()) {
                // We found sub-dir of plugins dir.
                // Read manifest.
                fs.readFile(pluginsPath + "/" + dir + "/" + "ariManifest.json", function (err, data) {
                    try { var manifest = JSON.parse(data) } catch (e) { console.log(e); return; }
                    if (manifest) {
                        if (manifest.packageInfo.name != undefined) {
                            pluginInfos[manifest.packageInfo.name] = manifest;
                        if (manifest.plugins) {
                            for (var id in manifest.plugins) {
                                var plugin = manifest.plugins[id];
                                if (plugin.name && plugin.nodeMain) {
                                    console.log("Starting plugin:", plugin.name);
                                    
                                    // Child will use parent's stdios
                                    if (!plugin.arguments) plugin.arguments = "";
                                    var args = [plugin.nodeMain].concat(plugin.arguments.split(" "));
                                        var pluginProcess = cp.spawn("node", args, { "cwd": pluginsPath + "/" + plugin.name });
                
                                        plugin.stdout = "";
                                        plugin.errout = "";
                                        plugin.debugFilePath = pluginsPath + "/" + dir + "/";

                                    pluginProcess.stdout.on('data', function (data) {
                                        console.log("/" + plugin.name + ":", data.toString());
                                            plugin.stdout += data.toString();
                                    });
                
                                    pluginProcess.stderr.on('data', function (data) {
                                        console.log(plugin.name + " ERROR:", data.toString());
                                            plugin.errout += data.toString();
                                    });
                
                                    pluginProcess.on('close', function (code) {
                                        console.log(plugin.name + " exit!:", code.toString());
                                        // TODO: Implement restart plugin n times before reporting error?
                                            saveDebug(false);
                                    });
                                }
                            }
                        }
                    }
                    }
                });
            } // else its a file or error...
        });
    });
});

var saveDebug = function (synchronous){
    
    for (var manifestName in pluginInfos) {
        for (var pluginName in pluginInfos[manifestName].plugins) {
            var plugin = pluginInfos[manifestName].plugins[pluginName];
            
            // For stdout
            var fileName = plugin.debugFilePath + plugin.name + ".stdout.log";
            var stdlog = plugin.stdout;
            plugin.stdout = "";
            if (stdlog != "") {
                if (synchronous) fs.appendFileSync(fileName, stdlog);
                else fs.appendFile(fileName, stdlog, function () { });
                console.log("DebugLog file written:", fileName)
            }
            
            // For stderr
            var fileName = plugin.debugFilePath + plugin.name + ".stderr.log";
            var stdlog = plugin.stderr;
            plugin.stderr = "";
            if (stdlog != "") {
                if (synchronous) fs.appendFileSync(fileName, stdlog);
                else fs.appendFile(fileName, stdlog, function () { });
                console.log("DebugLog file written:", fileName)
            }
        }
    }
}

// Save debug log eavery 10 minutes.
setInterval(saveDebug, 10 * 60 * 1000);
