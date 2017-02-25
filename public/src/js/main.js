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
var availableDrinkArray = [];

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


$(document).ready(function () {

    // Listen for button presses
    socket.on('buttonPress', function (data) {
        if(data === 'L') {
            $('#positive-answer').click();
        } else if (data === 'R') {
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
        'phrase' : 'Hi there! I\'m Joe, your personal barista. Tap your name tag on the reader to get started!',
        'positive_answer' : 'I don\'t have a name tag :(',
        'negative_answer' : 'I don\'t have a name tag :('
    }

    insertQuestion(introJoe);

    
    // Listen for name tag being presented
    socket.on('visitorCheckedIn', function (data) {
        if(!isServing) {
            startIcebreaker(data);
        }
    });

    // If we couldn't find user in DB, we just ignore the name part
    socket.on('couldNotFindGuest', function (data) {
        if(!isServing) {
            startIcebreaker();
        }
    });

    // If user doesn't have a name tag, they can start manually
    $('body').on('click', '.waiting-answer', function() {
        if(!isServing) {
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

    isServing = true;

    $('.waiting-answer').addClass('icebreaker-answer').removeClass('waiting-answer');

    // Get icebreaker question
    getIcebreaker(visitor_data, function(icebreaker) {
        insertQuestion(icebreaker);

        $('body').on('click', '.icebreaker-answer', function() {
        }, function(e) {
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
        });
    });
}

/*
 * Construct the icebreaker question
 *
 */
function getIcebreaker(visitor_data, callback) {

    // Check for visitor info, else use empty object
    var visitor_info = visitor_data === undefined ? {} : visitor_data[0];

    // Get weather info
    var location_data = getLocation();
    getWeatherInfo(location_data, function(weather_data) {

        // Construct welcome greetings
        var welcome_greetings = [];
        var weather_greetings = [];
        var drink_greetings = ['How about a hot cup of [DRINK]?', 'I recommend a nice cup of [DRINK]!'];
        var currentTime = date.getHours();

        // Construct first suggestion obj
        var icebreaker_suggestion = {
            'phrase' : 'How about an Espresso?',
            '_id' : '589b134671f90d703a4cf695',
            'name' : 'Espresso',
            'positive_answer' : 'Yeah, that sounds great. Hit me, Joe!',
            'negative_answer' : 'No thanks, I\'m in the mood for something different',
            'dispenser_number' : 4
        }

        var chosen_drink_greeting = drink_greetings[Math.floor(Math.random()*drink_greetings.length)];

        var shouldReactToWeather = false,
            shouldTryToUseLastDrink = false;

        // Only react to weather sometimes and when we have weather data
        if(Math.random() < 0.2 && !jQuery.isEmptyObject(weather_data)) {
            shouldReactToWeather = true;
        }
        // Only use last drink sometimes
        else if(Math.random() < 0.6) {
            shouldTryToUseLastDrink = true;
        }

        // Find the right time of day
        if(currentTime >= 6 && currentTime < 11) {
            welcome_greetings = ['Goodmorning [VISITOR]!', 'Hi [VISITOR], hope you\'re having a great morning!'];
        } else if(currentTime >= 11 && currentTime < 14) {
            welcome_greetings = ['Hi there [VISITOR]!', 'Hello [VISITOR], how are you?', 'Hi [VISITOR]! So nice to see you.', 'Welcome [VISITOR]!'];
        } else if (currentTime >= 14 && currentTime < 18) {
            welcome_greetings = ['Goodafternoon [VISITOR]!', 'Hi [VISITOR], so nice to see you this afternoon.'];
        } else if (currentTime >= 18 && currentTime < 23) {
            welcome_greetings = ['Goodevening [VISITOR]!', 'Goodevening [VISITOR], hope you\'re doing fine this lovely evening.', 'Hi [VISITOR], in the mood for an evening coffee?'];
        } else {
            welcome_greetings = ['Hi there [VISITOR]!', 'Hello [VISITOR]!'];
        }

        var chosen_welcome_greeting = welcome_greetings[Math.floor(Math.random()*welcome_greetings.length)];

        // Options if there's no visitor name
        var no_name_options = ['buddy', 'friend'];
        var visitor_name = visitor_info.name ? visitor_info.name : no_name_options[Math.floor(Math.random()*no_name_options.length)];

        // Figure out how to talk about the weather
        if(shouldReactToWeather) {
            if(parseInt(weather_data.cloudiness) > 75) {
                weather_greetings = [
                    'Woah, it\'s looking cloudy!',
                    'Man, those clouds just won\'t quit today!'
                ];
            }
            else if(parseInt(weather_data.fog) > 55) {
                weather_greetings = [
                    'It sure is foggy today. You can barely see a thing!',
                    'I heard that coffee tastes better when it\'s foggy, so today must be a great coffee day, huh?'
                ];
            }
            else if(parseInt(weather_data.rain) > 5) {
                weather_greetings = [
                    'With all this rain, it\'s a good thing we\'re inside!',
                    'Ever heard the expression "When it rains, it pours"? I\'m pretty sure they mean it pours coffee.'
                ];
            }
            else if(parseInt(weather_data.temperature) < 5) {
                weather_greetings = [
                    'It\'s a cold one out there today. You better warm yourself with a cuppa joe.',
                    'Some people say you should drink cold drinks, when it\'s cold. I strongly disagree with those people.'
                ];
            }
            else if(parseInt(weather_data.windSpeed.beaufort) > 5) {
                weather_greetings = [
                    'Wow, the wind is really building up today!',
                    'In this windy weather, luckily getting a coffee is a breeze.'
                ];
            }
            chosen_welcome_greeting += ' ' + weather_greetings[Math.floor(Math.random()*weather_greetings.length)];
        }
        else if(shouldTryToUseLastDrink) {
            if(visitor_info.last_drink !== undefined) {
                icebreaker_suggestion._id = visitor_info.last_drink.drink_id;
                icebreaker_suggestion.name = visitor_info.last_drink.drink_name;
            }
        }
        // Replace [DRINK] with chosen start drink
        chosen_drink_greeting = chosen_drink_greeting.replace('[DRINK]', icebreaker_suggestion.name);

        // Replace [VISITOR] with visitor name
        chosen_welcome_greeting = chosen_welcome_greeting.replace('[VISITOR]', visitor_name);

        // Put together the phrase before returning it
        icebreaker_suggestion.phrase = chosen_welcome_greeting + ' ' + chosen_drink_greeting;

        callback(icebreaker_suggestion);
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

    $('.elimination-answer').off('click');
    $('.elimination-answer').on('click', function(e) {
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
        checkDrinkAvailability(function(no_of_drinks) {
            if(no_of_drinks > 1) {
                eliminationRound();
            } else {
                getConfirmation(availableDrinkArray[0]);
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
function checkDrinkAvailability(callback) {
    var drink_query = choices;
    drink_query._id = {
        $nin: bannedDrinkArray
    }

    console.log(drink_query);

    sendToPath('post', '/drinks', drink_query, function (error, response) {
        console.log(response);
        availableDrinkArray = response;
        callback(availableDrinkArray.length);
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

    $('.elimination-answer').off('click');
    $('.elimination-answer').on('click', function(e) {
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
    $('.answer-container').hide();

    sendToPath('post', '/dispense', chosenDrink, function (error, response) {
        console.log(response);
    });

    // Restart programme
    setTimeout(function() {
        isServing = false;
        questionCounter = 0;
        $('.chat-buble:not(.chat-question-template, .chat-answer-template)').remove();
        startWaiting();
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

