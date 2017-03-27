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

var current_visitor = null;

var isServing = false;
var questionCounter = 0;
var question_data = [
    {
        "phrase" : "No problem, let's find something you like! Would you prefer a big or a small coffee?",
        "positive_answer" : "Small for me, thanks.",
        "negative_answer" : "A big one, please!"
    },
    {
        "phrase" : "Great, and how strong do you like it?",
        "positive_answer" : "Not too strong.",
        "negative_answer" : "Give me a kick!"
    },
    {
        "phrase" : "Alright, we're getting closer! Would you like a milky coffee?",
        "positive_answer" : "Yes, give me milk please!",
        "negative_answer" : "Nope, I prefer it black."
    },
    {
        "phrase" : "Yum, I love milky drinks too. Would you like it frothy?",
        "positive_answer" : "Frothy sounds delicious, hit me!",
        "negative_answer" : "No thanks, not this time."
    }
];

var isWaiting = false;
var isListeningForVisitor = false;
var iceBreakerStarted = false;

var noActionTimer,
    noActionQuestionTimer,
    dotsTimer;

var recentConversation = {
    "phrase" : "Sure thing. Just take your time!"
};
var recentClass;
var shouldSaveRecentConversation = true;

$(document).ready(function () {

    // Set listener for asking user whether they're still there
    $('body').on('click', '#positive-answer, #negative-answer', function() {
        restartTimer();
    });

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

    $('body').off('click', '.lol');
    $('body').on('click', '.lol', function() {
        $('#positive-answer').click();
    });

    if(!isServing) {
        startWaiting();
    }
});

/*
 * Function for adding some dots that indicate that Joe is typing
 *
 */
function startDots(callback) {
    dotsTimer = setTimeout(function() {
        // Remove any duplicate dots
        removeDots();
        
        var d_clone = $('.chat-dots-template').clone();
        d_clone.removeClass('chat-dots-template').addClass('chat-dots');
        $('.conversation-container').append(d_clone);
        scrollConversation();
        callback();
    }, (Math.random() * 400) + 400);
}

/*
 * Function for removing the dots
 *
 */
function removeDots() {
    $('.chat-dots').remove();
}

/*
 * Function for asking the visitor whether they are still at the booth
 *
 */
function askForPerson() {
    ga('send', 'event', 'Timeout', 'Are you still there?');

    var qData = {
        'phrase' : 'Are you still there?',
        'positive_answer' : 'Yup! I\'m just thinking',
        'negative_answer' : 'No, it\'s seems the other person left. Can you help me find a coffee?'
    }
    shouldSaveRecentConversation = false;

    startDots(function() {

        insertQuestion(qData, function() {
            $('.answer-option').removeClass(recentClass);

            $('body').off('click', '.activity-answer');
            $('body').on('click', '.activity-answer', function(e) {
                if(e.target.id === 'positive-answer') {
                    resumeConversation(qData);
                }
                if(e.target.id === 'negative-answer') {
                    restartJoe(0);
                }
            });
        });

        $('.answer-option').addClass('activity-answer');
    });
}

/*
 * Start the timers that make sure the user is still there
 *
 */
function restartTimer() {
    removeDots();
    clearTimeout(noActionQuestionTimer);
    clearTimeout(noActionTimer);
    clearTimeout(dotsTimer);
    noActionTimer = setTimeout(askForPerson, 120000);
}

/*
 * Continue the conversation after asking whether the user is still there
 *
 */
function resumeConversation(data) {
    shouldSaveRecentConversation = true;

    var text = data.positive_answer;
    updateAnswerDOM(text);

    startDots(function() {
        insertQuestion(recentConversation, function() {
            $('.answer-option').addClass(recentClass);
        });
    });
}

/*
 * Function for starting the waiting process - that is, when Joe is not in use, but waiting for someone to tap their card or start him manually
 *
 */
function startWaiting() {

    $('body').addClass('waiting-for-guest');

    var introJoeGreetings = [
        'Hi there! I\'m Joe, your personal barista. Step inside and press a button to get started!',
        'Hey! My name is Joe. I\'m your personal barista. Step inside and press a button, so we can get started!',
        'Hi, how are you? I\'m your personal barista, Joe. Step inside and press one of the buttons and I\'ll help you find the perfect coffee.'
    ];
    var introJoe = {
        'phrase' : introJoeGreetings[Math.floor(Math.random()*introJoeGreetings.length)]
    };
    updateQuestionDOM(introJoe.phrase, true);
    $('body').addClass('waiting-for-guest');
    $('.answer-container').addClass('hidden');

    isWaiting = true;
    $('body').off('click', '.waiting-answer');
    $('body').on('click', '.waiting-answer', function(e) {
        if(isWaiting) {
            $('body').removeClass('waiting-for-guest');

            isListeningForVisitor = true;
            isWaiting = false;

            startDots(function() {});

            socket.emit('listenForVisitors', true);

            setTimeout(function() {
                if(!iceBreakerStarted) {
                    ga('send', 'event', 'RFID Scan', 'Fail');
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
            ga('send', 'event', 'RFID Scan', 'Success');
            current_visitor = data;
            startIcebreaker();
        }
    });

    // If we couldn't find user in DB, we just ignore the name part
    socket.on('couldNotFindGuest', function (data) {
        if(!isServing && isListeningForVisitor) {
            console.log('Found RFID but no visitor');
            ga('send', 'event', 'RFID Scan', 'Success, but not in db');
            startIcebreaker();
        }
    });

}

/*
 * First round of the programme, the ice breaker, where Joe suggests a coffee
 *
 * @param visitorData (Object) OPTIONAL. The visitor data from the RFID
 */
function startIcebreaker() {

    removeDots();

    isListeningForVisitor = false;
    socket.emit('listenForVisitors', false);
    isServing = true;
    iceBreakerStarted = true;

    // Get icebreaker question
    getIcebreaker(function(icebreaker) {
        var thisIcebreaker = icebreaker;
        startDots(function() {
            insertQuestion(thisIcebreaker, function() {
                $('.answer-option').removeClass('waiting-answer').addClass('icebreaker-answer');
                $('.answer-container').removeClass('hidden');

                $('body').off('click', '.icebreaker-answer');
                $('body').on('click', '.icebreaker-answer', function(e) {
                    if(iceBreakerStarted = true) {
                        iceBreakerStarted = false;
                        $('.icebreaker-answer').addClass('elimination-answer').removeClass('icebreaker-answer');
                        var text = $(this).text();
                        updateAnswerDOM(text);

                        if(e.target.id === 'positive-answer') {
                            finishJoe(thisIcebreaker);
                        }
                        if(e.target.id === 'negative-answer') {
                            bannedDrinkArray.push(thisIcebreaker._id);
                            eliminationRound();
                        }
                    }
                });
            });
        });
    });
} // Holy batman that indentation

/*
 * Construct the icebreaker question
 *
 */
function getIcebreaker(callback) {

    // Check for visitor info, else use empty object
    var visitor_info = current_visitor === null ? {} : current_visitor;

    // Get weather info
    var location_data = getLocation();
    getWithTheProgramme(location_data, function(programme_data) {
        getWeatherInfo(location_data, function(weather_data) {

            var welcome_greetings = [
                'Hi there [VISITOR]!',
                'Hello [VISITOR]!'
            ];
            var drink_greetings = [
                'What about a hot cup of [DRINK]?',
                'Would you like a nice cup of [DRINK]?'
            ];
            var no_name_options = ['friend', 'partner'];

            var icebreaker_choices = {};
            var chosen_welcome_greeting;
            var chosen_drink_greeting;


            // Check if weather is relevant
            var weather_elements = [];
            if(!$.isEmptyObject(weather_data)) {
                if(parseInt(weather_data.cloudiness) > 75) weather_elements.push('cloudy');
                if(parseInt(weather_data.fog) > 55) weather_elements.push('foggy');
                if(parseInt(weather_data.rain) > 5) weather_elements.push('rainy');
                if(parseInt(weather_data.temperature) < 5) weather_elements.push('cold');
                if(parseInt(weather_data.windSpeed.beaufort) > 5) weather_elements.push('windy');
            }
            var chosen_weather_element = weather_elements[Math.floor(Math.random()*weather_elements.length)];
            // console.log('CHOSEN WEATHER ELEMENT');
            // console.log(chosen_weather_element);

            // Choose which elements to react to and suggest from
            var elements = ['programme', 'time'];
            if(visitor_info.last_drink) elements.push('last_drink');
            if(!$.isEmptyObject(weather_data) && chosen_weather_element !== undefined) elements.push('weather');
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
                    'Welcome [VISITOR]!',
                    'Howdy [VISITOR]!'
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
            // console.log('WELCOME GREETINGS');
            // console.log(welcome_greetings);
            chosen_welcome_greeting = welcome_greetings[Math.floor(Math.random()*welcome_greetings.length)];


            /* WEATHER */
            // console.log('WEAHTER');
            // console.log(weather_data);

            if(reactToElements[0] === 'weather' || reactToElements[1] === 'weather') {
                console.log(chosen_weather_element);
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
            if(reactToElements[0] === 'last_drink') {

                icebreaker_choices = {
                    'coffee_number' : visitor_info.last_drink
                }

                drink_greetings = [
                    'Last time you visited me, you had a cup of [DRINK]. Would you like that again?',
                    'How did you enjoy the [DRINK] you had last time? Wan\'t another one of those?'
                ];
            }

            /* PROGRAMME */
            if(reactToElements[0] === 'programme' || reactToElements[1] === 'programme') {
                var rightNow = moment();

                var thisEvent = null;
                var programme_greetings = [''];

                programme_data.forEach(function(elem) {
                    var program_elem_start = parseTime(elem.time.start_time);
                    var program_elem_before_start = program_elem_start.clone();
                    program_elem_before_start.subtract(15, 'minutes');

                    if(rightNow.isBetween(program_elem_before_start, program_elem_start)) {
                        thisEvent = elem;

                        if(thisEvent.speaker !== undefined) {
                            thisEvent.speaker = parseEventSpeaker(thisEvent.speaker);
                        }
                    }
                });

                // console.log('PROGRAMME DATA:');
                // console.log(programme_data);
                if(thisEvent !== null) {
                    if(thisEvent.location !== 'Tech Garden') {
                        programme_greetings = [
                            'Oh! It looks like ' + thisEvent.speaker[0] + ' is about to start a talk on ' + thisEvent.location + '. ',
                            'Let\'s get you a coffee. Quick! Because ' + thisEvent.speaker[0] + ' is gonna talk on ' + thisEvent.location + ' at ' + thisEvent.time.start_time + '. '
                        ];

                        if(reactToElements[0] === 'programme') {
                            drink_greetings = [
                                'I think a [DRINK] would be perfect for the occasion!',
                                'To keep you warm during the talk, I highly recommend a [DRINK]!'
                            ];
                        }
                    }
                    else {
                        if(thisEvent.title.indexOf('/') !== -1) {
                            thisEvent.title = thisEvent.title.substring(0, thisEvent.title.indexOf('/'));
                        }

                        programme_greetings = [
                            'There\'s ' + thisEvent.title + ' in the ' + thisEvent.location + ' in a few minutes. And still you chose to come and hang out with me! '
                        ];

                        if(reactToElements[0] === 'programme') {
                            drink_greetings = [
                                'How about a [DRINK] to celebrate our friendship?',
                                'To thank you, I\'d love to get you a [DRINK]!'
                            ];
                        }
                    }
                    chosen_welcome_greeting += ' ' + programme_greetings[Math.floor(Math.random()*programme_greetings.length)];
                }
            }

            // console.log('DRINK GREETINGS');
            // console.log(drink_greetings);

            // console.log('ICEBREAKER CHOICES');
            // console.log(icebreaker_choices);

            // If there's only one option left, that's the coffee
            getAvailableDrinks(icebreaker_choices, function(availableDrinks) {
                var suggested_drink = availableDrinks[0];
                // console.log('SUGGESTED');
                // console.log(suggested_drink);

                chosen_drink_greeting = drink_greetings[Math.floor(Math.random()*drink_greetings.length)];

                // Options if there's no visitor name
                var visitor_name = visitor_info.first_name ? visitor_info.first_name : no_name_options[Math.floor(Math.random()*no_name_options.length)];
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
    });
}

function parseEventSpeaker(speaker) {
    console.log(speaker);
    if(speaker.indexOf('/') !== -1) {
        speaker = speaker.split(' / ');
        console.log(speaker);
    }
    else {
        speaker = [speaker];
    }
    return speaker;
}

function parseTime(thisTime) {
    var hour = thisTime.substring(0, 2);
    var minute = thisTime.substring(3, 5);
    var hourInt = parseInt(hour);
    var minuteInt = parseInt(minute);

    /*var timeStr = "";
    if(hourInt < 12) {
        timeStr = hour + ":" + minute + "AM";
    }
    else {
        timeStr = (hourInt - 12) + ":" + minute + "PM";
    }*/

    var thisMoment = moment();
    thisMoment.hour(hourInt);
    thisMoment.minute(minuteInt);

    return thisMoment;
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

function getWithTheProgramme(location_data, callback) {
    sendToPath('get', '/programme', {}, function(error, response) {
        if(!error) {
            response = JSON.parse(response);
            var thisLocation;
            if(location_data.longitude == HELSINKI_LOC.longitude) {
                thisLocation = 'Helsinki';
            }
            else if(location_data.longitude == STOCKHOLM_LOC.longitude) {
                thisLocation = 'Stockholm';
            }
            else if(location_data.longitude == COPENHAGEN_LOC.longitude) {
                thisLocation = 'Copenhagen';
            }

            var thisProgramme;
            for(var i = 0; i < response.length; i++) {
                if(thisLocation === response[i].location) {
                    thisProgramme = response[i].day_programmes;
                }
            }

            // If today is Wednesday
            if(date.getDay() === 3) {
                thisProgramme = thisProgramme.wednesday;
            }
            else {
                thisProgramme = thisProgramme.thursday;
            }

            callback(thisProgramme);
        }
        else {
            callback(error);
        }
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
    startDots(function() {
        insertQuestion(question, function() {

            $('body').off('click', '.elimination-answer');
            $('body').on('click', '.elimination-answer', function(e) {
                var text = $(this).text();
                updateAnswerDOM(text);

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
                        choices.milk_froth = answer === 'pos' ? {$in: [2]} : {$in: [1]};
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
        });
    });
}

/*
 * Insert questions / answers to the dom
 *
 */
function insertQuestion(data, callback) {

    $('.answer-option').removeClass('activity-answer');

    // Save the most recently added answer class, which ends with '-answer'
    var recentClasses = $('.answer-option')[0].classList;
    for(var i = 0; i < recentClasses.length; i++) {
        if(recentClasses[i].includes('-answer')) {
            recentClass = recentClasses[i];
            $('.answer-option').removeClass('')
        }
    }

    if(shouldSaveRecentConversation) {
        recentConversation.positive_answer = data.positive_answer;
        recentConversation.negative_answer = data.negative_answer;
    }

    // console.log('RECENT CONVERSATION');
    // console.log(recentConversation);

    noActionQuestionTimer = setTimeout(function() {
        updateQuestionDOM(data.phrase);

        $('.answer-option#positive-answer').text(data.positive_answer);
        $('.answer-option#negative-answer').text(data.negative_answer);

        removeDots();

        callback();
    }, (Math.random() * 1800) + 1800);
}

/*
 * Add a new answer to the conversation and scroll down to it
 *
 */
 function updateAnswerDOM(text) {
    $('.answer-option').text('');

    var a_clone = $('.chat-answer-template').clone();
    a_clone.text(text);
    $('.conversation-container').append(a_clone);
    a_clone.addClass('chat-buble-animating');
    scrollConversation();

    setTimeout(function() {
        a_clone.removeClass('chat-answer-template').addClass('chat-answer');
    }, 1);
 }

 /*
 * Add a new question to the conversation and scroll down to it
 *
 */
 function updateQuestionDOM(text, is_first) {

    if(is_first === undefined) {
        is_first = false;
    }

    var q_clone = $('.chat-question-template').clone();
    q_clone.text(text);
    $('.conversation-container').append(q_clone);
    q_clone.addClass('chat-buble-animating');
    scrollConversation();

    setTimeout(function() {
        q_clone.removeClass('chat-question-template').addClass('chat-question');
        if(is_first) {
            q_clone.addClass('waiting-statement');
        }
    }, 1);
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
    // drink_query._id = {
    //     $nin: bannedDrinkArray
    // }

    //console.log(drink_query);

    sendToPath('post', '/drinks', drink_query, function (error, response) {
        console.log(response);
        callback(response);
    });
}

/*
 * Get confirmation about the chosen drink from the user
 *
 */
function getConfirmation(chosenDrink) {

    // Construct first suggestion obj
    var confirmation_phrases = [
        'May I suggest a nice cup of ' + chosenDrink.name + ' then?',
        'Great! What do you think about getting a ' + chosenDrink.name + ' then?',
        'Great choices! I would suggest a cup of ' + chosenDrink.name + ' for you!'
    ];
    var confirmation_positive_answers = [
        'I\'d love one of those! Hook me up with a cup of ' + chosenDrink.name + '!',
        chosenDrink.name + ' sounds delicious. I\'d love one of those!'
    ];
    var confirmation_negative_answers = [
        'Hmmm, that wasn\'t exactly what I was looking for.',
        'I don\'t feel like one of those at the moment, can we start over?'
    ];
    var qData = {
        'phrase' : confirmation_phrases[Math.floor(Math.random()*confirmation_phrases.length)],
        'positive_answer' : confirmation_positive_answers[Math.floor(Math.random()*confirmation_positive_answers.length)],
        'negative_answer' : confirmation_negative_answers[Math.floor(Math.random()*confirmation_negative_answers.length)]
    }

    startDots(function() {
        insertQuestion(qData, function() {

            $('body').off('click', '.elimination-answer');
            $('body').on('click', '.elimination-answer', function(e) {
                var text = $(this).text();
                updateAnswerDOM(text);

                var answer;

                if(e.target.id === 'positive-answer') {
                    answer = 'pos';
                    ga('send', 'event', 'Confirmation', 'Accepted');
                }
                if(e.target.id === 'negative-answer') {
                    answer = 'neg';
                    ga('send', 'event', 'Confirmation', 'Rejected');
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
        });
    });
}

/*
 * Finish
 *
 */
function finishJoe(chosenDrink) {
    var joeFinishStatements = [
        'Great! Here\'s your ' + chosenDrink.name,
        'Alright! Your ' + chosenDrink.name + ' should be ready to grab. Enjoy!',
        'Neat! I\'ve dispensed your' + chosenDrink.name + '. Bon appetit!'
    ];
    var joeFinishStatement = joeFinishStatements[Math.floor(Math.random()*joeFinishStatements.length)];
    var joeDelay = 7500;

    if(chosenDrink.name === 'Cappuccino') {
        joeFinishStatement = 'Deal! You get two capsules for your ' + chosenDrink.name + '. One for the milk part, one for the coffee. I recommend starting out with the milk. Enjoy!'
        joeDelay = 10000;
    }

    startDots(function() {
        removeDots();

        updateQuestionDOM(joeFinishStatement);
        $('.answer-container').addClass('hidden');

        ga('send', 'event', 'Dispense', chosenDrink.name);

        sendToPath('post', '/dispense', chosenDrink, function (error, response) {
            console.log(response);
        });

        // If we have visitor info, update the database with their choice
        if(current_visitor !== null) {
            var updateVisitorLastDrinkData = {
                visitor_id : current_visitor._id,
                chosen_drink_number : chosenDrink.coffee_number
            }

            sendToPath('post', '/update_visitor_last_drink', updateVisitorLastDrinkData, function(error, response) {

            });
        }

        restartJoe(joeDelay);
    });
}

function restartJoe(timerMs) {
    choices = {};
    bannedDrinkArray = [];
    isServing = false;
    questionCounter = 0;
    current_visitor = null;
    isWaiting = false;
    isListeningForVisitor = false;
    iceBreakerStarted = false;
    clearTimeout(noActionTimer);
    clearTimeout(noActionQuestionTimer);
    clearTimeout(dotsTimer);

    console.log('Restart JOE');
    // Restart programme
    setTimeout(function() {
        $('.conversation-container .chat-buble:not(.chat-question-template, .chat-answer-template, .chat-dots-template)').remove();
        $('.answer-option').addClass('waiting-answer').removeClass('elimination-answer icebreaker-answer activity-answer');
        startWaiting();
    }, timerMs);
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
            callback(undefined, body);
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
 * Shuffles array in place.
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
