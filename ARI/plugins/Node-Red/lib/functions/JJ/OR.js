// name: OR
// outputs: 1
context.inputs = context.inputs || {};
var bool =  msg.payload >= 1 ||
            msg.payload === "1" || 
            msg.payload === "true" ||
            msg.payload === "True" ||
            msg.payload === "TRUE";
context.inputs[msg.topic] = bool;

var result = false;
for(var input in context.inputs){
    var i = context.inputs[input];
    result = result || i;
}
msg.topic = "OR";
msg.payload = result === true;
return msg;