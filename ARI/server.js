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

// WebSocket ******************************************************************
// For debug only - write received messages!
wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        console.log('received: %s', message);
    });
});

// HTTP Server ****************************************************************
//server.on('request', app);
server.on('request', function (req, res, next) {
    //console.log(req.url);
    app(req, res, next);
});
server.listen(port, function () { console.log('Listening on ' + server.address().port) });


