﻿"use strict";

var fs = require('fs');

var ConfigStore = module.exports = function (path, fileName) {
    this.path = path;
    this.fileName = fileName;
}

ConfigStore.prototype.load = function () {
    // Load config from file...

    try {
        var str = fs.readFileSync(this.path + "/" + this.fileName + ".json", 'utf8', { "flags": "r" });
        this.config = JSON.parse(str);
    } catch (e) {
        // File not found. Check if teplate file exists.
        try {
            var str = fs.readFileSync(this.path + "/" + this.fileName + ".template.json", 'utf8', { "flags": "r" })
            this.config = JSON.parse(str);
            console.log("Cerating new config file based on template!");
            this.save(); // Save copy of template config.
        } catch (e) {
            // No template file either!
            this.config = {};
        }
    };
    return this.config;
}

ConfigStore.prototype.save = function (configObject){
    if (configObject) var config = configObject;
    else var config = this.config;
    fs.writeFileSync(this.path + "/" + this.fileName + ".json", JSON.stringify(config, this.jsonReplacer, '\t'));
}

ConfigStore.prototype.jsonReplacer = function (key, value) {
    //console.log("-- ", key, ",", value);
    if (key == undefined) return value;
    if (key.indexOf('__') == 0) return undefined;    // Don's show hidden non-usable members indicated by double underscore __.
    return value;
}
