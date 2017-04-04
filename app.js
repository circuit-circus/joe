'use strict';
var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser');
var request = require('request');
const nodemailer = require('nodemailer');
var mail_credentials = require('./mail_credentials.json');

var drinks;
var db = require('./db')
var ObjectId = require('mongodb').ObjectID;

var yrno = require('yr.no-forecast');

var fs = require('fs');

// Number of coffee left in dispensers
var coffee_inventory = [];

var latest_guest = {};

/* SETUP */
app.use('/node_modules', express.static(__dirname + '/node_modules'));
app.use(express.static(__dirname + '/public'));
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

/* CONNECT TO MONGO */
var url = 'mongodb://localhost:27017/nextM17';
db.connect(url, function(err) {
    if(err) {
        console.log('Could not connect to database');
        console.log('Error: ' + err);
        process.exit(1);
        return;
    }
    console.log('Connected to database');

    http.listen(5000, function() {
        console.log('listening on *:5000');
    });

    // Get inventory status
    var drinks = db.get().collection('coffee');
    drinks.find({}).sort({'coffee_number' : 1}).toArray(function(err, result) {
        if(err) {
            console.log('Could not find coffee in DB');
            console.log('Error: ' + err);
            return;
        }
        result.forEach(function(elem) {
            coffee_inventory.push(elem);
        });
    });
});

/* SERIAL COM */
var serialport = require('serialport');
var sp;
serialport.list(function (err, ports) {
    ports.forEach(function(port) {
        if(port.comName.indexOf('.usbmodem') !== -1) {
            console.log('Connecting to ' + port.comName);
            sp = new serialport(port.comName, {
                dataBits: 8,
                baudRate: 9600,
                parity: 'none',
                stopBits: 1,
                flowControl: false,
                parser: serialport.parsers.readline("\r\n")
            },
            function(err) {
                if(err) {
                    console.log('Error: ' + err.message);
                }
                else {
                    console.log('Port opened on ' + port.comName);
                }
            });


        }
    });
});

var listenForVisitors = false;

/* MAIL SERVER */
// create reusable transporter object using the default SMTP transport
let transporter = nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 465,
    secure: true, // use SSL
    auth: mail_credentials
});

// Listen for Arduino buttonpresses
io.on('connection', function(socket) {
    if(sp !== undefined && sp.isOpen()) {
        sp.on('data', function(input) {
            console.log(input);
            socket.emit('buttonPress', input);
        });
    }

    // Turn listening for visitors on / off
    socket.on('listenForVisitors', function(msg) {
        console.log('LISTENING FOR VISITORS');
        listenForVisitors = msg;
    });
});

/* ROUTES */
app.get('/', function(req, res, next) {
    res.render('index.html');
});

app.post('/drinks', function(req, res, next) {
    var data = req.body;

    var drinks = db.get().collection('coffee');
    drinks.find(data).toArray(function(err, result) {
        if(err) {
            console.log('Could not find coffee in DB');
            console.log('Error: ' + err);
            return;
        }
        res.send(result);
    });
});

app.post('/rfid/recieve', function(req, res, next) {
    var rfid = req.body.epc;
    console.log(rfid);
    rfid = rfid.toLowerCase();
    rfid = rfid.replace(/\s+/g, '');

    res.send('is good');

    if(!listenForVisitors) return;

    var guests = db.get().collection('guests');
    var visitor_data = db.get().collection('visitor_data');

    guests.find({'_id' : rfid}).toArray(function(err, guest_result) {
        if(err) {
            console.log('Could not find EPC in DB');
            console.log('Error: ' + err);
            return;
        }

        // Could not find guest
        if(guest_result == undefined || guest_result.length <= 0) {
            io.sockets.emit('couldNotFindGuest', guest_result);
            return;
        }

        guest_result = guest_result[0]._guest;

        latest_guest = guest_result;

        var guest_first_name = guest_result.name.substr(0, guest_result.name.indexOf(' '));
        var guest_last_name = guest_result.name.substr(guest_result.name.indexOf(' ') + 1);

        guest_result.first_name = guest_first_name;
        guest_result.last_name = guest_last_name;

        var visitor_data_query = {
            'guest_id' : guest_result._id
        }

        visitor_data.find(visitor_data_query).toArray(function(err, visitor_data_result) {
            if(err) {
                console.log('Could not find guest in visitor data');
                console.log('Error: ' + err);
                io.sockets.emit('visitorCheckedIn', guest_result);
                return;
            }

            if(visitor_data_result.length > 0 && visitor_data_result[0].last_drink != null ) {
                guest_result.last_drink = visitor_data_result[0].last_drink;
            }

            io.sockets.emit('visitorCheckedIn', guest_result);
        });

    });
});

app.post('/dispense', function(req, res, next) {
    var coffee_data = req.body;
    console.log('DISPENSING');
    console.log(coffee_data);

    var coffee_number = coffee_data.coffee_number;
    var dispenser_number = coffee_data.dispenser_number;

    // If it's a Skånerost, we might want to use the other dispenser
    if(coffee_number === 0 && coffee_inventory[0].inventory_status < 10 ) {
        console.log('USING DISPENSER 9 INSTEAD');
        dispenser_number = 9;
    }
    // Or if Espresso
    if(coffee_number === 4 && coffee_inventory[4].inventory_status < 10 ) {
        console.log('USING DISPENSER 10 INSTEAD');
        dispenser_number = 10;
    }

    var dispenser_number_arduino = dispenser_number.toString() + '\n';

    if(sp !== undefined && sp.isOpen()) {
        sp.write(dispenser_number_arduino, function(err) {
            if(err) {
                console.log('Could not send dispenser signal');
                console.log('Error: ' + err);
            }

            // Update number of coffees left in dispenser
            coffee_inventory[coffee_number].inventory_status -= 1;
            if(coffee_inventory[coffee_number].inventory_status <= 2) {
                sendWarningEmail(coffee_inventory[coffee_number]);
            }

            res.send('okk');
            sp.drain(function(error) {
                if(error) {
                    console.log('Could not drain');
                    console.log('Error: ' + err);
                }
            });

            // Update dispenser inventory in DB
            var drinks = db.get().collection('coffee');

            drinks.update({'coffee_number' : coffee_number}, { $set : {'inventory_status' : coffee_inventory[coffee_number].inventory_status}}, function(err, result) {
                if(err) {
                    console.log('Could not update number of capsules left in dispenser');
                    console.log('Error: ' + err);
                    return;
                }
            });
        });
    } else {
        console.log('SP is not oven');
    }
});

app.post('/update_visitor_last_drink', function(req, res, next) {
    var data = req.body;

    var guest_query = {
        'guest_id' : data.visitor_id
    };

    var update_query = {
        'last_drink' : data.chosen_drink_number,
        'guest_id' : data.visitor_id
    };

    var update_settings = {
        upsert: true
    }

    var visitor_data = db.get().collection('visitor_data');
    visitor_data.update(guest_query, update_query, update_settings, function(err, result) {
        if(err) {
            console.log('Could not update Last Drink');
            console.log('Error: ' + err);
            return;
        }
    });

    // Send info to groupM
    var options = { 
        method: 'POST',
        url: 'http://staging-rfid-1875619193.eu-central-1.elb.amazonaws.com/api/things',
        headers: {
            'postman-token': '97e4a82f-0f8b-f813-3ab7-ba6acca5e2f5',
            'cache-control': 'no-cache',
            'content-type': 'application/x-www-form-urlencoded'
        },
        form: { 
            type: 'coffee',
            _guest: data.visitor_id,
            name: data.chosen_drink_name
        }
    };

    request(options, function (error, response, body) {
        if(error) {
            console.log('Could not send coffee info to GroupM');
            console.log('Error: ' + err);
            return;
        }
        
        console.log('RES FROM GROUPM REQUEST:');
        console.log(body);
    });
});

app.get('/programme', function(req, res, next) {
    fs.readFile('./programme.json', 'utf8', (err, data) => {
        if(err) throw err;
        res.send(JSON.stringify(data));
    });
});

app.post('/weather', function(req, res, next) {
    var currTime = new Date();
    yrno.getWeather({
        lat: req.body.latitude,
        lon: req.body.longitude
    }, function(err, location) {
        if(err) {
            console.log('Could not get extended weather info for location');
            console.log('Error: ' + err);
            res.send(err);
        }
        if(location !== null) {
            location.getForecastForTime(currTime, function(err, result) {
                if(err) {
                    console.log('Could not get weather info for current time');
                    console.log('Error: ' + err);
                    return;
                }
                res.send(result);
            });
        }
    });
});

app.get('/reset_inventory', function(req, res, next) {

    // Update local var
    coffee_inventory.forEach(function(elem) {
        if(elem.coffee_number === 0 || elem.coffee_number === 4) {
            elem.inventory_status = 18;
        }
        else {
            elem.inventory_status = 9;
        }
    });

    // Update in DB
    var drinks = db.get().collection('coffee');
    drinks.updateMany({}, {$set: {'inventory_status' : 9}}, function(err, result) {
        if(err) {
            console.log('Could not update number of capsules left in dispenser');
            console.log('Error: ' + err);
            return;
        }
    });

    // Update Skånerost and Espresso to 18
    drinks.updateMany({'coffee_number' : {$in : [0, 4]}}, {$set: {'inventory_status' : 18}}, function(err, result) {
        if(err) {
            console.log('Could not update number of capsules left in dispenser');
            console.log('Error: ' + err);
            return;
        }
    });
    res.send('Coffee amount in dispensers has been reset');
});

app.get('/inventory_status', function(req, res, next) {
    var drinks = db.get().collection('coffee');

    drinks.find({}).toArray(function(err, result) {
        if(err) {
            console.log('Could not find coffee in DB');
            console.log('Error: ' + err);
            return;
        }

        var inventory = [];

        result.forEach(function(elem) {
            var inventory_elem = {
                'Name' : elem.name,
                'Status' : elem.inventory_status
            }
            inventory.push(inventory_elem);
        });
        res.send(inventory);
    });
});

function sendWarningEmail(coffee_elem) {
    // setup email data with unicode symbols
    let mailOptions = {
        from: '"JOE" <hello@circuit-circus.com>', // sender address
        to: 'nhoejholdt@gmail.com, hello@circuit-circus.com, foghjesperjhf@gmail.com, sandahlchristensen@gmail.com, vpermild@gmail.com', // list of receivers
        subject: coffee_elem.name + ' is running out!', // Subject line
        text: 'Hejjjj, vi er ved at løbe tør for ' + coffee_elem.name +' i dispenser nummer ' + coffee_elem.dispenser_number + '. KH Joe', // plain text body
        html: 'Hejjjj, vi er ved at løbe tør for ' + coffee_elem.name +' i dispenser nummer ' + coffee_elem.dispenser_number + '.<br><br>KH Joe' // html body
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        console.log('Message %s sent: %s', info.messageId, info.response);
    });
}