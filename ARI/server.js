"use strict";

var server = require('http').createServer();
var url = require('url');
var WSServer = require('ws').Server;
var wss = new WSServer({ server: server });
var express = require('express');
var app = express();
var port = 3000;


app.use("/", express.static('www/app'));

// REST API *******************************************************************
// GET userlist.
app.get('/api/users', function (req, res) {
    var users = [{
            "name": "Jan Johansen", 
            "roles": ["admin", "superuser", "godmode"],
            "online": true
        },
        {
            "name": "Erik",
            "roles": ["guest"],
            "online": false
        }
    ];
    res.json(users);
});

// Set up Ari server...
var Ari = require('./ari.js').Ari;
var ari = new Ari({ websocketServer: wss });

// HTTP Server ****************************************************************
//server.on('request', app);
server.on('request', function (req, res, next) {
    //console.log(req.url);
    app(req, res, next);
});
server.listen(port, function () { console.log('Listening on ' + server.address().port) });


// Enable user to properly close down server...
process.stdin.resume();
process.stdin.setEncoding("ascii");

process.stdin.on('data', function (text) {
    console.log('received data:', text);
    if (text == "q") {
        handleConsoleQuit();
    }
    handleConsoleQuit(); // for now.
});

function handleConsoleQuit() {
    ari.shutDown();
    console.log('Now that process.stdin is paused, there is nothing more to do.');
    process.exit();
}