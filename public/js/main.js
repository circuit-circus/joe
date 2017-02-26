var socket = io(); // socket.io

// Location data
var HELSINKI_LOC = {
    'latitude' : 60.16952,
    'longitude' : 24.93545
};
var STOCKHOLM_LOC = {
    'latitude' : 59.33258,
    'longitude' : 18.0649
};
var COPENHAGEN_LOC = {
    'latitude' : 55.67594,
    'longitude' : 12.56553
};

var weather_data = {};

var date = new Date();

var bannedDrinkArray = [];

var choices = {};

var isServing = false;
var questionCounter = 0;
var question_data = [
    {
        "phrase" : "Would you prefer a big or a small coffee?",
        "positive_answer" : "Small for me",
        "negative_answer" : "Big, please!"
    },
    {
        "phrase" : "How strong do you like it?",
        "positive_answer" : "Not too strong",
        "negative_answer" : "Give me a kick!"
    },
    {
        "phrase" : "You want milk in that?",
        "positive_answer" : "Yes, please",
        "negative_answer" : "I like it black like my soul!"
    },
    {
        "phrase" : "How frothy you want that milk?",
        "positive_answer" : "Lots of froth",
        "negative_answer" : "No froth"
    }
];

var isWaiting = false;
var isListeningForVisitor = false;
var iceBreakerStarted = false;

$(document).ready(function () {

    // Listen for button presses
    socket.on('buttonPress', function (data) {
        if(data === 'L') {
            console.log('Got L');
            $('#positive-answer').click();
        } else if (data === 'R') {
            console.log('Got R');
            $('#negative-answer').click();
        }
    });

    if(!isServing) {
        startWaiting();
    }
});

/*
 * Function for starting the waiting process - that is, when Joe is not in use, but waiting for someone to tap their card or start him manually
 *
 */
function startWaiting() {
    var introJoe = {
        'phrase' : 'Hi there! I\'m Joe, your personal barista. Press a button to get started!'
    }
    var q_clone = $('.chat-question-template').clone();
    q_clone.text(introJoe.phrase);
    q_clone.removeClass('chat-question-template').addClass('chat-question');
    $('.conversation-container').append(q_clone);

    isWaiting = true;
    $('body').off('click', '.waiting-answer');
    $('body').on('click', '.waiting-answer', function(e) {
        if(isWaiting) {
            console.log('Clicked answer option for starting to listening for visitor');
            isListeningForVisitor = true;
            isWaiting = false;

            setTimeout(function() {
                if(!iceBreakerStarted) {
                    console.log('Found no RFID');
                    startIcebreaker();
                }
            }, 2000);
        }
    });

    // Listen for name tag being presented
    socket.on('visitorCheckedIn', function (data) {
        if(!isServing && isListeningForVisitor) {
            console.log('Found visitor');
            startIcebreaker(data);
        }
    });

    // If we couldn't find user in DB, we just ignore the name part
    socket.on('couldNotFindGuest', function (data) {
        if(!isServing && isListeningForVisitor) {
            console.log('Found RFID but no visitor');
            startIcebreaker();
        }
    });

}

/*
 * First round of the programme, the ice breaker, where Joe suggests a coffee
 *
 * @param visitorData (Object) OPTIONAL. The visitor data from the RFID
 */
function startIcebreaker(visitor_data) {
    isListeningForVisitor = false;
    isServing = true;
    iceBreakerStarted = true;

    // Get icebreaker question
    getIcebreaker(visitor_data, function(icebreaker) {
        insertQuestion(icebreaker);
        $('.answer-option').removeClass('waiting-answer').addClass('icebreaker-answer');
        $('.answer-container').removeClass('hidden');

        $('body').off('click', '.icebreaker-answer');
        $('body').on('click', '.icebreaker-answer', function(e) {
            console.log(e);
            if(iceBreakerStarted = true) {
                console.log('Clicked icebreaker answer');
                iceBreakerStarted = false;
                $('.icebreaker-answer').addClass('elimination-answer').removeClass('icebreaker-answer');
                var text = $(this).text();
                var a_clone = $('.chat-answer-template').clone();
                a_clone.text(text);
                a_clone.removeClass('chat-answer-template').addClass('chat-answer');
                $('.conversation-container').append(a_clone);
                if(e.target.id === 'positive-answer') {
                    finishJoe(icebreaker);
                }
                if(e.target.id === 'negative-answer') {
                    bannedDrinkArray.push(icebreaker._id);
                    eliminationRound();
                }
            }
        });
    });
}

/*
 * Construct the icebreaker question
 *
 */
function getIcebreaker(visitor_data, callback) {

    var icebreaker_choices;

    // Check for visitor info, else use empty object
    var visitor_info = visitor_data === undefined ? {} : visitor_data[0];

    // Get weather info
    var location_data = getLocation();
    getWeatherInfo(location_data, function(weather_data) {

        var welcome_greetings = [
            'Hi there [VISITOR]!',
            'Hello [VISITOR]!'
        ];
        var drink_greetings = [
            'What about a hot cup of [DRINK]?',
            'Would you like a nice cup of [DRINK]?'
        ];
        var no_name_options = ['buddy', 'friend'];

        var icebreaker_choices = {};
        var chosen_welcome_greeting;
        var chosen_drink_greeting;

        // Choose which elements to react to and suggest from
        var elements = ['programme', 'time'];
        if(visitor_info.lastDrink)elements.push('lastDrink');
        if(!$.isEmptyObject(weather_data)) elements.push('weather');
        elements = shuffle(elements);
        var reactToElements = [elements[0], elements[1]];

        console.log('REACTING TO');
        console.log(reactToElements);

        /* TIME */
        var currentTime = date.getHours();
         // Find the right time of day
        if(currentTime >= 6 && currentTime < 11) {
            welcome_greetings = [
                'Goodmorning [VISITOR]!',
                'Hi [VISITOR], hope you\'re having a great morning!'
            ];
            if(reactToElements[0] === 'time') {
                icebreaker_choices.strength = {$in: [2]};
                drink_greetings = [
                    'Would you like a nice strong cup of [DRINK]?',
                    'It\'s early, how about a nice strong [DRINK] to wake you up?'
                ];
            }

        } else if(currentTime >= 11 && currentTime < 14) {
            welcome_greetings = [
                'Hi there [VISITOR]!',
                'Hello [VISITOR], how are you?',
                'Hi [VISITOR]! So nice to see you.',
                'Welcome [VISITOR]!'
            ];

        } else if (currentTime >= 14 && currentTime < 18) {
            welcome_greetings = [
                'Goodafternoon [VISITOR]!',
                'Hi [VISITOR], so nice to see you this afternoon.'
            ];
            if(reactToElements[0] === 'time') {
                icebreaker_choices.milk = {$in: [1]};
                drink_greetings = [
                    'How about a smooth cup of [DRINK]?',
                    'Would you like an afternoon [DRINK]?'
                ];
            }

        } else if (currentTime >= 18 && currentTime < 23) {
            welcome_greetings = [
                'Goodevening [VISITOR]!',
                'Goodevening [VISITOR], hope you\'re doing fine this lovely evening.'
            ];
            if(reactToElements[0] === 'time') {
                icebreaker_choices.strength = {$in: [1]};
                drink_greetings = [
                    'In the mood for a cup of [DRINK]?',
                    'Don\'t want too much caffeine this late, how about a nice cup of [DRINK]?'
                ];
            }
        }
        console.log('WELCOME GREETINGS');
        console.log(welcome_greetings);
        chosen_welcome_greeting = welcome_greetings[Math.floor(Math.random()*welcome_greetings.length)];

        /* WEATHER */
        var weather_elements = [];
        if(parseInt(weather_data.cloudiness) > 75) weather_elements.push('cloudy');
        if(parseInt(weather_data.fog) > 55) weather_elements.push('foggy');
        if(parseInt(weather_data.rain) > 5) weather_elements.push('rainy');
        if(parseInt(weather_data.temperature) < 5) weather_elements.push('cold');
        if(parseInt(weather_data.windSpeed.beaufort) > 5) weather_elements.push('windy');
        var chosen_weather_element = weather_elements[Math.floor(Math.random()*weather_elements.length)];

        console.log('CHOSEN WEATHER ELEMENT');
        console.log(chosen_weather_element);

        console.log('WEAHTER');
        console.log(weather_data);

        if(reactToElements[0] === 'weather' || reactToElements[1] === 'weather') {
            if(chosen_weather_element === 'cloudy') {
                weather_greetings = [
                    'Woah, it\'s looking cloudy!',
                    'Man, those clouds just won\'t quit today!'
                ];

                if(reactToElements[ 0] === 'weather') {
                    icebreaker_choices.strength = {$in: [1]};
                    drink_greetings = [
                        'I think cloudiness calls for a nice cup of [DRINK]!'
                    ];
                }
            }
            else if(chosen_weather_element === 'foggy') {
                weather_greetings = [
                    'It sure is foggy today. You can barely see a thing!',
                    'I heard that coffee tastes better when it\'s foggy, so today must be a great coffee day, huh?'
                ];
            }
            else if(chosen_weather_element === 'rainy') {
                weather_greetings = [
                    'With all this rain, it\'s a good thing we\'re inside!',
                    'Ever heard the expression "When it rains, it pours"? I\'m pretty sure they mean it pours coffee.'
                ];
                if(reactToElements[0] === 'weather') {
                    icebreaker_choices.milk = {$in: [1]};
                    drink_greetings = [
                        'I think milky drinks goes great with rain. How about a cup of [DRINK]?',
                        'Rain = milk, yes? Would you like a delicious [DRINK]?'
                    ];
                }
            }
            else if(chosen_weather_element === 'cold') {
                weather_greetings = [
                    'It\'s a cold one out there today. You better warm yourself with a cuppa joe.',
                    'Some people say you should drink cold drinks, when it\'s cold. I strongly disagree with those people.'
                ];
                if(reactToElements[0] === 'weather') {
                    icebreaker_choices.size = {$in: [2]};
                    drink_greetings = [
                        'With a temperature like this, you might want a big hot cup of [DRINK]?',
                        'How about a big nice cup of [DRINK] to warm you up?'
                    ];
                }
            }
            else if(chosen_weather_element === 'windy') {
                weather_greetings = [
                    'Wow, the wind is really building up today!',
                    'In this windy weather, luckily getting a coffee is a breeze.'
                ];
            }
            chosen_welcome_greeting += ' ' + weather_greetings[Math.floor(Math.random()*weather_greetings.length)];
        }

        /* LAST DRINK */

        /* PROGRAMME */


        console.log('DRINK GREETINGS');
        console.log(drink_greetings);

        console.log('ICEBREAKER CHOICES');
        console.log(icebreaker_choices);

        // If there's only one option left, that's the coffee
        getAvailableDrinks(icebreaker_choices, function(availableDrinks) {
            var suggested_drink = availableDrinks[0];

            chosen_drink_greeting = drink_greetings[Math.floor(Math.random()*drink_greetings.length)];

            // Options if there's no visitor name
            var visitor_name = visitor_info.name ? visitor_info.name : no_name_options[Math.floor(Math.random()*no_name_options.length)];
            // Replace [DRINK] with chosen start drink
            chosen_drink_greeting = chosen_drink_greeting.replace('[DRINK]', suggested_drink.name);

            // Replace [VISITOR] with visitor name
            chosen_welcome_greeting = chosen_welcome_greeting.replace('[VISITOR]', visitor_name);

            // Put together the phrase before returning it
            var icebreaker_suggestion = suggested_drink;
            icebreaker_suggestion.phrase = chosen_welcome_greeting + ' ' + chosen_drink_greeting;
            icebreaker_suggestion.positive_answer = 'Yeah, that sounds great. Hit me, Joe!';
            icebreaker_suggestion.negative_answer = 'No thanks, I\'m in the mood for something different';

            callback(icebreaker_suggestion);
        });

    });
}

/*
 * Get location of the current event for the weather service
 *
 * @return (Object) The current location coordinates
 */
function getLocation() {
    if(date.getMonth() === 2) {
        if(date.getDate() < 29) {
            return HELSINKI_LOC;
        }
        else {
            return STOCKHOLM_LOC;
        }
    }
    else {
        return COPENHAGEN_LOC;
    }
}

function getWeatherInfo(location_data, callback) {
    sendToPath('post', '/weather', location_data, function (error, response) {
        // Empty weather_data, if we get an error code
        if(response.errno === undefined) {
            weather_data = response;
        }
        else {
            weather_data = {};
        }

        callback(weather_data);
    });
}

/*
 * Do the thing where we ask people questions about what they want
 *
 */
function eliminationRound() {
    /*if(questionCounter >= question_data.length) {
        finishJoe();
        return;
    }*/
    var question = question_data[questionCounter];
    insertQuestion(question);

    $('body').off('click', '.elimination-answer');
    $('body').on('click', '.elimination-answer', function(e) {
        console.log('Clicked elimination answer');
        var text = $(this).text();
        var a_clone = $('.chat-answer-template').clone();
        a_clone.text(text);
        a_clone.removeClass('chat-answer-template').addClass('chat-answer');
        $('.conversation-container').append(a_clone);

        var answer;

        if(e.target.id === 'positive-answer') {
            answer = 'pos';
        }
        if(e.target.id === 'negative-answer') {
            answer = 'neg';
        }

        switch(questionCounter) {
            case 0:
                choices.size = answer === 'pos' ? {$in: [1]} : {$in: [2]};
                break;
            case 1:
                choices.strength = answer === 'pos' ? {$in: [1]} : {$in: [2]};
                break;
            case 2:
                if(answer === 'pos') {
                    choices.milk = {$in: [1]};
                } else if (answer === 'neg') {
                    choices.milk = {$in: [0]};
                    choices.milk_froth = {$in: [0]};
                }
                break;
            case 3:
                choices.milk_froth = answer === 'pos' ? {$in: [1]} : {$in: [2]};
                break;
        }

        questionCounter++;

        // If there's only one option left, that's the coffee
        getAvailableDrinks(choices, function(availableDrinks) {
            if(availableDrinks.length > 1) {
                eliminationRound();
            } else {
                getConfirmation(availableDrinks[0]);
            }
        });

    });

}

/*
 * Insert questions / answers to the dom
 *
 */
function insertQuestion(data) {

    var q_clone = $('.chat-question-template').clone();
    q_clone.text(data.phrase);
    q_clone.removeClass('chat-question-template').addClass('chat-question');
    $('.conversation-container').append(q_clone);

    $('.answer-option#positive-answer').text(data.positive_answer);
    $('.answer-option#negative-answer').text(data.negative_answer);

    scrollConversation();
}

/*
 * Utility function to scroll to the bottom chat
 *
 */
function scrollConversation() {
    var elem = $('.chat-buble').last();
    var newScrollpos = Math.abs( ($('.conversation-container')[0].scrollHeight - elem.offset().top) + elem.height());
    $('.conversation-container').animate({ scrollTop: newScrollpos }, 750);
}

/*
 * Check drink avaibility from the data
 *
 */
function getAvailableDrinks(drink_query, callback) {
    drink_query._id = {
        $nin: bannedDrinkArray
    }

    //console.log(drink_query);

    sendToPath('post', '/drinks', drink_query, function (error, response) {
        console.log(response);
        callback(response);
    });
}

/*
 * Get visitor info
 *
 */
function getVisitorInfo() {
    var visitor_info = {
        first_name : 'Nina',
        last_name : 'Højholdt',
        last_drink : {
            drink_name : 'Americano',
            drink_id : '589b133671f90d703a4cf693'
        }
    }

    return visitor_info;
}

/*
 * Get confirmation about the chosen drink from the user
 *
 */
function getConfirmation(chosenDrink) {

    // Construct first suggestion obj
    var qData = {
        'phrase' : 'Great! What do you think of getting a ' + chosenDrink.name + ' then?',
        'positive_answer' : 'I\'d love one of those! Hook me up with a cup of ' + chosenDrink.name + '!',
        'negative_answer' : 'No, that wasn\'t exactly what I was looking for.'
    }

    insertQuestion(qData);

    $('body').off('click', '.elimination-answer');
    $('body').on('click', '.elimination-answer', function(e) {
        console.log('Clicked elimination answer for confirmation');
        var text = $(this).text();
        var a_clone = $('.chat-answer-template').clone();
        a_clone.text(text);
        a_clone.removeClass('chat-answer-template').addClass('chat-answer');
        $('.conversation-container').append(a_clone);

        var answer;

        if(e.target.id === 'positive-answer') {
            answer = 'pos';
        }
        if(e.target.id === 'negative-answer') {
            answer = 'neg';
        }

        if(answer === 'pos') {
            finishJoe(chosenDrink);
        }
        else {
            choices = {};
            bannedDrinkArray.push(chosenDrink._id)
            questionCounter = 0;
            eliminationRound();
        }
    });
}

/*
 * Finish
 *
 */
function finishJoe(chosenDrink) {
    var joeFinish = $('<div class="chat-question chat-buble"></div>');
    joeFinish.text('Great! Here\'s your ' + chosenDrink.name);
    $('.conversation-container').append(joeFinish);
    scrollConversation();
    $('.answer-container').addClass('hidden');

    sendToPath('post', '/dispense', chosenDrink, function (error, response) {
        console.log(response);
    });

    choices = {};
    bannedDrinkArray = [];
    isServing = false;
    questionCounter = 0;

    // Restart programme
    setTimeout(function() {
        $('.conversation-container .chat-buble:not(.chat-question-template, .chat-answer-template)').remove();
        $('.answer-option').addClass('waiting-answer').removeClass('elimination-answer icebreaker-answer');
        startWaiting();
        //window.location.reload();
    }, 2000);
}

/*
 * Send to route
 *
 */
function sendToPath(method, path, data, progress, done) {

    var callback = done || progress;

    var options = {
        url      : path,
        type     : method,
        contentType: 'application/json',
        dataType : 'json',
        data     : JSON.stringify(data),
        xhrFields: {
            withCredentials: true
        },
        success  : function (body) {
            if (body.status == 1) {
                // Redirect to destination if user is no longer logged in
                if (body.code === 'NOT_LOGGED_IN') {
                    $.notify('You are no longer logged in - redirecting you to the front page', 'failure');
                    setTimeout(function () { handleRegistrationNextStep(body.next_step); }, 3000);
                    return;
                }
                callback(body);
            } else {
                callback(undefined, body);
            }
        },
        error    : function (body) {
            if(body.responseJSON) {
                callback(body.responseJSON);
            } else {
                callback({
                    status: 1,
                    message: "Action failed, please try again later"
                })
            }
        }
    };

    // If a progress callback is specified, add event listener if possible
    if (done) {
        options.xhr = function () {
            var xhr = new window.XMLHttpRequest();

            if (xhr.upload) {
                xhr.upload.addEventListener('progress', function (e) {
                    if (e.lengthComputable) {
                        var percent = e.loaded / e.total;
                        progress(percent);
                    }
                }, false);
            }

            return xhr;
        }
    }
    $.ajax(options);
}

/**
 * Shuffles array in place. ES6 version
 * @param {Array} a items The array containing the items.
 */
function shuffle(a) {
    var j, x, i;
    for (i = a.length; i; i--) {
        j = Math.floor(Math.random() * i);
        x = a[i - 1];
        a[i - 1] = a[j];
        a[j] = x;
    }
    return a;
}
