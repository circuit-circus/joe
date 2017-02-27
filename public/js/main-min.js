function startDots(e){console.log("... wiggling"),dotsTimer=setTimeout(function(){var t=$(".chat-dots-template").clone();t.removeClass("chat-dots-template").addClass("chat-dots"),$(".conversation-container").append(t),scrollConversation(),e()},400*Math.random()+400)}function removeDots(){console.log("Remove dots"),$(".chat-dots").remove()}function askForPerson(){var e={phrase:"Are you still there?",positive_answer:"Yup! I'm just thinking",negative_answer:"No, it's seems the other person left. Can you help me find a coffee?"};shouldSaveRecentConversation=!1,startDots(function(){insertQuestion(e,function(){$(".answer-option").removeClass(recentClass),$("body").off("click",".activity-answer"),$("body").on("click",".activity-answer",function(t){"positive-answer"===t.target.id&&resumeConversation(e),"negative-answer"===t.target.id&&restartJoe(0)})}),$(".answer-option").addClass("activity-answer")})}function restartTimer(){removeDots(),clearTimeout(noActionQuestionTimer),clearTimeout(noActionTimer),clearTimeout(dotsTimer),noActionTimer=setTimeout(askForPerson,12e4)}function resumeConversation(e){shouldSaveRecentConversation=!0;var t=e.positive_answer;updateAnswerDOM(t),startDots(function(){insertQuestion(recentConversation,function(){$(".answer-option").addClass(recentClass)})})}function startWaiting(){var e={phrase:"Hi there! I'm Joe, your personal barista. Press a button to get started!"},t=$(".chat-question-template").clone();t.text(e.phrase),t.removeClass("chat-question-template").addClass("chat-question"),$(".conversation-container").append(t),$(".answer-container").addClass("hidden"),isWaiting=!0,$("body").off("click",".waiting-answer"),$("body").on("click",".waiting-answer",function(e){isWaiting&&(isListeningForVisitor=!0,isWaiting=!1,startDots(function(){}),socket.emit("listenForVisitors",!0),setTimeout(function(){iceBreakerStarted||(console.log("Found no RFID"),startIcebreaker())},2e3))}),socket.on("visitorCheckedIn",function(e){!isServing&&isListeningForVisitor&&(console.log("Found visitor"),current_visitor=e,startIcebreaker())}),socket.on("couldNotFindGuest",function(e){!isServing&&isListeningForVisitor&&(console.log("Found RFID but no visitor"),startIcebreaker())})}function startIcebreaker(){removeDots(),isListeningForVisitor=!1,socket.emit("listenForVisitors",!1),isServing=!0,iceBreakerStarted=!0,getIcebreaker(function(e){var t=e;startDots(function(){insertQuestion(t,function(){$(".answer-option").removeClass("waiting-answer").addClass("icebreaker-answer"),$(".answer-container").removeClass("hidden"),$("body").off("click",".icebreaker-answer"),$("body").on("click",".icebreaker-answer",function(e){if(iceBreakerStarted=!0){iceBreakerStarted=!1,$(".icebreaker-answer").addClass("elimination-answer").removeClass("icebreaker-answer");var o=$(this).text();updateAnswerDOM(o),"positive-answer"===e.target.id&&finishJoe(t),"negative-answer"===e.target.id&&(bannedDrinkArray.push(t._id),eliminationRound())}})})})})}function getIcebreaker(e){var t=null===current_visitor?{}:current_visitor[0],o=getLocation();getWeatherInfo(o,function(o){var n,i,a=["Hi there [VISITOR]!","Hello [VISITOR]!"],s=["What about a hot cup of [DRINK]?","Would you like a nice cup of [DRINK]?"],r=["buddy","friend"],c={},l=["programme","time"];t.lastDrink&&l.push("lastDrink"),$.isEmptyObject(o)||l.push("weather"),l=shuffle(l);var u=[l[0],l[1]];console.log("REACTING TO"),console.log(u);var d=date.getHours();d>=6&&11>d?(a=["Goodmorning [VISITOR]!","Hi [VISITOR], hope you're having a great morning!"],"time"===u[0]&&(c.strength={$in:[2]},s=["Would you like a nice strong cup of [DRINK]?","It's early, how about a nice strong [DRINK] to wake you up?"])):d>=11&&14>d?a=["Hi there [VISITOR]!","Hello [VISITOR], how are you?","Hi [VISITOR]! So nice to see you.","Welcome [VISITOR]!"]:d>=14&&18>d?(a=["Goodafternoon [VISITOR]!","Hi [VISITOR], so nice to see you this afternoon."],"time"===u[0]&&(c.milk={$in:[1]},s=["How about a smooth cup of [DRINK]?","Would you like an afternoon [DRINK]?"])):d>=18&&23>d&&(a=["Goodevening [VISITOR]!","Goodevening [VISITOR], hope you're doing fine this lovely evening."],"time"===u[0]&&(c.strength={$in:[1]},s=["In the mood for a cup of [DRINK]?","Don't want too much caffeine this late, how about a nice cup of [DRINK]?"])),console.log("WELCOME GREETINGS"),console.log(a),n=a[Math.floor(Math.random()*a.length)];var h=[];$.isEmptyObject(o)||(parseInt(o.cloudiness)>75&&h.push("cloudy"),parseInt(o.fog)>55&&h.push("foggy"),parseInt(o.rain)>5&&h.push("rainy"),parseInt(o.temperature)<5&&h.push("cold"),parseInt(o.windSpeed.beaufort)>5&&h.push("windy"));var g=h[Math.floor(Math.random()*h.length)];console.log("CHOSEN WEATHER ELEMENT"),console.log(g),console.log("WEAHTER"),console.log(o),("weather"===u[0]||"weather"===u[1])&&("cloudy"===g?(weather_greetings=["Woah, it's looking cloudy!","Man, those clouds just won't quit today!"],"weather"===u[0]&&(c.strength={$in:[1]},s=["I think cloudiness calls for a nice cup of [DRINK]!"])):"foggy"===g?weather_greetings=["It sure is foggy today. You can barely see a thing!","I heard that coffee tastes better when it's foggy, so today must be a great coffee day, huh?"]:"rainy"===g?(weather_greetings=["With all this rain, it's a good thing we're inside!",'Ever heard the expression "When it rains, it pours"? I\'m pretty sure they mean it pours coffee.'],"weather"===u[0]&&(c.milk={$in:[1]},s=["I think milky drinks goes great with rain. How about a cup of [DRINK]?","Rain = milk, yes? Would you like a delicious [DRINK]?"])):"cold"===g?(weather_greetings=["It's a cold one out there today. You better warm yourself with a cuppa joe.","Some people say you should drink cold drinks, when it's cold. I strongly disagree with those people."],"weather"===u[0]&&(c.size={$in:[2]},s=["With a temperature like this, you might want a big hot cup of [DRINK]?","How about a big nice cup of [DRINK] to warm you up?"])):"windy"===g&&(weather_greetings=["Wow, the wind is really building up today!","In this windy weather, luckily getting a coffee is a breeze."]),n+=" "+weather_greetings[Math.floor(Math.random()*weather_greetings.length)]),console.log("DRINK GREETINGS"),console.log(s),console.log("ICEBREAKER CHOICES"),console.log(c),getAvailableDrinks(c,function(o){var a=o[0];i=s[Math.floor(Math.random()*s.length)];var c=t.name?t.name:r[Math.floor(Math.random()*r.length)];i=i.replace("[DRINK]",a.name),n=n.replace("[VISITOR]",c);var l=a;l.phrase=n+" "+i,l.positive_answer="Yeah, that sounds great. Hit me, Joe!",l.negative_answer="No thanks, I'm in the mood for something different",e(l)})})}function getLocation(){return 2===date.getMonth()?date.getDate()<29?HELSINKI_LOC:STOCKHOLM_LOC:COPENHAGEN_LOC}function getWeatherInfo(e,t){sendToPath("post","/weather",e,function(e,o){weather_data=void 0===o.errno?o:{},t(weather_data)})}function eliminationRound(){var e=question_data[questionCounter];startDots(function(){insertQuestion(e,function(){$("body").off("click",".elimination-answer"),$("body").on("click",".elimination-answer",function(e){var t=$(this).text();updateAnswerDOM(t);var o;switch("positive-answer"===e.target.id&&(o="pos"),"negative-answer"===e.target.id&&(o="neg"),questionCounter){case 0:choices.size="pos"===o?{$in:[1]}:{$in:[2]};break;case 1:choices.strength="pos"===o?{$in:[1]}:{$in:[2]};break;case 2:"pos"===o?choices.milk={$in:[1]}:"neg"===o&&(choices.milk={$in:[0]},choices.milk_froth={$in:[0]});break;case 3:choices.milk_froth="pos"===o?{$in:[1]}:{$in:[2]}}questionCounter++,getAvailableDrinks(choices,function(e){e.length>1?eliminationRound():getConfirmation(e[0])})})})})}function insertQuestion(e,t){$(".answer-option").removeClass("activity-answer");for(var o=$(".answer-option")[0].classList,n=0;n<o.length;n++)o[n].includes("-answer")&&(recentClass=o[n],$(".answer-option").removeClass(""));shouldSaveRecentConversation&&(recentConversation.positive_answer=e.positive_answer,recentConversation.negative_answer=e.negative_answer),console.log("RECENT CONVERSATION"),console.log(recentConversation),noActionQuestionTimer=setTimeout(function(){var o=$(".chat-question-template").clone();o.text(e.phrase),o.removeClass("chat-question-template").addClass("chat-question"),$(".conversation-container").append(o),$(".answer-option#positive-answer").text(e.positive_answer),$(".answer-option#negative-answer").text(e.negative_answer),removeDots(),scrollConversation(),t()},1800*Math.random()+1800)}function updateAnswerDOM(e){$(".answer-option").text("");var t=$(".chat-answer-template").clone();t.text(e),t.removeClass("chat-answer-template").addClass("chat-answer"),$(".conversation-container").append(t),scrollConversation()}function scrollConversation(){var e=$(".chat-buble").last(),t=Math.abs($(".conversation-container")[0].scrollHeight-e.offset().top+e.height());$(".conversation-container").animate({scrollTop:t},750)}function getAvailableDrinks(e,t){e._id={$nin:bannedDrinkArray},sendToPath("post","/drinks",e,function(e,o){console.log(o),t(o)})}function getConfirmation(e){var t={phrase:"Great! What do you think of getting a "+e.name+" then?",positive_answer:"I'd love one of those! Hook me up with a cup of "+e.name+"!",negative_answer:"No, that wasn't exactly what I was looking for."};startDots(function(){insertQuestion(t,function(){$("body").off("click",".elimination-answer"),$("body").on("click",".elimination-answer",function(t){var o=$(this).text();updateAnswerDOM(o);var n;"positive-answer"===t.target.id&&(n="pos"),"negative-answer"===t.target.id&&(n="neg"),"pos"===n?finishJoe(e):(choices={},bannedDrinkArray.push(e._id),questionCounter=0,eliminationRound())})})})}function finishJoe(e){var t=$('<div class="chat-question chat-buble"></div>');if(t.text("Great! Here's your "+e.name),$(".conversation-container").append(t),scrollConversation(),$(".answer-container").addClass("hidden"),sendToPath("post","/dispense",e,function(e,t){console.log(t)}),null!==current_visitor){var o={visitor_id:current_visitor._id,chosen_drink:e._id};sendToPath("post","/update_visitor_last_drink",o,function(e,t){})}restartJoe(2e3)}function restartJoe(e){choices={},bannedDrinkArray=[],isServing=!1,questionCounter=0,current_visitor=null,isWaiting=!1,isListeningForVisitor=!1,iceBreakerStarted=!1,clearTimeout(noActionTimer),clearTimeout(noActionQuestionTimer),clearTimeout(dotsTimer),console.log("Restart JOE"),setTimeout(function(){$(".conversation-container .chat-buble:not(.chat-question-template, .chat-answer-template, .chat-dots-template)").remove(),$(".answer-option").addClass("waiting-answer").removeClass("elimination-answer icebreaker-answer activity-answer"),startWaiting()},e)}function sendToPath(e,t,o,n,i){var a=i||n,s={url:t,type:e,contentType:"application/json",dataType:"json",data:JSON.stringify(o),xhrFields:{withCredentials:!0},success:function(e){if(1==e.status){if("NOT_LOGGED_IN"===e.code)return $.notify("You are no longer logged in - redirecting you to the front page","failure"),void setTimeout(function(){handleRegistrationNextStep(e.next_step)},3e3);a(e)}else a(void 0,e)},error:function(e){a(e.responseJSON?e.responseJSON:{status:1,message:"Action failed, please try again later"})}};i&&(s.xhr=function(){var e=new window.XMLHttpRequest;return e.upload&&e.upload.addEventListener("progress",function(e){if(e.lengthComputable){var t=e.loaded/e.total;n(t)}},!1),e}),$.ajax(s)}function shuffle(e){var t,o,n;for(n=e.length;n;n--)t=Math.floor(Math.random()*n),o=e[n-1],e[n-1]=e[t],e[t]=o;return e}var socket=io(),HELSINKI_LOC={latitude:60.16952,longitude:24.93545},STOCKHOLM_LOC={latitude:59.33258,longitude:18.0649},COPENHAGEN_LOC={latitude:55.67594,longitude:12.56553},weather_data={},date=new Date,bannedDrinkArray=[],choices={},current_visitor=null,isServing=!1,questionCounter=0,question_data=[{phrase:"Would you prefer a big or a small coffee?",positive_answer:"Small for me",negative_answer:"Big, please!"},{phrase:"How strong do you like it?",positive_answer:"Not too strong",negative_answer:"Give me a kick!"},{phrase:"You want milk in that?",positive_answer:"Yes, please",negative_answer:"I like it black like my soul!"},{phrase:"How frothy you want that milk?",positive_answer:"Lots of froth",negative_answer:"No froth"}],isWaiting=!1,isListeningForVisitor=!1,iceBreakerStarted=!1,noActionTimer,noActionQuestionTimer,dotsTimer,recentConversation={phrase:"Sure thing. Just take your time!"},recentClass,shouldSaveRecentConversation=!0;$(document).ready(function(){$("body").on("click","#positive-answer, #negative-answer",function(){restartTimer()}),socket.on("buttonPress",function(e){"L"===e?(console.log("Got L"),$("#positive-answer").click()):"R"===e&&(console.log("Got R"),$("#negative-answer").click())}),$("body").off("click",".lol"),$("body").on("click",".lol",function(){$("#positive-answer").click()}),isServing||startWaiting()});