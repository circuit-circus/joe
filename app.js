'use strict';
var express = require('express');
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
var mail_credentials = require('./mail_credentials.json');

var drinks;
var db = require('./db')
var ObjectId = require('mongodb').ObjectID;

var yrno = require('yr.no-forecast');

var fs = require('fs');

// Number of coffee left in dispensers
var coffee_inventory = [];

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
    drinks.find({}).toArray(function(err, result) {
        if(err) {
            console.log('Could not find coffee in DB');
            console.log('Error: ' + err);
            return;
        }
        result.forEach(function(elem) {
            coffee_inventory.push(elem.inventory_status);
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

    var tagsession_query = req.body;
    if(!tagsession_query) return;

    res.send('is good');

    if(!listenForVisitors) return;

    var tagsessions = db.get().collection('tagsessions');
    var guests = db.get().collection('guests');
    var visitor_data = db.get().collection('visitor_data');

    tagsessions.find(tagsession_query).toArray(function(err, tagsession_result) {
        if(err) {
            console.log('Could not find EPC in DB');
            console.log('Error: ' + err);
            return;
        }

        // Could not find guest
        if(tagsession_result.length <= 0) {
            io.sockets.emit('couldNotFindGuest', tagsession_result);
            return;
        }

        var guest_query = {
            _id : tagsession_result[0]._guest
        }

        guests.find(guest_query).toArray(function(err, guest_result) {
            if(err) {
                console.log('Could not find Guest in DB');
                console.log('Error: ' + err);
                return;
            }

            var guest_first_name = guest_result[0].name.substr(0, guest_result[0].name.indexOf(' '));
            var guest_last_name = guest_result[0].name.substr(guest_result[0].name.indexOf(' ') + 1);

            guest_result[0].first_name = guest_first_name;
            guest_result[0].last_name = guest_last_name;

            var visitor_data_query = {
                'guest_id' : guest_result[0]._id
            }

            visitor_data.find(visitor_data_query).toArray(function(err, visitor_data_result) {
                if(err) {
                    console.log('Could not find guest in visitor data');
                    console.log('Error: ' + err);
                    io.sockets.emit('visitorCheckedIn', guest_result[0]);
                    return;
                }

                if(visitor_data_result.length > 0 && visitor_data_result[0].last_drink != null ) {
                    guest_result[0].last_drink = visitor_data_result[0].last_drink;
                }

                io.sockets.emit('visitorCheckedIn', guest_result[0]);
            });
        });

    });
});

app.post('/dispense', function(req, res, next) {
    var data = req.body;
    var coffee_number = data.coffee_number;
    var coffee_number_arduino = coffee_number.toString() + '\n';

    if(sp !== undefined && sp.isOpen()) {
        sp.write(coffee_number_arduino, function(err) {
            if(err) {
                console.log('Could not send dispenser signal');
                console.log('Error: ' + err);
            }

            // Update number of coffees left in dispenser
            coffee_inventory[coffee_number] = coffee_inventory[coffee_number] - 1;
            if(coffee_inventory[coffee_number] <= 2) {
                sendWarningEmail(coffee_number);
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
            drinks.update({'dispenser_number' : coffee_number}, {'inventory_status' : coffee_inventory[coffee_number]}, function(err, result) {
                if(err) {
                    console.log('Could not update number of capsules left in dispenser');
                    console.log('Error: ' + err);
                    return;
                }
            });
        });
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
    coffee_inventory = [10, 10, 10, 10, 10, 10];
    var drinks = db.get().collection('coffee');
    drinks.updateMany({}, {$set: {'inventory_status' : 10}}, function(err, result) {
        if(err) {
            console.log('Could not update number of capsules left in dispenser');
            console.log('Error: ' + err);
            return;
        }
        res.send('Coffee amount in dispensers has been reset');
    });
});

app.get('/inventory_status', function(req, res, next) {

    var drinks = db.get().collection('coffee');

    drinks.find({}).toArray(function(err, result) {
        if(err) {
            console.log('Could not find coffee in DB');
            console.log('Error: ' + err);
            return;
        }
        res.send(result);
    });
});

function sendWarningEmail(coffee_number) {
    // setup email data with unicode symbols
    let mailOptions = {
        from: '"JOE" <hello@circuit-circus.com>', // sender address
        to: 'nhoejholdt@gmail.com, hello@circuit-circus.com, foghjesperjhf@gmail.com, sandahlchristensen@gmail.com, vpermild@gmail.com', // list of receivers
        subject: 'Coffee ' + coffee_number + ' is running out!', // Subject line
        text: 'Hejjjj, vi er ved at løbe tør for kaffe i dispenser nummer ' + coffee_number + '. KH Joe', // plain text body
        html: 'Hejjjj,<br> vi er ved at løbe tør for kaffe i dispenser nummer ' + coffee_number + '.<br><br>KH Joe' // html body
    };

    // send mail with defined transport object
    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        console.log('Message %s sent: %s', info.messageId, info.response);
    });

}

